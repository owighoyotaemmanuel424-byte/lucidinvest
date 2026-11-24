import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import { AllocationDonut, AreaChart } from "@/components/ui/Charts";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dashboard";
import { getPortfolio, recordPortfolioSnapshot } from "@/lib/marketplace";
import { decimalToMinor, formatDecimal, formatSignedMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireUser();
  await recordPortfolioSnapshot(user.id);
  const portfolio = await getPortfolio(user.id);

  const returnsMinor = decimalToMinor(portfolio.unrealised) ?? 0;
  const todayMinor = decimalToMinor(portfolio.todayChange) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="My portfolio"
        lead="Holdings, managed plans and wallet cash, valued at the latest recorded quote. Simulated market data is labelled."
        action={<Link href="/dashboard/buy" className={styles.cta}>Buy investments</Link>}
      />

      <section className={styles.stats} aria-label="Portfolio summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total portfolio value</p>
          <p className={styles.statValue}>{formatDecimal(portfolio.totalValue, portfolio.currency)}</p>
          <p className={styles.statHint}>Cash, holdings and active plans</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Market value</p>
          <p className={styles.statValue}>{formatDecimal(portfolio.marketValue, portfolio.currency)}</p>
          <p className={styles.statHint}>{portfolio.holdings.length} open holding{portfolio.holdings.length === 1 ? "" : "s"}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Managed plans</p>
          <p className={styles.statValue}>{formatDecimal(portfolio.invested, portfolio.currency)}</p>
          <p className={styles.statHint}>{portfolio.activeInvestments} active plan{portfolio.activeInvestments === 1 ? "" : "s"}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Unrealised return</p>
          <p className={styles.statValue} style={{ color: returnsMinor >= 0 ? "#146b32" : "#a12b2b" }}>
            {formatSignedMinor(returnsMinor, portfolio.currency)}
          </p>
          <p className={styles.statHint}>
            Today {formatSignedMinor(todayMinor, portfolio.currency)}
          </p>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="performance">
          <div className={styles.panelHead}>
            <h2 id="performance" className={styles.panelTitle}>Performance history</h2>
            <span className={styles.muted}>Daily snapshots</span>
          </div>
          <AreaChart
            points={portfolio.history.map((point) => ({
              label: point.asOf.slice(5),
              value: (decimalToMinor(point.totalValue) ?? 0) / 100,
            }))}
          />
        </section>

        <section className={styles.panel} aria-labelledby="allocation">
          <div className={styles.panelHead}>
            <h2 id="allocation" className={styles.panelTitle}>Asset allocation</h2>
          </div>
          <AllocationDonut slices={portfolio.allocation} />
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="holdings">
        <div className={styles.panelHead}>
          <h2 id="holdings" className={styles.panelTitle}>Holdings</h2>
          <Link href="/dashboard/sell" className={styles.panelLink}>Sell an investment</Link>
        </div>
        {portfolio.holdings.length === 0 ? (
          <EmptyState
            title="No open holdings"
            text="Market orders become holdings once operations fill them. Browse the market to place a buy order."
            action={<Link href="/dashboard/buy" className={styles.cta}>Browse instruments</Link>}
          />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col">Account</th>
                  <th scope="col" className={styles.num}>Quantity</th>
                  <th scope="col" className={styles.num}>Avg cost</th>
                  <th scope="col" className={styles.num}>Price</th>
                  <th scope="col" className={styles.num}>Value</th>
                  <th scope="col" className={styles.num}>Unrealised</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((holding) => {
                  const unrealised = decimalToMinor(holding.unrealised) ?? 0;
                  return (
                    <tr key={holding.id}>
                      <td data-label="Instrument">
                        <div>{holding.symbol} · {holding.name}</div>
                        <div className={styles.muted}>
                          {holding.assetClass.replace(/_/g, " ")}
                          {holding.isDemo ? " · simulated quote" : ""}
                        </div>
                      </td>
                      <td data-label="Account" className={styles.mono}>{holding.accountNumber ?? "—"}</td>
                      <td data-label="Quantity" className={styles.num}>{Number(holding.quantity).toLocaleString("en-US")}</td>
                      <td data-label="Avg cost" className={styles.num}>{formatDecimal(holding.averageCost, holding.currency)}</td>
                      <td data-label="Price" className={styles.num}>{formatDecimal(holding.price, holding.currency)}</td>
                      <td data-label="Value" className={styles.num}>{formatDecimal(holding.marketValue, holding.currency)}</td>
                      <td data-label="Unrealised" className={styles.num} style={{ color: unrealised >= 0 ? "#146b32" : "#a12b2b" }}>
                        {formatSignedMinor(unrealised, holding.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="pending-orders">
        <div className={styles.panelHead}>
          <h2 id="pending-orders" className={styles.panelTitle}>Orders awaiting settlement</h2>
          <Link href="/dashboard/markets" className={styles.panelLink}>Markets</Link>
        </div>
        {portfolio.pendingOrders.length === 0 ? (
          <EmptyState title="Nothing pending" text="Buy and sell orders awaiting review will appear here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Side</th>
                  <th scope="col" className={styles.num}>Quantity</th>
                  <th scope="col" className={styles.num}>Notional</th>
                  <th scope="col">Status</th>
                  <th scope="col">Placed</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.pendingOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Reference" className={styles.mono}>{order.reference}</td>
                    <td data-label="Instrument">{order.instrumentSymbol}</td>
                    <td data-label="Side" style={{ textTransform: "capitalize" }}>{order.side}</td>
                    <td data-label="Quantity" className={styles.num}>{Number(order.quantity).toLocaleString("en-US")}</td>
                    <td data-label="Notional" className={styles.num}>{formatDecimal(order.notional, order.currency)}</td>
                    <td data-label="Status"><StatusBadge status={order.status} /></td>
                    <td data-label="Placed">{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Valuations use the latest recorded quote per instrument. {portfolio.hasDemoData ? "Some holdings use simulated market data, labelled above. " : ""}
        Unrealised return compares market value with cost basis and is not a realised gain or a forecast. Today&apos;s change is
        derived from the latest percentage change for each holding.
      </p>
      {portfolio.history.length === 0 && <p className={styles.muted}>Snapshot date: {formatDate(new Date())}</p>}
    </>
  );
}
