import PageHeader from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_REPORTS, CUSTOMER_REPORTS } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Administrative reports"
        lead="Download the platform's operational records as CSV or PDF. Administrative exports are restricted to administrators."
      />

      <section className={styles.panel} aria-labelledby="admin-reports">
        <h2 id="admin-reports" className={styles.panelTitle}>Administrative reports</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Contents</th>
                <th scope="col">Download</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_REPORTS.map((report) => (
                <tr key={report.key}>
                  <td data-label="Report">{report.label}</td>
                  <td data-label="Contents" className={styles.muted}>
                    {report.key === "admin_activity"
                      ? "Every recorded administrative action with actor and timestamp."
                      : "Customer verification status, risk rating and reviewer decisions."}
                  </td>
                  <td data-label="Download">
                    <div className={styles.formActions} style={{ gap: 12 }}>
                      <a className={styles.panelLink} href={`/api/reports/${report.key}?format=csv`}>CSV</a>
                      <a className={styles.panelLink} href={`/api/reports/${report.key}?format=pdf`}>PDF</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="customer-reports">
        <h2 id="customer-reports" className={styles.panelTitle}>Customer statement formats</h2>
        <p className={styles.muted}>
          Customers can download these from their own Statements page; they are scoped to the signed-in account.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13.5 }}>
          {CUSTOMER_REPORTS.map((report) => (
            <li key={report.key}>{report.label}</li>
          ))}
        </ul>
      </section>

      <p className={styles.notice}>
        Reports contain personal data. Store downloads securely, share only with authorised recipients and delete them
        when no longer needed.
      </p>
    </>
  );
}
