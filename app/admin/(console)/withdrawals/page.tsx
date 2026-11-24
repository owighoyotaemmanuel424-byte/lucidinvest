import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import StatusActions from "@/components/admin/StatusActions";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";
import { getAdminWalletRequests } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const requests = (await getAdminWalletRequests(200)).filter((request) => request.kind === "withdrawal");
  const pending = requests.filter((request) => request.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Withdrawals"
        lead="Review the payout details and wallet balance, then approve or reject. Approval re-checks the balance and posts the debit with its audit row in one statement."
      />

      <section className={styles.stats} aria-label="Withdrawal summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Pending</p>
          <p className={styles.statValue}>{pending.length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Posted</p>
          <p className={styles.statValue}>{requests.filter((request) => request.status === "posted").length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Rejected</p>
          <p className={styles.statValue}>{requests.filter((request) => request.status === "rejected").length}</p>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="withdrawal-queue">
        <h2 id="withdrawal-queue" className={styles.panelTitle}>Withdrawal requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No withdrawals" text="Customer withdrawal requests appear here with their payout details." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Requested</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Payout details</th>
                  <th scope="col" className={styles.num}>Wallet balance</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Amount</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td data-label="Requested">{formatDateTime(request.createdAt)}</td>
                    <td data-label="Customer">
                      <div>{request.customerName}</div>
                      <div className={styles.muted}>{request.customerEmail}</div>
                    </td>
                    <td data-label="Reference" className={styles.mono}>{request.reference}</td>
                    <td data-label="Payout details" className={styles.muted}>{request.note ?? "—"}</td>
                    <td data-label="Wallet balance" className={styles.num}>{formatDecimal(request.walletBalance, request.currency)}</td>
                    <td data-label="Status"><StatusBadge status={request.status} /></td>
                    <td data-label="Amount" className={styles.num}>{formatDecimal(request.amount, request.currency)}</td>
                    <td data-label="Review">
                      {request.status === "pending" ? (
                        <StatusActions
                          endpoint={`/api/admin/wallet-requests/${request.id}`}
                          record={`${request.reference} (${request.customerEmail})`}
                          options={[
                            { value: "posted", label: "Approve payout" },
                            { value: "rejected", label: "Reject" },
                          ]}
                        />
                      ) : (
                        <span className={styles.muted}>{request.processedAt ? formatDateTime(request.processedAt) : "—"}</span>
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
        No payment provider is connected to this deployment. Approval records the debit and the authorisation; paying the
        customer is still executed by your treasury process outside the platform.
      </p>
    </>
  );
}
