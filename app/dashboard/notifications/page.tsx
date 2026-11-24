import Link from "next/link";
import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import NotificationActions from "@/components/dashboard/NotificationActions";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { listNotifications, unreadNotificationCount } from "@/lib/customer-services";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, string> = {
  success: "#146b32",
  warning: "#8a5a05",
  security: "#a12b2b",
  info: "#0b6b33",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const [notifications, unread] = await Promise.all([
    listNotifications(user.id),
    unreadNotificationCount(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Your notifications"
        lead="Account, investment, wallet and security updates."
        action={<NotificationActions unread={unread} />}
      />

      <section className={styles.panel} aria-labelledby="notification-list">
        <div className={styles.panelHead}>
          <h2 id="notification-list" className={styles.panelTitle}>
            {notifications.length} notification{notifications.length === 1 ? "" : "s"}
          </h2>
          <span className={styles.muted}>{unread} unread</span>
        </div>
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing to report"
            text="Verification outcomes, settlement notices and account alerts will appear here."
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {notifications.map((notification) => (
              <li
                key={notification.id}
                style={{
                  border: "1px solid #e8eee8",
                  borderLeft: `4px solid ${KIND_TONE[notification.kind] ?? "#0b6b33"}`,
                  borderRadius: 12,
                  padding: "13px 15px",
                  background: notification.readAt ? "#ffffff" : "#f7fbf7",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14.5 }}>{notification.title}</strong>
                  <span className={styles.muted}>{formatDateTime(notification.createdAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#43584a" }}>{notification.body}</p>
                {notification.actionUrl && (
                  <Link href={notification.actionUrl} className={styles.panelLink} style={{ fontSize: 12.5 }}>
                    Open
                  </Link>
                )}
                {!notification.readAt && <span className={styles.muted}>Unread</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
