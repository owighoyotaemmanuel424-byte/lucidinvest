"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import { StatusBadge } from "@/components/dashboard/PageHeader";
import panel from "@/components/dashboard/dashboard.module.css";
import { MIN_AMOUNT_MINOR, decimalToMinor, formatDecimal, formatMinor } from "@/lib/money";
import type { TradingAccount, Wallet, WalletRequest } from "@/lib/wallet-types";
import styles from "./wallet.module.css";

const BANNER_KEY = "lucidinvest.wallet.onboarding.dismissed.v1";
const CURRENCIES = ["USD", "EUR", "GBP"];
const ACCOUNT_TYPES = [
  { value: "investment", label: "Investment account" },
  { value: "cash", label: "Cash account" },
  { value: "demo", label: "Demo account" },
];

const ACCOUNT_LABELS: Record<string, string> = {
  investment: "Investment",
  cash: "Cash",
  demo: "Demo",
};

type DialogState =
  | { type: "fund" }
  | { type: "withdraw" }
  | { type: "transfer"; accountId?: string }
  | { type: "create" }
  | null;

type Feedback = { tone: "ok" | "error"; text: string } | null;

function isOpenAccount(account: TradingAccount) {
  return account.status !== "closed" && account.status !== "frozen";
}

function isEligibleForFunding(account: TradingAccount, wallet: Wallet) {
  return account.mode === "real" && isOpenAccount(account) && account.currency === wallet.currency;
}

async function postJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(apiErrorMessage(body, "That action could not be completed. Please try again."));
  }
  return body;
}

function Dialog({ title, text, onClose, children }: { title: string; text?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={styles.overlay} role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.dialogHead}>
          <div>
            <h2 className={styles.dialogTitle}>{title}</h2>
            {text && <p className={styles.dialogText}>{text}</p>}
          </div>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormActions({
  busy,
  submitLabel,
  busyLabel,
  message,
  onCancel,
}: {
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  message: Feedback;
  onCancel: () => void;
}) {
  return (
    <div className={styles.dialogHead}>
      <div className={panel.formActions}>
        <button type="submit" className={panel.cta} disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        <button type="button" className={`${panel.cta} ${panel.ctaGhost}`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {message && (
        <p className={formMessageClass(message.tone)} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}

function useFormState() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Feedback>(null);
  return { busy, setBusy, message, setMessage };
}

function FundForm({ wallet, onDone, onClose }: { wallet: Wallet; onDone: (text: string) => void; onClose: () => void }) {
  const { busy, setBusy, message, setMessage } = useFormState();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const body = (await postJson("/api/wallet/deposits", { amount, note })) as { request?: { reference?: string } };
      onDone(
        body?.request?.reference
          ? `Deposit request ${body.request.reference} recorded. Our team posts it once the funds are confirmed.`
          : "Deposit request recorded. Our team posts it once the funds are confirmed.",
      );
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That deposit could not be recorded." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel.form} onSubmit={submit}>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="fund-amount">
          Amount ({wallet.currency})
        </label>
        <input
          id="fund-amount"
          className={panel.input}
          inputMode="decimal"
          autoComplete="off"
          placeholder="250.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={busy}
          required
        />
      </div>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="fund-note">
          Payment reference <span className={panel.muted}>(optional)</span>
        </label>
        <input
          id="fund-note"
          className={panel.input}
          autoComplete="off"
          maxLength={200}
          placeholder="Bank transfer reference"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
        />
      </div>
      <p className={panel.hint}>
        This records a deposit instruction for wallet {wallet.walletNumber}. Nothing is credited until our team
        confirms the payment has arrived.
      </p>
      <FormActions busy={busy} submitLabel="Request deposit" busyLabel="Sending…" message={message} onCancel={onClose} />
    </form>
  );
}

function WithdrawForm({
  wallet,
  availableMinor,
  onDone,
  onClose,
}: {
  wallet: Wallet;
  availableMinor: number;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const { busy, setBusy, message, setMessage } = useFormState();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const body = (await postJson("/api/wallet/withdrawals", { amount, note })) as { request?: { reference?: string } };
      onDone(
        body?.request?.reference
          ? `Withdrawal request ${body.request.reference} recorded. The amount stays reserved until review is complete.`
          : "Withdrawal request recorded. The amount stays reserved until review is complete.",
      );
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That withdrawal could not be recorded." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel.form} onSubmit={submit}>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="withdraw-amount">
          Amount ({wallet.currency})
        </label>
        <input
          id="withdraw-amount"
          className={panel.input}
          inputMode="decimal"
          autoComplete="off"
          placeholder="100.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={busy}
          required
        />
        <p className={panel.hint}>{formatMinor(availableMinor, wallet.currency)} available after pending requests.</p>
      </div>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="withdraw-note">
          Payout details
        </label>
        <input
          id="withdraw-note"
          className={panel.input}
          autoComplete="off"
          maxLength={200}
          placeholder="Bank name and last four digits"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
          required
        />
      </div>
      <p className={panel.hint}>
        Our team pays withdrawals to the account on file after review. Funds stay in your wallet until the request is
        processed.
      </p>
      <FormActions busy={busy} submitLabel="Request withdrawal" busyLabel="Sending…" message={message} onCancel={onClose} />
    </form>
  );
}

function TransferForm({
  wallet,
  accounts,
  initialAccountId,
  onDone,
  onClose,
}: {
  wallet: Wallet;
  accounts: TradingAccount[];
  initialAccountId?: string;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const { busy, setBusy, message, setMessage } = useFormState();
  const eligible = accounts.filter((account) => isEligibleForFunding(account, wallet));
  const [accountId, setAccountId] = useState(
    initialAccountId && eligible.some((account) => account.id === initialAccountId) ? initialAccountId : eligible[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const walletMinor = decimalToMinor(wallet.balance) ?? 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const body = (await postJson("/api/wallet/transfers", { accountId, amount })) as {
        transfer?: { accountNumber?: string | null; reference?: string };
      };
      const target = body?.transfer?.accountNumber ? `account ${body.transfer.accountNumber}` : "your account";
      onDone(`Transferred ${amount} ${wallet.currency} to ${target}.`);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That transfer could not be completed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel.form} onSubmit={submit}>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="transfer-account">
          Destination account
        </label>
        <select
          id="transfer-account"
          className={panel.input}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          disabled={busy || eligible.length === 0}
          required
        >
          {eligible.map((account) => (
            <option key={account.id} value={account.id}>
              {ACCOUNT_LABELS[account.accountType] ?? account.accountType} {account.accountNumber ?? ""} ·{" "}
              {formatDecimal(account.balance, account.currency)}
            </option>
          ))}
        </select>
      </div>
      <div className={panel.field}>
        <label className={panel.label} htmlFor="transfer-amount">
          Amount ({wallet.currency})
        </label>
        <input
          id="transfer-amount"
          className={panel.input}
          inputMode="decimal"
          autoComplete="off"
          placeholder="100.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={busy}
          required
        />
        <p className={panel.hint}>{formatMinor(walletMinor, wallet.currency)} available in your wallet.</p>
      </div>
      <p className={panel.hint}>
        Internal transfers post a wallet debit and an account credit in the same ledger transaction, so neither side can
        land alone.
      </p>
      <FormActions busy={busy} submitLabel="Send transfer" busyLabel="Sending…" message={message} onCancel={onClose} />
    </form>
  );
}

function CreateAccountForm({ onDone, onClose }: { onDone: (text: string) => void; onClose: () => void }) {
  const { busy, setBusy, message, setMessage } = useFormState();
  const [accountType, setAccountType] = useState("investment");
  const [currency, setCurrency] = useState("USD");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const body = (await postJson("/api/account/accounts", { accountType, currency })) as {
        account?: { accountNumber?: string };
      };
      onDone(
        body?.account?.accountNumber
          ? `Account ${body.account.accountNumber} opened. It stays pending until our team completes its review.`
          : "Account opened. It stays pending until our team completes its review.",
      );
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That account could not be opened." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panel.form} onSubmit={submit}>
      <div className={panel.formGrid}>
        <div className={panel.field}>
          <label className={panel.label} htmlFor="new-account-type">
            Account type
          </label>
          <select
            id="new-account-type"
            className={panel.input}
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
            disabled={busy}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className={panel.field}>
          <label className={panel.label} htmlFor="new-account-currency">
            Currency
          </label>
          <select
            id="new-account-currency"
            className={panel.input}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            disabled={busy}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={panel.hint}>
        One open account per type and currency. Opening an account records a review request and does not fund it.
      </p>
      <FormActions busy={busy} submitLabel="Open account" busyLabel="Opening…" message={message} onCancel={onClose} />
    </form>
  );
}

export default function WalletConsole({
  wallet,
  realAccounts,
  demoAccounts,
  pendingRequests,
}: {
  wallet: Wallet;
  realAccounts: TradingAccount[];
  demoAccounts: TradingAccount[];
  pendingRequests: WalletRequest[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"real" | "demo">("real");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dismissed, setDismissed] = useState(false);

  const walletMinor = decimalToMinor(wallet.balance) ?? 0;
  const heldMinor = pendingRequests
    .filter((request) => request.kind === "withdrawal")
    .reduce((total, request) => total + (decimalToMinor(request.amount) ?? 0), 0);
  const availableMinor = Math.max(0, walletMinor - heldMinor);
  const fundableAccounts = [...realAccounts, ...demoAccounts].filter((account) => isEligibleForFunding(account, wallet));
  const hasFunds = walletMinor >= MIN_AMOUNT_MINOR;
  const hasAvailable = availableMinor >= MIN_AMOUNT_MINOR;
  const visibleAccounts = tab === "real" ? realAccounts : demoAccounts;

  useEffect(() => {
    // Deferred a frame so the first paint matches the server output, then the
    // stored dismissal (if any) is applied without a synchronous cascade.
    const frame = window.requestAnimationFrame(() => {
      try {
        if (window.sessionStorage.getItem(BANNER_KEY) === "1") setDismissed(true);
      } catch {
        // Private browsing can block storage; the banner simply stays visible.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDialog(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  function dismissBanner() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(BANNER_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  function finish(text: string) {
    setDialog(null);
    setFeedback({ tone: "ok", text });
    router.refresh();
  }

  return (
    <>
      {!dismissed && walletMinor === 0 && (
        <div className={styles.banner}>
          <span className={styles.bannerIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.7" />
              <path d="M7 15h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div className={styles.bannerBody}>
            <p className={styles.bannerTitle}>Fund your wallet to get started</p>
            <p className={styles.bannerText}>
              Your wallet balance is {formatDecimal(wallet.balance, wallet.currency)}. Record a deposit instruction and
              our team will confirm it, or transfer funds you already hold into a trading account.
            </p>
            <div className={styles.bannerActions}>
              <button type="button" className={panel.cta} onClick={() => setDialog({ type: "fund" })}>
                Fund wallet
              </button>
              <Link href="/dashboard/wallet/history" className={`${panel.cta} ${panel.ctaGhost}`}>
                View history
              </Link>
            </div>
          </div>
          <button type="button" className={styles.bannerClose} onClick={dismissBanner} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {feedback && (
        <p className={formMessageClass(feedback.tone)} role="status">
          {feedback.text}
        </p>
      )}

      <section className={styles.summary} aria-labelledby="wallet-summary-title">
        <div className={styles.summaryTop}>
          <div>
            <p className={styles.summaryLabel} id="wallet-summary-title">
              Wallet balance
            </p>
            <p className={styles.summaryBalance}>{formatDecimal(wallet.balance, wallet.currency)}</p>
            <div className={styles.walletMeta}>
              <span className={styles.walletId}>{wallet.walletNumber}</span>
              <span className={styles.currencyChip}>{wallet.currency}</span>
              <span className={styles.walletStatus}>{wallet.status}</span>
              {heldMinor > 0 && <span>{formatMinor(heldMinor, wallet.currency)} reserved for withdrawals</span>}
            </div>
          </div>
          <Link href="/dashboard/wallet/history" className={styles.summaryLink}>
            View history →
          </Link>
        </div>

        <div className={styles.quick}>
          <button
            type="button"
            className={`${styles.quickButton} ${styles.quickPrimary}`}
            onClick={() => setDialog({ type: "fund" })}
          >
            <span aria-hidden="true">+</span>
            <span>
              Fund
              <span className={styles.quickHint}>Record a deposit instruction</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.quickButton}
            onClick={() => setDialog({ type: "withdraw" })}
            disabled={!hasAvailable}
            title={hasAvailable ? undefined : "Available once your wallet holds a balance"}
          >
            <span aria-hidden="true">↑</span>
            <span>
              Withdrawal
              <span className={styles.quickHint}>{hasAvailable ? formatMinor(availableMinor, wallet.currency) + " available" : "No available balance"}</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.quickButton}
            onClick={() => setDialog({ type: "transfer" })}
            disabled={!hasFunds || fundableAccounts.length === 0}
            title={
              fundableAccounts.length === 0
                ? "Open a real account in the wallet currency to transfer funds"
                : hasFunds
                  ? undefined
                  : "Transfer becomes available once your wallet holds a balance"
            }
          >
            <span aria-hidden="true">⇄</span>
            <span>
              Transfer
              <span className={styles.quickHint}>
                {fundableAccounts.length === 0 ? "No matching account" : "Wallet to trading account"}
              </span>
            </span>
          </button>
        </div>

        <div className={styles.summaryFoot}>
          <span className={styles.summaryNote}>Balances update when a ledger entry is posted.</span>
          <button type="button" className={styles.summaryLink} style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setDialog({ type: "create" })}>
            Create account →
          </button>
        </div>
      </section>

      <section className={panel.panel} aria-labelledby="trading-accounts-title">
        <div className={styles.tabsHead}>
          <h2 id="trading-accounts-title" className={panel.panelTitle}>
            Trading accounts
          </h2>
          <button type="button" className={`${styles.miniButton} ${styles.miniPrimary}`} onClick={() => setDialog({ type: "create" })}>
            Create account
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "real"}
            className={`${styles.tab} ${tab === "real" ? styles.tabActive : ""}`}
            onClick={() => setTab("real")}
          >
            Real account <span className={styles.tabCount}>{realAccounts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "demo"}
            className={`${styles.tab} ${tab === "demo" ? styles.tabActive : ""}`}
            onClick={() => setTab("demo")}
          >
            Demo accounts <span className={styles.tabCount}>{demoAccounts.length}</span>
          </button>
        </div>

        {visibleAccounts.length === 0 ? (
          <div className={panel.empty}>
            <p className={panel.emptyTitle}>{tab === "real" ? "No real accounts yet" : "No demo accounts yet"}</p>
            <p className={panel.emptyText}>
              {tab === "real"
                ? "Open an account to hold investments and receive transfers from your wallet."
                : "Demo accounts let you explore the platform without real funds."}
            </p>
            <button type="button" className={panel.cta} onClick={() => setDialog({ type: "create" })}>
              Create account
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleAccounts.map((account) => {
              const canFund = isEligibleForFunding(account, wallet) && hasFunds;
              return (
                <article key={account.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardNumber}>{account.accountNumber ?? "Pending number"}</span>
                    <span className={`${styles.modeBadge} ${account.mode === "real" ? styles.modeReal : styles.modeDemo}`}>
                      {account.mode}
                    </span>
                  </div>
                  <p className={styles.cardType}>
                    {(ACCOUNT_LABELS[account.accountType] ?? account.accountType)} · {account.currency}
                  </p>
                  <p className={styles.cardBalance}>{formatDecimal(account.balance, account.currency)}</p>
                  <div className={styles.cardFoot}>
                    <StatusBadge status={account.status} />
                    <div className={styles.cardActions}>
                      {account.mode === "real" ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.miniButton} ${styles.miniPrimary}`}
                            onClick={() => setDialog({ type: "transfer", accountId: account.id })}
                            disabled={!canFund}
                            title={
                              !isOpenAccount(account)
                                ? "This account cannot receive funds while it is not open"
                                : account.currency !== wallet.currency
                                  ? `This account is in ${account.currency}; your wallet holds ${wallet.currency}`
                                  : hasFunds
                                    ? undefined
                                    : "Add funds to your wallet first"
                            }
                          >
                            Fund
                          </button>
                          <Link className={styles.miniButton} href="/dashboard/investments">
                            Invest
                          </Link>
                        </>
                      ) : (
                        <>
                          <button type="button" className={styles.miniButton} disabled title="Demo accounts are not funded from your wallet">
                            Fund
                          </button>
                          <button type="button" className={styles.miniButton} disabled title="Demo trading is not available in this build">
                            Practice
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {account.mode === "demo" && (
                    <p className={styles.cardNote}>
                      Virtual account: it is not connected to your wallet or the live ledger.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {dialog?.type === "fund" && (
        <Dialog
          title="Fund your wallet"
          text={`Record a deposit instruction for wallet ${wallet.walletNumber}.`}
          onClose={() => setDialog(null)}
        >
          <FundForm wallet={wallet} onDone={finish} onClose={() => setDialog(null)} />
        </Dialog>
      )}

      {dialog?.type === "withdraw" && (
        <Dialog
          title="Request a withdrawal"
          text={`${formatMinor(availableMinor, wallet.currency)} is available after pending requests.`}
          onClose={() => setDialog(null)}
        >
          <WithdrawForm
            wallet={wallet}
            availableMinor={availableMinor}
            onDone={finish}
            onClose={() => setDialog(null)}
          />
        </Dialog>
      )}

      {dialog?.type === "transfer" && (
        <Dialog
          title="Transfer to an account"
          text="Move funds from your wallet into one of your own trading accounts."
          onClose={() => setDialog(null)}
        >
          <TransferForm
            wallet={wallet}
            accounts={[...realAccounts, ...demoAccounts]}
            initialAccountId={dialog.accountId}
            onDone={finish}
            onClose={() => setDialog(null)}
          />
        </Dialog>
      )}

      {dialog?.type === "create" && (
        <Dialog
          title="Create a trading account"
          text="Accounts are issued straight away and stay pending until our team completes its review."
          onClose={() => setDialog(null)}
        >
          <CreateAccountForm onDone={finish} onClose={() => setDialog(null)} />
        </Dialog>
      )}
    </>
  );
}
