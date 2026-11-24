import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import StatusActions from "@/components/admin/StatusActions";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dashboard";
import { listAllOrders } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await listAllOrders(200);
  const pending = orders.filter((order) => order.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Trading"
        title="Market orders"
        lead="Settle or reject pending buy and sell orders. Filling re-checks cash or holding quantity and posts a balanced ledger transaction."
      />

      <section className={styles.stats} aria-label="Order summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending</p>
          <p className={styles.statValue}>{pending.length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Filled</p>
          <p className={styles.statValue}>{orders.filter((order) => order.status === "filled").length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Cancelled / rejected</p>
          <p className={styles.statValue}>
            {orders.filter((order) => order.status === "cancelled" || order.status === "rejected").length}
          </p>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="order-queue">
        <h2 id="order-queue" className={styles.panelTitle}>Order queue</h2>
        {orders.length === 0 ? (
          <EmptyState title="No orders" text="Customer buy and sell orders appear here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Placed</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Side</th>
                  <th scope="col" className={styles.num}>Quantity</th>
                  <th scope="col" className={styles.num}>Price</th>
                  <th scope="col" className={styles.num}>Notional</th>
                  <th scope="col">Status</th>
                  <th scope="col">Settle</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Placed">{formatDateTime(order.createdAt)}</td>
                    <td data-label="Customer">
                      <div>{order.customerName ?? "—"}</div>
                      <div className={styles.muted}>{order.customerEmail ?? order.accountNumber ?? ""}</div>
                    </td>
                    <td data-label="Instrument">
                      <div>{order.instrumentSymbol}</div>
                      <div className={styles.muted}>{order.instrumentName}</div>
                    </td>
                    <td data-label="Side" style={{ textTransform: "capitalize" }}>{order.side}</td>
                    <td data-label="Quantity" className={styles.num}>{Number(order.quantity).toLocaleString("en-US")}</td>
                    <td data-label="Price" className={styles.num}>{formatDecimal(order.price, order.currency)}</td>
                    <td data-label="Notional" className={styles.num}>{formatDecimal(order.notional, order.currency)}</td>
                    <td data-label="Status"><StatusBadge status={order.status} /></td>
                    <td data-label="Settle">
                      {order.status === "pending" ? (
                        <StatusActions
                          endpoint={`/api/admin/orders/${order.id}`}
                          record={`${order.side} ${order.quantity} ${order.instrumentSymbol} (${order.customerEmail ?? "customer"})`}
                          options={[
                            { value: "filled", label: "Fill order" },
                            { value: "rejected", label: "Reject" },
                          ]}
                        />
                      ) : (
                        <span className={styles.muted}>{order.reference}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Filling an order changes a customer&apos;s cash balance and holdings. Confirm the latest quote is appropriate
        before settling, because the order fills at the price recorded when it was placed.
      </p>
    </>
  );
}
