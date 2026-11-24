import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listKycSubmissions } from "@/lib/customer-services";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  await requireAdmin();
  const submissions = await listKycSubmissions();
  const pending = submissions.filter((submission) => submission.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="KYC verification"
        lead="Review identity submissions, supporting documents and source-of-funds declarations. Document downloads are authorised and audited by account."
      />

      <section className={styles.stats} aria-label="KYC summary">
        <div className={styles.stat}>
          <p className={styles.statLabel}>Awaiting review</p>
          <p className={styles.statValue}>{pending.length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Approved</p>
          <p className={styles.statValue}>{submissions.filter((submission) => submission.status === "approved").length}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Rejected</p>
          <p className={styles.statValue}>{submissions.filter((submission) => submission.status === "rejected").length}</p>
        </div>
      </section>

      {submissions.length === 0 ? (
        <EmptyState title="No submissions" text="Customer verification submissions appear here." />
      ) : (
        submissions.map((submission) => (
          <section key={submission.id} className={styles.panel} aria-labelledby={`kyc-${submission.id}`}>
            <div className={styles.panelHead}>
              <div>
                <h2 id={`kyc-${submission.id}`} className={styles.panelTitle}>{submission.legalName}</h2>
                <p className={styles.muted} style={{ margin: "4px 0 0" }}>
                  {submission.customerName} · {submission.customerEmail} · submitted {formatDateTime(submission.submittedAt)}
                </p>
              </div>
              <div className={styles.formActions}>
                <StatusBadge status={submission.status} />
                <span className={styles.badge}>risk: {submission.riskRating}</span>
              </div>
            </div>

            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Country</dt>
                <dd className={styles.detailValue}>{submission.country}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Address</dt>
                <dd className={styles.detailValue}>{submission.addressLine}{submission.city ? `, ${submission.city}` : ""}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Date of birth</dt>
                <dd className={styles.detailValue}>{submission.dateOfBirth ?? "—"}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Source of funds</dt>
                <dd className={styles.detailValue}>{submission.sourceOfFunds ?? "—"}</dd>
              </div>
              {submission.rejectionReason && (
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Rejection reason</dt>
                  <dd className={styles.detailValue}>{submission.rejectionReason}</dd>
                </div>
              )}
            </dl>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Uploaded</th>
                    <th scope="col">File</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.muted}>No documents uploaded.</td>
                    </tr>
                  ) : (
                    submission.documents.map((document) => (
                      <tr key={document.id}>
                        <td data-label="Document">{document.fileName}</td>
                        <td data-label="Type" style={{ textTransform: "capitalize" }}>{document.kind.replace(/_/g, " ")}</td>
                        <td data-label="Status"><StatusBadge status={document.status} /></td>
                        <td data-label="Uploaded">{formatDateTime(document.createdAt)}</td>
                        <td data-label="File">
                          {document.hasFile ? (
                            <a className={styles.panelLink} href={`/api/kyc/documents/${document.id}`}>Download</a>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {submission.status === "pending" && (
              <JsonForm
                endpoint={`/api/admin/kyc/${submission.id}`}
                method="PATCH"
                fields={[
                  {
                    name: "status",
                    label: "Decision",
                    type: "select",
                    required: true,
                    options: [
                      { value: "approved", label: "Approve" },
                      { value: "rejected", label: "Reject" },
                    ],
                  },
                  {
                    name: "riskRating",
                    label: "AML risk classification",
                    type: "select",
                    required: true,
                    defaultValue: "medium",
                    options: [
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                    ],
                  },
                  { name: "rejectionReason", label: "Rejection reason (required to reject)", type: "textarea", rows: 2 },
                  { name: "reviewerNotes", label: "Internal reviewer notes", type: "textarea", rows: 2 },
                ]}
                submitLabel="Record decision"
                successText="Decision recorded and the customer has been notified."
                confirmText="Record this verification decision? It is written to the audit log."
              />
            )}
          </section>
        ))
      )}
    </>
  );
}
