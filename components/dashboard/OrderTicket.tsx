"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import styles from "@/components/dashboard/dashboard.module.css";

type InstrumentOption = {
  id: string;
  symbol: string;
  name: string;
  price: string | null;
  currency: string;
  assetClass: string;
  isDemo: boolean;
};

type AccountOption = { id: string; accountNumber: string | null; currency: string; balance: string; status: string };

export default function OrderTicket({
  side,
  instruments,
  accounts,
  initialInstrumentId,
}: {
  side: "buy" | "sell";
  instruments: InstrumentOption[];
  accounts: AccountOption[];
  initialInstrumentId?: string;
}) {
  const router = useRouter();
  const usable = instruments.filter((instrument) => instrument.price);
  const [instrumentId, setInstrumentId] = useState(
    initialInstrumentId && usable.some((instrument) => instrument.id === initialInstrumentId)
      ? initialInstrumentId
      : usable[0]?.id ?? "",
  );
  const selected = useMemo(() => usable.find((instrument) => instrument.id === instrumentId), [usable, instrumentId]);
  const eligibleAccounts = accounts.filter(
    (account) => account.status === "active" && (!selected || account.currency === selected.currency),
  );
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const estimate = (() => {
    const price = Number(selected?.price ?? 0);
    const amount = Number(quantity);
    if (!Number.isFinite(price) || !Number.isFinite(amount) || price <= 0 || amount <= 0) return null;
    return (price * amount).toFixed(2);
  })();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const response = await fetch("/api/account/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ instrumentId, accountId, side, quantity, note }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage({ tone: "error", text: apiErrorMessage(body, "That order could not be placed.") });
        return;
      }
      setMessage({
        tone: "ok",
        text: `Order recorded for review. Our operations team settles it against the ledger; you will be notified when it is filled.`,
      });
      setQuantity("");
      setNote("");
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Check your internet connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (usable.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No instruments available</p>
        <p className={styles.emptyText}>Market instruments appear here once they have a published price.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${side}-instrument`}>Instrument</label>
          <select
            id={`${side}-instrument`}
            className={styles.input}
            value={instrumentId}
            onChange={(event) => {
              setInstrumentId(event.target.value);
              setAccountId("");
            }}
            disabled={busy}
            required
          >
            {usable.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.symbol} · {instrument.name} · {instrument.currency}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${side}-account`}>Account</label>
          <select
            id={`${side}-account`}
            className={styles.input}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={busy || eligibleAccounts.length === 0}
            required
          >
            {eligibleAccounts.length === 0 ? (
              <option value="">No active account in this currency</option>
            ) : (
              eligibleAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountNumber ?? "Account"} · {account.currency} · {account.balance}
                </option>
              ))
            )}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${side}-quantity`}>Quantity</label>
          <input
            id={`${side}-quantity`}
            className={styles.input}
            inputMode="decimal"
            autoComplete="off"
            placeholder="1.00000000"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={busy}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${side}-note`}>
          Instructions <span className={styles.muted}>(optional)</span>
        </label>
        <input
          id={`${side}-note`}
          className={styles.input}
          maxLength={200}
          autoComplete="off"
          placeholder="Order instructions for the operations team"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
        />
      </div>

      <p className={styles.notice}>
        {selected?.isDemo ? "Simulated market data. " : ""}
        Indicative price {selected?.price ?? "—"} {selected?.currency ?? ""}
        {estimate ? ` · estimated value ${estimate} ${selected?.currency ?? ""}` : ""}. The final settlement price is the
        last recorded quote when operations fill the order. Orders post a balanced ledger transaction; they are not
        instant execution.
      </p>

      <div className={styles.formActions}>
        <button type="submit" className={styles.cta} disabled={busy || eligibleAccounts.length === 0}>
          {busy ? "Submitting…" : side === "buy" ? "Submit buy order" : "Submit sell order"}
        </button>
        {message && (
          <p className={formMessageClass(message.tone)} role="status">{message.text}</p>
        )}
      </div>
    </form>
  );
}
