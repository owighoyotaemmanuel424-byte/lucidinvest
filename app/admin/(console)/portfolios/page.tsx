import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listCustomerPortfolios } from "@/lib/admin-platform";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPortfoliosPage() {
  await requireAdmin();
  const rows = await listCustomerPortfolios();

  return (
    <>
      <PageHeader
        eyebrow="Portfolios"
        title="Portfolio management"
        lead="Verified balances per customer: wallet cash, account cash, open market holdings and active managed plans."
      />

      <section className={styles.panel} aria-labelledby="portfolio-list">
        <div className={styles.panelHead}>
          <h2 id="portfolio-list" className={styles.panelTitle}>{rows.length} customer portfolio{rows.length === 1 ? "" : "s"}</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No portfolios" text="Customer portfolios appear once accounts exist." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Wallet</th>
                  <th scope="col" className={styles.num}>Account cash</th>
                  <th scope="col" className={styles.num}>Holdings</th>
                  <th scope="col" className={styles.num}>Plans</th>
                  <th scope="col" className={styles.num}>Total</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer">
                      <div>{row.name}</div>
                      <div className={styles.muted}>{row.email}</div>
                    </td>
                    <td data-label="Status"><StatusBadge status={row.status} /></td>
                    <td data-label="Wallet" className={styles.num}>{formatDecimal(row.wallet, row.currency)}</td>
                    <td data-label="Account cash" className={styles.num}>{formatDecimal(row.cash, row.currency)}</td>
                    <td data-label="Holdings" className={styles.num}>{formatDecimal(row.holdings, row.currency)}</td>
                    <td data-label="Plans" className={styles.num}>
                      {formatDecimal(row.plans, row.currency)}
                      <span className={styles.muted}> ({row.plansCount})</span>
                    </td>
                    <td data-label="Total" className={styles.num}>{formatDecimal(row.total, row.currency)}</td>
                    <td data-label="Review">
                      <Link href={`/admin/customers/${row.id}`} className={styles.panelLink}>Open customer</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Totals are ledger-derived. Holdings use the latest recorded quote. No figure here is manually editable.
      </p>
    </>
  );
}
