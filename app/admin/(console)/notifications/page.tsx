import PageHeader from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        eyebrow="Communications"
        title="Notifications"
        lead="Send an in-app notification to every active customer. Each customer receives their own record with independent read state."
      />

      <section className={styles.panel} aria-labelledby="broadcast">
        <h2 id="broadcast" className={styles.panelTitle}>Broadcast to active customers</h2>
        <JsonForm
          endpoint="/api/admin/notifications"
          fields={[
            { name: "title", label: "Title", required: true, placeholder: "Scheduled maintenance" },
            {
              name: "body",
              label: "Message",
              type: "textarea",
              required: true,
              rows: 4,
              placeholder: "What customers need to know, and what they should do.",
            },
          ]}
          submitLabel="Send notification"
          successText="Notification created for every active customer."
          confirmText="Send this notification to every active customer?"
        />
      </section>

      <p className={styles.notice}>
        Notifications are informational only. They cannot move money, change verification status or approve a request.
        Avoid including account numbers, balances or personal data in a broadcast.
      </p>
    </>
  );
}
