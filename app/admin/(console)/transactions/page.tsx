import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listPlatformTransactions } from "@/lib/admin-platform";
import { formatDateTime } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  await requireAdmin();
  const transactions = await listPlatformTransactions(250);

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        lead="Every posted ledger entry across wallets, investor accounts and platform clearing accounts. Amounts are exact NUMERIC values."
      />

      <section className={styles.panel} aria-labelledby="ledger">
        <div className={styles.panelHead}>
          <h2 id="ledger" className={styles.panelTitle}>{transactions.length} entries</h2>
        </div>
        {transactions.length === 0 ? (
          <EmptyState title="No ledger entries" text="Posted money movements will be listed here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Posted</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Description</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Posted">{formatDateTime(entry.createdAt)}</td>
                    <td data-label="Owner">
                      <div className={styles.mono}>{entry.owner}</div>
                      {entry.ownerEmail && <div className={styles.muted}>{entry.ownerEmail}</div>}
                    </td>
                    <td data-label="Description">{entry.description}</td>
                    <td data-label="Reference" className={styles.mono}>{entry.reference ?? "—"}</td>
                    <td data-label="Status"><StatusBadge status={entry.status} /></td>
                    <td data-label="Amount" className={styles.num}>{formatDecimal(entry.amount, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Platform clearing rows are the counterparty side of a balanced transaction. They are not customer money and are
        never editable.
      </p>
    </>
  );
}
