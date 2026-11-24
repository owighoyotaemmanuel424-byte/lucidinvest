import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import MoneyRequestPanel from "@/components/dashboard/MoneyRequestPanel";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dashboard";
import { decimalToMinor, formatDecimal, formatMinor } from "@/lib/money";
import { getWalletOverview, getWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const WORKFLOW = [
  "You submit the withdrawal request.",
  "The system validates your available funds and reserves the amount.",
  "The request enters pending status.",
  "A finance administrator reviews it.",
  "An authorised approval is recorded in the audit log.",
  "The payment provider executes the transfer.",
  "The result is reconciled and posted to your ledger.",
  "You receive a notification.",
];

export default async function WithdrawPage() {
  const user = await requireUser();
  const [overview, history] = await Promise.all([
    getWalletOverview(user.id),
    getWalletTransactions(user.id, { kind: "withdrawal", pageSize: 20 }),
  ]);
  const { wallet, pendingRequests } = overview;
  const heldMinor = pendingRequests
    .filter((request) => request.kind === "withdrawal")
    .reduce((total, request) => total + (decimalToMinor(request.amount) ?? 0), 0);
  const available = Math.max(0, (decimalToMinor(wallet.balance) ?? 0) - heldMinor);

  return (
    <>
      <PageHeader
        eyebrow="Funding"
        title="Withdraw funds"
        lead="Request a payout from your available wallet balance. Funds stay in the ledger until an authorised reviewer approves the request."
        action={<Link href="/dashboard/deposit" className={`${styles.cta} ${styles.ctaGhost}`}>Deposit instead</Link>}
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="withdraw-form">
          <div className={styles.panelHead}>
            <h2 id="withdraw-form" className={styles.panelTitle}>New withdrawal request</h2>
            <StatusBadge status={wallet.status} />
          </div>
          <MoneyRequestPanel
            kind="withdrawal"
            currency={wallet.currency}
            walletNumber={wallet.walletNumber}
            available={formatMinor(available, wallet.currency)}
          />
        </section>

        <section className={styles.panel} aria-labelledby="withdraw-workflow">
          <h2 id="withdraw-workflow" className={styles.panelTitle}>How a withdrawal is processed</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 13.5, lineHeight: 1.5 }}>
            {WORKFLOW.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className={styles.notice}>
            Available balance {formatMinor(available, wallet.currency)} of {formatDecimal(wallet.balance, wallet.currency)}.
            Pending withdrawals are reserved and cannot be spent twice.
          </p>
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="withdraw-history">
        <div className={styles.panelHead}>
          <h2 id="withdraw-history" className={styles.panelTitle}>Withdrawal history</h2>
          <Link href="/dashboard/statements" className={styles.panelLink}>Download statement</Link>
        </div>
        {history.entries.length === 0 ? (
          <EmptyState title="No withdrawals yet" text="Requests and paid payouts will be listed here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Date">{formatDate(entry.createdAt)}</td>
                    <td data-label="Reference" className={styles.mono}>{entry.reference ?? "—"}</td>
                    <td data-label="Description">{entry.description}</td>
                    <td data-label="Status"><StatusBadge status={entry.status} /></td>
                    <td data-label="Amount" className={styles.num}>{formatDecimal(entry.amount, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
