import Link from "next/link";
import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import OrderTicket from "@/components/dashboard/OrderTicket";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { listInstruments, listOrders } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";
import { getWalletOverview } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ instrument?: string }> }) {
  const user = await requireUser();
  const [{ instrument }, instruments, overview, orders] = await Promise.all([
    searchParams,
    listInstruments(),
    getWalletOverview(user.id),
    listOrders(user.id, 10),
  ]);
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
        eyebrow="Buy"
        title="Buy investments"
        lead="Place a market buy order. It is reviewed and settled by operations at the last recorded quote."
        action={<Link href="/dashboard/sell" className={`${styles.cta} ${styles.ctaGhost}`}>Sell instead</Link>}
      />

      <section className={styles.panel} aria-labelledby="buy-ticket">
        <h2 id="buy-ticket" className={styles.panelTitle}>Buy ticket</h2>
        {accounts.length === 0 ? (
          <EmptyState
            title="No active account"
            text="An active real account in the instrument's currency is required to place an order."
            action={<Link href="/dashboard/accounts" className={styles.cta}>Open an account</Link>}
          />
        ) : (
          <OrderTicket
            side="buy"
            initialInstrumentId={instrument}
            instruments={instruments.map((row) => ({
              id: row.id,
              symbol: row.symbol,
              name: row.name,
              price: row.price,
              currency: row.currency,
              assetClass: row.assetClass,
              isDemo: row.isDemo,
            }))}
            accounts={accounts}
          />
        )}
      </section>

      <section className={styles.panel} aria-labelledby="recent-orders">
        <div className={styles.panelHead}>
          <h2 id="recent-orders" className={styles.panelTitle}>Recent orders</h2>
          <Link href="/dashboard/portfolio" className={styles.panelLink}>Portfolio</Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" text="Your market orders appear here with their review status." />
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
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Reference" className={styles.mono}>{order.reference}</td>
                    <td data-label="Instrument">{order.instrumentSymbol}</td>
                    <td data-label="Side" style={{ textTransform: "capitalize" }}>{order.side}</td>
                    <td data-label="Quantity" className={styles.num}>{Number(order.quantity).toLocaleString("en-US")}</td>
                    <td data-label="Notional" className={styles.num}>{formatDecimal(order.notional, order.currency)}</td>
                    <td data-label="Status" style={{ textTransform: "capitalize" }}>{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        A buy order reserves its notional against your account while it is pending. Filling it posts a cash debit and a
        platform clearing credit in one balanced ledger transaction. Capital is at risk.
      </p>
    </>
  );
}
