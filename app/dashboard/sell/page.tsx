import Link from "next/link";
import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import OrderTicket from "@/components/dashboard/OrderTicket";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { getHoldings } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";
import { getWalletOverview } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function SellPage({ searchParams }: { searchParams: Promise<{ instrument?: string }> }) {
  const user = await requireUser();
  const [{ instrument }, holdings, overview] = await Promise.all([
    searchParams,
    getHoldings(user.id),
    getWalletOverview(user.id),
  ]);

  const sellable = Array.from(
    new Map(
      holdings.map((holding) => [
        holding.instrumentId,
        {
          id: holding.instrumentId,
          symbol: holding.symbol,
          name: holding.name,
          price: holding.price,
          currency: holding.currency,
          assetClass: holding.assetClass,
          isDemo: holding.isDemo,
        },
      ]),
    ).values(),
  );

  const accounts = overview.realAccounts.map((account) => ({
    id: account.id,
    accountNumber: account.accountNumber,
    currency: account.currency,
    balance: formatDecimal(account.balance, account.currency),
    status: account.status,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title="Sell investments"
        lead="Sell part or all of a holding. A sell order is reviewed and settled at the last recorded quote."
        action={<Link href="/dashboard/buy" className={`${styles.cta} ${styles.ctaGhost}`}>Buy instead</Link>}
      />

      <section className={styles.panel} aria-labelledby="sell-ticket">
        <h2 id="sell-ticket" className={styles.panelTitle}>Sell ticket</h2>
        {sellable.length === 0 ? (
          <EmptyState
            title="Nothing to sell"
            text="You can sell an instrument once a buy order has been filled and the holding appears."
            action={<Link href="/dashboard/buy" className={styles.cta}>Buy investments</Link>}
          />
        ) : accounts.length === 0 ? (
          <EmptyState title="No account" text="An active account is required to settle a sale." />
        ) : (
          <OrderTicket side="sell" initialInstrumentId={instrument} instruments={sellable} accounts={accounts} />
        )}
      </section>

      <section className={styles.panel} aria-labelledby="sellable-holdings">
        <div className={styles.panelHead}>
          <h2 id="sellable-holdings" className={styles.panelTitle}>Your holdings</h2>
          <Link href="/dashboard/portfolio" className={styles.panelLink}>Portfolio</Link>
        </div>
        {holdings.length === 0 ? (
          <EmptyState title="No holdings" text="Filled buy orders create holdings you can sell here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col" className={styles.num}>Quantity</th>
                  <th scope="col" className={styles.num}>Avg cost</th>
                  <th scope="col" className={styles.num}>Market value</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.id}>
                    <td data-label="Instrument">{holding.symbol} · {holding.name}</td>
                    <td data-label="Quantity" className={styles.num}>{Number(holding.quantity).toLocaleString("en-US")}</td>
                    <td data-label="Avg cost" className={styles.num}>{formatDecimal(holding.averageCost, holding.currency)}</td>
                    <td data-label="Market value" className={styles.num}>{formatDecimal(holding.marketValue, holding.currency)}</td>
                    <td data-label="Data">{holding.isDemo ? "simulated quote" : "recorded quote"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        A sell order is rejected at settlement if the holding no longer covers the quantity. Proceeds are credited to
        your account when the order is filled.
      </p>
    </>
  );
}
