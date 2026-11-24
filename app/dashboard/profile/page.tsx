import { redirect } from "next/navigation";
import PageHeader, { StatusBadge } from "@/components/dashboard/PageHeader";
import ProfileForm from "@/components/dashboard/ProfileForm";
import KycDocumentUpload from "@/components/dashboard/KycDocumentUpload";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { getKycForUser } from "@/lib/customer-services";
import { formatDate, formatDateTime, getProfile } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  const user = await requireUser();
  const [profile, kyc] = await Promise.all([getProfile(user.id), getKycForUser(user.id)]);
  if (!profile) redirect("/login");

  const canSubmit = !kyc || kyc.status === "rejected";

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Your details"
        lead="Keep your name and identity verification up to date. Your sign-in email and account status are managed by our team."
      />

      <div className={styles.split}>
        <ProfileForm initialName={profile.full_name} />

        <section className={styles.panel} aria-labelledby="account-details">
          <h2 id="account-details" className={styles.panelTitle}>Account details</h2>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Customer since</dt>
              <dd className={styles.detailValue}>{formatDate(profile.created_at)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Role</dt>
              <dd className={styles.detailValue} style={{ textTransform: "capitalize" }}>{profile.role}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Account status</dt>
              <dd className={styles.detailValue}><StatusBadge status={profile.status} /></dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Email</dt>
              <dd className={styles.detailValue}>{profile.email}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Identity verification</dt>
              <dd className={styles.detailValue}>
                {kyc ? <StatusBadge status={kyc.status} /> : <span className={styles.muted}>Not started</span>}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="kyc">
        <div className={styles.panelHead}>
          <h2 id="kyc" className={styles.panelTitle}>Identity verification (KYC)</h2>
          {kyc && <StatusBadge status={kyc.status} />}
        </div>

        {kyc ? (
          <>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Legal name</dt>
                <dd className={styles.detailValue}>{kyc.legalName}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Country</dt>
                <dd className={styles.detailValue}>{kyc.country}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Submitted</dt>
                <dd className={styles.detailValue}>{formatDateTime(kyc.submittedAt)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt className={styles.detailKey}>Risk classification</dt>
                <dd className={styles.detailValue} style={{ textTransform: "capitalize" }}>{kyc.riskRating}</dd>
              </div>
              {kyc.reviewedAt && (
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Reviewed</dt>
                  <dd className={styles.detailValue}>{formatDateTime(kyc.reviewedAt)}</dd>
                </div>
              )}
            </dl>
            {kyc.status === "rejected" && kyc.rejectionReason && (
              <p className={styles.notice} style={{ borderColor: "#f3c9c9", background: "#fdf3f3" }}>
                <strong>Why it was rejected:</strong> {kyc.rejectionReason}
              </p>
            )}
            {kyc.status === "approved" && (
              <p className={styles.notice}>Your identity is verified. Contact support if your details change.</p>
            )}
          </>
        ) : (
          <p className={styles.notice}>
            Complete identity verification to unlock the full platform. We collect your legal name, residential address,
            date of birth and source of funds for AML checks. Documents are stored privately.
          </p>
        )}

        {canSubmit && (
          <JsonForm
            endpoint="/api/account/kyc"
            fields={[
              { name: "legalName", label: "Full legal name", required: true, defaultValue: kyc?.legalName ?? profile.full_name },
              { name: "dateOfBirth", label: "Date of birth", type: "date", defaultValue: kyc?.dateOfBirth ?? "" },
              { name: "country", label: "Country of residence", required: true, defaultValue: kyc?.country ?? "" },
              { name: "city", label: "City", defaultValue: kyc?.city ?? "" },
              { name: "addressLine", label: "Residential address", required: true, defaultValue: kyc?.addressLine ?? "" },
              {
                name: "sourceOfFunds",
                label: "Source of funds",
                type: "textarea",
                rows: 2,
                defaultValue: kyc?.sourceOfFunds ?? "",
                help: "Employment income, savings, sale of assets or business income.",
              },
            ]}
            submitLabel={kyc ? "Resubmit verification" : "Submit verification"}
            successText="Verification submitted. Our compliance team will review it."
          />
        )}

        {(!kyc || (kyc && kyc.status !== "approved")) && (
          <div style={{ display: "grid", gap: 10 }}>
            <h3 className={styles.panelTitle} style={{ fontSize: 14.5 }}>Supporting documents</h3>
            {kyc && kyc.documents.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">File</th>
                      <th scope="col">Status</th>
                      <th scope="col">Uploaded</th>
                      <th scope="col">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kyc.documents.map((document) => (
                      <tr key={document.id}>
                        <td data-label="Type" style={{ textTransform: "capitalize" }}>{document.kind.replace(/_/g, " ")}</td>
                        <td data-label="File">{document.fileName}</td>
                        <td data-label="Status"><StatusBadge status={document.status} /></td>
                        <td data-label="Uploaded">{formatDate(document.createdAt)}</td>
                        <td data-label="Download">
                          {document.hasFile ? (
                            <a className={styles.panelLink} href={`/api/kyc/documents/${document.id}`}>Download</a>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {kyc ? (
              <KycDocumentUpload />
            ) : (
              <p className={styles.hint}>Submit your details first, then upload your identity and address documents.</p>
            )}
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Changes to your name are applied immediately and shown across your dashboard. Verification decisions are made by
        our compliance team and recorded in the audit log.
      </p>
    </>
  );
}
