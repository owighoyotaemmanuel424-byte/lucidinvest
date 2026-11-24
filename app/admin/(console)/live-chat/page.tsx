import PageHeader from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import LiveChatConfigForm from "@/components/admin/LiveChatConfigForm";
import { requireAdmin } from "@/lib/auth";
import { getLiveChatSettings } from "@/lib/admin-platform";

export const dynamic = "force-dynamic";

export default async function AdminLiveChatPage() {
  await requireAdmin();
  const saved = await getLiveChatSettings();

  return (
    <>
      <PageHeader
        eyebrow="Customer experience"
        title="Live chat configuration"
        lead="Manage the customer-facing website chat launcher and connect your Tawk.to property without editing application code."
      />
      <section className={styles.panel} aria-labelledby="chat-status">
        <div className={styles.panelHead}>
          <div>
            <h2 id="chat-status" className={styles.panelTitle}>Website chat widget</h2>
            <p className={styles.muted} style={{ margin: "5px 0 0" }}>Changes apply to the public website after the next page load.</p>
          </div>
          <span className={saved.enabled ? styles.badgeActive : styles.badge}>{saved.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <LiveChatConfigForm initial={saved} />
      </section>
      <section className={styles.panel} aria-labelledby="chat-checklist">
        <h2 id="chat-checklist" className={styles.panelTitle}>Setup checklist</h2>
        <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 9, color: "var(--li-ink, #20364a)", fontSize: 14, lineHeight: 1.6 }}>
          <li>Copy the Property ID and Widget ID from your Tawk.to widget installation settings.</li>
          <li>Paste both identifiers above and enable the chat launcher.</li>
          <li>Save, then open the public website in a fresh tab to verify the launcher.</li>
          <li>Manage agent availability, chat routing, and canned responses inside your Tawk.to dashboard.</li>
        </ol>
        <p className={styles.hint}>The chat provider handles visitor conversations. This page controls the embedded widget and does not store chat transcripts or provider passwords.</p>
      </section>
    </>
  );
}
