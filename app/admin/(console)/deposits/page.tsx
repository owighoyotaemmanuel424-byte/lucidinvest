import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import StatusActions from "@/components/admin/StatusActions";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";
import { getAdminWalletRequests } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  await requireAdmin();
  const requests = (await getAdminWalletRequests(200)).filter((request) => request.kind === "deposit");
  const pending = requests.filter((request) => request.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Deposits"
        lead="Confirm deposits only after the funds have arrived. Approval posts one wallet entry and its audit event in a single statement."
      />

      <section className={styles.stats} aria-label="Deposit summary">
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

      <section className={styles.panel} aria-labelledby="deposit-queue">
        <h2 id="deposit-queue" className={styles.panelTitle}>Deposit requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No deposits" text="Customer deposit instructions appear here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Requested</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Note</th>
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
                    <td data-label="Note" className={styles.muted}>{request.note ?? "—"}</td>
                    <td data-label="Status"><StatusBadge status={request.status} /></td>
                    <td data-label="Amount" className={styles.num}>{formatDecimal(request.amount, request.currency)}</td>
                    <td data-label="Review">
                      {request.status === "pending" ? (
                        <StatusActions
                          endpoint={`/api/admin/wallet-requests/${request.id}`}
                          record={`${request.reference} (${request.customerEmail})`}
                          options={[
                            { value: "posted", label: "Confirm received" },
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
        Confirming a deposit where the funds have not arrived creates a real obligation. Never edit a balance directly;
        approve the request so the ledger entry and audit row land together.
      </p>
    </>
  );
}
