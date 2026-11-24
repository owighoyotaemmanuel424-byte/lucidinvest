"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import styles from "@/components/dashboard/dashboard.module.css";

export default function MoneyRequestPanel({
  kind,
  currency,
  walletNumber,
  available,
}: {
  kind: "deposit" | "withdrawal";
  currency: string;
  walletNumber: string;
  available: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/wallet/${kind === "deposit" ? "deposits" : "withdrawals"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ amount, note }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage({ tone: "error", text: apiErrorMessage(body, "That request could not be recorded.") });
        return;
      }
      setMessage({
        tone: "ok",
        text:
          kind === "deposit"
            ? "Deposit request recorded. Our finance team credits the ledger once the funds are confirmed."
            : "Withdrawal request recorded. The amount is reserved until finance completes its review.",
      });
      setAmount("");
      setNote("");
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Check your internet connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${kind}-amount`}>Amount ({currency})</label>
        <input
          id={`${kind}-amount`}
          className={styles.input}
          inputMode="decimal"
          autoComplete="off"
          placeholder={kind === "deposit" ? "1000.00" : "250.00"}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={busy}
          required
        />
        <p className={styles.hint}>
          {kind === "withdrawal" ? `${available} available after pending requests. ` : ""}
          Wallet {walletNumber}.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${kind}-note`}>
          {kind === "deposit" ? "Payment reference" : "Payout details"}
          {kind === "deposit" ? <span className={styles.muted}> (optional)</span> : null}
        </label>
        <input
          id={`${kind}-note`}
          className={styles.input}
          autoComplete="off"
          maxLength={200}
          placeholder={kind === "deposit" ? "Bank transfer reference" : "Bank name and account ending"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
          required={kind === "withdrawal"}
        />
      </div>
      <p className={styles.notice}>
        {kind === "deposit"
          ? "No card or open-banking provider is connected to this deployment. A deposit is an instruction; finance confirms receipt before any balance changes."
          : "Withdrawals follow a four-eyes workflow: validation, pending review, authorised approval, then payment. Nothing leaves the ledger without an approval and a posted entry."}
      </p>
      <div className={styles.formActions}>
        <button type="submit" className={styles.cta} disabled={busy}>
          {busy ? "Sending…" : kind === "deposit" ? "Request deposit" : "Request withdrawal"}
        </button>
        {message && <p className={formMessageClass(message.tone)} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
