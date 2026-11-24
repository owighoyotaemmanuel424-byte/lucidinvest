import Link from "next/link";
import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { listInstruments } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

const CLASS_LABELS: Record<string, string> = {
  stock: "Stocks",
  etf: "ETFs",
  bond: "Bonds",
  mutual_fund: "Mutual funds",
  crypto: "Cryptocurrency",
};

export default async function DashboardMarketsPage() {
  await requireUser();
  const instruments = await listInstruments();
  const groups = Array.from(new Set(instruments.map((instrument) => instrument.assetClass)));
  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <>
      <PageHeader
        eyebrow="Markets"
        title="Market instruments"
        lead="Indicative quotes for the instruments available on the marketplace. Simulated prices are labelled; there is no direct market-data feed in this deployment."
        action={<Link href="/dashboard/buy" className={styles.cta}>Place a buy order</Link>}
      />

      {instruments.length === 0 ? (
        <EmptyState title="No instruments published" text="Instruments appear once market data has been recorded." />
      ) : (
        groups.map((group) => (
          <section key={group} className={styles.panel} aria-labelledby={`class-${group}`}>
            <div className={styles.panelHead}>
              <h2 id={`class-${group}`} className={styles.panelTitle}>{CLASS_LABELS[group] ?? group}</h2>
              <span className={styles.muted}>
                {instruments.filter((instrument) => instrument.assetClass === group).length} instrument(s)
              </span>
            </div>
            <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Symbol</th>
                    <th scope="col">Name</th>
                    <th scope="col">Exchange / sector</th>
                    <th scope="col" className={styles.num}>Price</th>
                    <th scope="col" className={styles.num}>Change</th>
                    <th scope="col">Data</th>
                    <th scope="col">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {instruments
                    .filter((instrument) => instrument.assetClass === group)
                    .map((instrument) => {
                      const change = Number(instrument.changePercent ?? 0);
                      return (
                        <tr key={instrument.id}>
                          <td data-label="Symbol" className={styles.mono}>{instrument.symbol}</td>
                          <td data-label="Name">{instrument.name}</td>
                          <td data-label="Exchange / sector" className={styles.muted}>
                            {instrument.exchange ?? "—"}{instrument.sector ? ` · ${instrument.sector}` : ""}
                          </td>
                          <td data-label="Price" className={styles.num}>{formatDecimal(instrument.price, instrument.currency)}</td>
                          <td data-label="Change" className={styles.num} style={{ color: change >= 0 ? "#146b32" : "#a12b2b" }}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                          </td>
                          <td data-label="Data">
                            <span className={styles.badge}>{instrument.isDemo ? "simulated" : "recorded"}</span>
                          </td>
                          <td data-label="Trade">
                            <div className={styles.formActions} style={{ gap: 8 }}>
                              <Link href={`/dashboard/buy?instrument=${instrument.id}`} className={styles.panelLink}>Buy</Link>
                              <Link href={`/dashboard/sell?instrument=${instrument.id}`} className={styles.panelLink}>Sell</Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {demoMode && (
        <p className={styles.notice}>
          <strong>Demo mode:</strong> simulated investment activity is enabled on this deployment. Quotes marked
          simulated are sample data and order settlement is a review exercise, not live execution.
        </p>
      )}

      <p className={styles.notice}>
        Prices are indicative records used for order review, not live execution prices. Orders are settled by our
        operations team at the last recorded quote and post a balanced ledger transaction.
      </p>
    </>
  );
}
