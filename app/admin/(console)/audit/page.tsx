import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listAuditEvents } from "@/lib/admin-platform";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  const events = await listAuditEvents(250);

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit logs"
        lead="Append-only record of sensitive actions: who did what, to which record and when. Events are written in the same statement as the change they describe."
      />

      <section className={styles.panel} aria-labelledby="audit-log">
        <div className={styles.panelHead}>
          <h2 id="audit-log" className={styles.panelTitle}>{events.length} events</h2>
        </div>
        {events.length === 0 ? (
          <EmptyState title="No audit events" text="Sensitive actions will be recorded here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td data-label="When">{formatDateTime(event.createdAt)}</td>
                    <td data-label="Actor" className={styles.muted}>{event.actorEmail ?? "system"}</td>
                    <td data-label="Action" className={styles.mono}>{event.action}</td>
                    <td data-label="Entity">
                      <div>{event.entityType}</div>
                      <div className={styles.muted}>{event.entityId ?? "—"}</div>
                    </td>
                    <td data-label="Details" className={styles.muted} style={{ maxWidth: 360, overflowWrap: "anywhere" }}>
                      <code style={{ fontSize: 12 }}>{JSON.stringify(event.details)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Audit rows are not editable from the console. If a record looks wrong, correct it through the proper workflow so
        the correction is itself audited.
      </p>
    </>
  );
}
