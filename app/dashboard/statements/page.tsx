import PageHeader from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { CUSTOMER_REPORTS } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        eyebrow="Statements"
        title="Statements & reports"
        lead="Download the records behind your dashboard. Every export is generated from the same database rows, in CSV or PDF."
      />

      <section className={styles.panel} aria-labelledby="statement-list">
        <h2 id="statement-list" className={styles.panelTitle}>Available reports</h2>
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
              {CUSTOMER_REPORTS.map((report) => (
                <tr key={report.key}>
                  <td data-label="Report">{report.label}</td>
                  <td data-label="Contents" className={styles.muted}>
                    {report.key === "portfolio_performance"
                      ? "Daily portfolio snapshots, values and unrealised return."
                      : report.key === "investment_statement"
                        ? "Managed plan requests, principal, risk and status."
                        : report.key === "account_statement"
                          ? "Every account with its ledger balance and status."
                          : "Posted and pending ledger entries with references."}
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

      <p className={styles.notice}>
        Statements reflect posted ledger records and the latest recorded valuations at the time you download them. They
        are not tax documents. Portfolio values that use simulated market data are labelled in the export.
      </p>
    </>
  );
}
