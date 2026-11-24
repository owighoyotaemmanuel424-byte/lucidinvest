import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import { AllocationDonut, AreaChart } from "@/components/ui/Charts";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { formatDate, getSummary, getTransactions } from "@/lib/dashboard";
import { decimalToMinor, formatDecimal, formatMinor, formatSignedMinor, minorToDecimal } from "@/lib/money";
import { getPortfolio, recordPortfolioSnapshot } from "@/lib/marketplace";
import { getWalletOverview } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  await recordPortfolioSnapshot(user.id);
  const [portfolio, overview, transactions, summary] = await Promise.all([
    getPortfolio(user.id),
    getWalletOverview(user.id),
    getTransactions(user.id, 6),
    getSummary(user.id),
  ]);

  const heldMinor = overview.pendingRequests
    .filter((request) => request.kind === "withdrawal")
    .reduce((total, request) => total + (decimalToMinor(request.amount) ?? 0), 0);
  const cashMinor = Math.max(0, (decimalToMinor(portfolio.cash) ?? 0) - heldMinor);
  const investedMinor = (decimalToMinor(portfolio.invested) ?? 0) + (decimalToMinor(portfolio.costBasis) ?? 0);
  const returnsMinor = decimalToMinor(portfolio.unrealised) ?? 0;
  const todayMinor = decimalToMinor(portfolio.todayChange) ?? 0;
  const pendingCount =
    overview.pendingRequests.length + portfolio.pendingOrders.length + summary.pendingInvestmentCount;
  const firstName = user.full_name.split(" ")[0] ?? user.full_name;

  return (
    <>
      <PageHeader
        eyebrow="Customer overview"
        title={`Welcome, ${firstName}`}
        lead="Your portfolio, cash and pending activity at a glance."
        action={<Link href="/dashboard/buy" className={styles.cta}>Buy investments</Link>}
      />

      <section className={styles.stats} aria-label="Portfolio summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total portfolio value</p>
          <p className={styles.statValue}>{formatDecimal(portfolio.totalValue, portfolio.currency)}</p>
          <p className={styles.statHint}>Cash, holdings and managed plans</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Available balance</p>
          <p className={styles.statValue}>{formatMinor(cashMinor, portfolio.currency)}</p>
          <p className={styles.statHint}>
            <Link href="/dashboard/wallet" className={styles.panelLink}>Wallet & accounts</Link>
          </p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total invested</p>
          <p className={styles.statValue}>{formatMinor(investedMinor, portfolio.currency)}</p>
          <p className={styles.statHint}>{portfolio.activeInvestments} active plan{portfolio.activeInvestments === 1 ? "" : "s"}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total returns</p>
          <p className={styles.statValue} style={{ color: returnsMinor >= 0 ? "#146b32" : "#a12b2b" }}>
            {formatSignedMinor(returnsMinor, portfolio.currency)}
          </p>
          <p className={styles.statHint}>Unrealised on open holdings</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Today&apos;s profit / loss</p>
          <p className={styles.statValue} style={{ color: todayMinor >= 0 ? "#146b32" : "#a12b2b" }}>
            {formatSignedMinor(todayMinor, portfolio.currency)}
          </p>
          <p className={styles.statHint}>From the latest recorded change</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Active investments</p>
          <p className={styles.statValue}>{portfolio.activeInvestments + portfolio.holdings.length}</p>
          <p className={styles.statHint}>{portfolio.holdings.length} market holding{portfolio.holdings.length === 1 ? "" : "s"}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending transactions</p>
          <p className={styles.statValue}>{pendingCount}</p>
          <p className={styles.statHint}>
            <Link href="/dashboard/portfolio" className={styles.panelLink}>Review pending items</Link>
          </p>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="overview-performance">
          <div className={styles.panelHead}>
            <h2 id="overview-performance" className={styles.panelTitle}>Performance</h2>
            <Link href="/dashboard/portfolio" className={styles.panelLink}>Portfolio</Link>
          </div>
          <AreaChart
            points={portfolio.history.map((point) => ({
              label: point.asOf.slice(5),
              value: (decimalToMinor(point.totalValue) ?? 0) / 100,
            }))}
          />
        </section>

        <section className={styles.panel} aria-labelledby="overview-allocation">
          <div className={styles.panelHead}>
            <h2 id="overview-allocation" className={styles.panelTitle}>Allocation</h2>
          </div>
          <AllocationDonut slices={portfolio.allocation} />
        </section>
      </div>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="recent-activity">
          <div className={styles.panelHead}>
            <h2 id="recent-activity" className={styles.panelTitle}>Recent activity</h2>
            <Link href="/dashboard/transactions" className={styles.panelLink}>All transactions</Link>
          </div>
          {transactions.length === 0 ? (
            <EmptyState title="No transactions yet" text="Posted ledger entries for your accounts will appear here." />
          ) : (
            <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col" className={styles.num}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Date">{formatDate(entry.created_at)}</td>
                      <td data-label="Description">
                        <div>{entry.description}</div>
                        <div className={styles.muted}>{entry.account_number ?? "Wallet"}</div>
                      </td>
                      <td data-label="Amount" className={styles.num}>{formatDecimal(entry.amount, entry.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="quick-actions">
          <h2 id="quick-actions" className={styles.panelTitle}>Quick actions</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <Link href="/dashboard/deposit" className={styles.cta}>Deposit funds</Link>
            <Link href="/dashboard/plans" className={`${styles.cta} ${styles.ctaGhost}`}>Investment plans</Link>
            <Link href="/dashboard/markets" className={`${styles.cta} ${styles.ctaGhost}`}>Market instruments</Link>
            <Link href="/dashboard/statements" className={`${styles.cta} ${styles.ctaGhost}`}>Download statements</Link>
            <Link href="/dashboard/support" className={`${styles.cta} ${styles.ctaGhost}`}>Contact support</Link>
          </div>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Account status</dt>
              <dd className={styles.detailValue}><StatusBadge status={user.status} /></dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Wallet</dt>
              <dd className={styles.detailValue}><span className={styles.mono}>{overview.wallet.walletNumber}</span></dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Pending requests</dt>
              <dd className={styles.detailValue}>{formatMinor(heldMinor, portfolio.currency)} reserved</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className={styles.notice}>
        Values use posted ledger records and the latest recorded quotes; {portfolio.hasDemoData ? "holdings marked simulated use demo market data. " : ""}
        Cash movements only occur through approved ledger entries. Unrealised returns are not bankable gains and may fall
        as well as rise. Total invested is {minorToDecimal(investedMinor)} {portfolio.currency}.
      </p>
    </>
  );
}
