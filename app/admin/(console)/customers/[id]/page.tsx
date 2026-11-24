import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import StatusActions from "@/components/admin/StatusActions";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { getCustomerDetail } from "@/lib/admin-platform";
import { formatDate, formatDateTime } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Customer"
        title={customer.fullName}
        lead={`${customer.email} · joined ${formatDate(customer.createdAt)} · last sign-in ${customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : "never"}`}
        action={<Link href="/admin/customers" className={`${styles.cta} ${styles.ctaGhost}`}>All customers</Link>}
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="customer-profile">
          <div className={styles.panelHead}>
            <h2 id="customer-profile" className={styles.panelTitle}>Account</h2>
            <div className={styles.formActions}>
              <StatusBadge status={customer.status} />
              <span className={styles.badge}>{customer.role}</span>
            </div>
          </div>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Identity verification</dt>
              <dd className={styles.detailValue}>
                {customer.kycStatus ? <StatusBadge status={customer.kycStatus} /> : "Not submitted"}
              </dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Two-factor authentication</dt>
              <dd className={styles.detailValue}>{customer.twoFactorEnabled ? "Enabled" : "Not enabled"}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Support tickets</dt>
              <dd className={styles.detailValue}>{customer.tickets}</dd>
            </div>
          </dl>
          {customer.role === "customer" && (
            <StatusActions
              endpoint={`/api/admin/customers/${customer.id}`}
              record={customer.email}
              options={[
                { value: "active", label: "Activate" },
                { value: "suspended", label: "Suspend" },
                { value: "closed", label: "Close" },
              ]}
            />
          )}
        </section>

        <section className={styles.panel} aria-labelledby="customer-wallet">
          <h2 id="customer-wallet" className={styles.panelTitle}>Wallet</h2>
          {customer.wallet ? (
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Wallet number</dt>
                <dd className={styles.detailValue}><span className={styles.mono}>{customer.wallet.number}</span></dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Balance</dt>
                <dd className={styles.detailValue}>{formatDecimal(customer.wallet.balance, customer.wallet.currency)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Status</dt>
                <dd className={styles.detailValue}><StatusBadge status={customer.wallet.status} /></dd>
              </div>
            </dl>
          ) : (
            <p className={styles.muted}>No wallet has been provisioned.</p>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="customer-accounts">
        <h2 id="customer-accounts" className={styles.panelTitle}>Investor accounts</h2>
        {customer.accounts.length === 0 ? (
          <EmptyState title="No accounts" text="This customer has not opened an account." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {customer.accounts.map((account) => (
                  <tr key={account.id}>
                    <td data-label="Number" className={styles.mono}>{account.number ?? "—"}</td>
                    <td data-label="Type" style={{ textTransform: "capitalize" }}>{account.type}</td>
                    <td data-label="Status"><StatusBadge status={account.status} /></td>
                    <td data-label="Balance" className={styles.num}>{formatDecimal(account.balance, account.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="customer-investments">
          <h2 id="customer-investments" className={styles.panelTitle}>Investments</h2>
          {customer.investments.length === 0 ? (
            <p className={styles.muted}>No investment requests.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Status</th>
                    <th scope="col" className={styles.num}>Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.investments.map((investment) => (
                    <tr key={investment.id}>
                      <td>{investment.product}</td>
                      <td><StatusBadge status={investment.status} /></td>
                      <td className={styles.num}>{formatDecimal(investment.principal, investment.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="customer-orders">
          <h2 id="customer-orders" className={styles.panelTitle}>Market orders</h2>
          {customer.orders.length === 0 ? (
            <p className={styles.muted}>No market orders.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Instrument</th>
                    <th scope="col">Side</th>
                    <th scope="col">Status</th>
                    <th scope="col" className={styles.num}>Notional</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id}>
                      <td className={styles.mono}>{order.reference}</td>
                      <td>{order.symbol}</td>
                      <td style={{ textTransform: "capitalize" }}>{order.side}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className={styles.num}>{formatDecimal(order.notional, "USD")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="customer-activity">
        <h2 id="customer-activity" className={styles.panelTitle}>Recent ledger activity</h2>
        {customer.recentLedger.length === 0 ? (
          <p className={styles.muted}>No ledger entries.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col" className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {customer.recentLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>{entry.description}</td>
                    <td className={styles.num}>{formatDecimal(entry.amount, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        This view is read-only except for account status. Balances can never be edited here; corrections must go through
        the ledger workflow.
      </p>
    </>
  );
}
