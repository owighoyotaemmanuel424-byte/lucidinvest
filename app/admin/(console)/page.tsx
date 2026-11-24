import Link from "next/link";
import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { getPlatformOverview, listAuditEvents } from "@/lib/admin-platform";
import { formatDateTime } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [overview, auditEvents] = await Promise.all([getPlatformOverview(), listAuditEvents(10)]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Admin overview"
        lead="Verified platform figures only: posted ledger records, reviewed deposits and recorded audit events. Every change writes an audit row with your account as its actor."
      />

      <section className={styles.stats} aria-label="Platform summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total customers</p>
          <p className={styles.statValue}>{overview.customers}</p>
          <p className={styles.statHint}>{overview.activeCustomers} active</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Active accounts</p>
          <p className={styles.statValue}>{overview.activeAccounts}</p>
          <p className={styles.statHint}><Link href="/admin/accounts" className={styles.panelLink}>Investor accounts</Link></p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Verified deposits</p>
          <p className={styles.statValue}>{formatDecimal(overview.verifiedDeposits, "USD")}</p>
          <p className={styles.statHint}>Posted deposit requests</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total withdrawals</p>
          <p className={styles.statValue}>{formatDecimal(overview.totalWithdrawals, "USD")}</p>
          <p className={styles.statHint}>Posted withdrawals</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending withdrawals</p>
          <p className={styles.statValue}>{overview.pendingWithdrawalCount}</p>
          <p className={styles.statHint}>{formatDecimal(overview.pendingWithdrawals, "USD")} reserved</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Active investments</p>
          <p className={styles.statValue}>{overview.activeInvestments}</p>
          <p className={styles.statHint}>{formatDecimal(overview.investedPrincipal, "USD")} principal</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Assets under custody</p>
          <p className={styles.statValue}>{formatDecimal(overview.assetsUnderCustody, "USD")}</p>
          <p className={styles.statHint}>Ledger balances only</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Platform revenue</p>
          <p className={styles.statValue}>{formatDecimal(overview.platformRevenue, "USD")}</p>
          <p className={styles.statHint}>Posted revenue entries</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending KYC</p>
          <p className={styles.statValue}>{overview.pendingKyc}</p>
          <p className={styles.statHint}><Link href="/admin/kyc" className={styles.panelLink}>Review verification</Link></p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending orders</p>
          <p className={styles.statValue}>{overview.pendingOrders}</p>
          <p className={styles.statHint}><Link href="/admin/orders" className={styles.panelLink}>Settlement queue</Link></p>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="queues">
          <h2 id="queues" className={styles.panelTitle}>Operational queues</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <Link href="/admin/withdrawals" className={styles.cta}>Withdrawals ({overview.pendingWithdrawalCount})</Link>
            <Link href="/admin/kyc" className={`${styles.cta} ${styles.ctaGhost}`}>KYC verification ({overview.pendingKyc})</Link>
            <Link href="/admin/orders" className={`${styles.cta} ${styles.ctaGhost}`}>Market orders ({overview.pendingOrders})</Link>
            <Link href="/admin/support" className={`${styles.cta} ${styles.ctaGhost}`}>Support tickets ({overview.openTickets})</Link>
            <Link href="/admin/wallet-requests" className={`${styles.cta} ${styles.ctaGhost}`}>Wallet requests</Link>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="recent-audit">
          <div className={styles.panelHead}>
            <h2 id="recent-audit" className={styles.panelTitle}>Recent audit events</h2>
            <Link href="/admin/audit" className={styles.panelLink}>Full log</Link>
          </div>
          {auditEvents.length === 0 ? (
            <EmptyState title="No audit events" text="Actions recorded in the audit log will be listed here." />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Actor</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <div>{event.action}</div>
                        <div className={styles.muted}>{event.entityType}</div>
                      </td>
                      <td className={styles.muted}>{event.actorEmail ?? "system"}</td>
                      <td>{formatDateTime(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className={styles.notice}>
        Balance edits are not available anywhere in this console. Money enters or leaves the ledger only through approved
        deposits, withdrawals, transfers, investment subscriptions and settled orders — each with its audit event.
      </p>
    </>
  );
}
