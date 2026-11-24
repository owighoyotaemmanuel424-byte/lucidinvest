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
        lead="Choose and configure the customer-facing live chat provider without editing application code."
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
          <li>Select Tawk.to, Crisp, Intercom, or Chatwoot from the provider list.</li>
          <li>Copy the public website embed identifier from that provider's installation settings.</li>
          <li>For Chatwoot, also enter your HTTPS installation URL.</li>
          <li>Save, then open the public website in a fresh tab to verify the launcher.</li>
          <li>Manage availability, routing, and conversations inside the selected provider's inbox.</li>
        </ol>
        <p className={styles.hint}>Only one provider is loaded at a time. This page stores public embed identifiers, not passwords, private API keys, or chat transcripts.</p>
      </section>
    </>
  );
}
