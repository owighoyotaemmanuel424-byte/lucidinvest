import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { getTicketMessages, listTickets } from "@/lib/customer-services";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await listTickets(user.id);
  const threads = await Promise.all(
    tickets.map(async (ticket) => ({ ticket, messages: await getTicketMessages(ticket.id) })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Help & support"
        lead="Open a request and track our replies. Never share your password or full card details in a ticket."
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="new-ticket">
          <h2 id="new-ticket" className={styles.panelTitle}>Open a request</h2>
          <JsonForm
            endpoint="/api/support/tickets"
            fields={[
              { name: "subject", label: "Subject", required: true, max: undefined, placeholder: "Brief description" },
              {
                name: "category",
                label: "Category",
                type: "select",
                required: true,
                defaultValue: "general",
                options: [
                  { value: "general", label: "General" },
                  { value: "account", label: "Account" },
                  { value: "deposit", label: "Deposit" },
                  { value: "withdrawal", label: "Withdrawal" },
                  { value: "investment", label: "Investment" },
                  { value: "security", label: "Security" },
                ],
              },
              { name: "message", label: "How can we help?", type: "textarea", required: true, rows: 5 },
            ]}
            submitLabel="Submit request"
            successText="Your request has been opened. Our team will reply here."
          />
        </section>

        <section className={styles.panel} aria-labelledby="support-guidance">
          <h2 id="support-guidance" className={styles.panelTitle}>Response times</h2>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>General enquiries</dt>
              <dd className={styles.detailValue}>1–2 business days</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Withdrawals</dt>
              <dd className={styles.detailValue}>Reviewed by finance</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Security concerns</dt>
              <dd className={styles.detailValue}>Prioritised</dd>
            </div>
          </dl>
          <p className={styles.notice}>
            We will never ask for your password, one-time codes or remote access to your device. Requests that ask for
            these should be reported as suspicious.
          </p>
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="ticket-list">
        <h2 id="ticket-list" className={styles.panelTitle}>Your requests</h2>
        {threads.length === 0 ? (
          <EmptyState title="No requests yet" text="When you open a support ticket it appears here with the full thread." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {threads.map(({ ticket, messages }) => (
              <article key={ticket.id} style={{ border: "1px solid #e8eee8", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
                <div className={styles.panelHead}>
                  <div>
                    <h3 className={styles.panelTitle}>{ticket.subject}</h3>
                    <p className={styles.muted} style={{ margin: "4px 0 0" }}>
                      <span className={styles.mono}>{ticket.reference}</span> · {ticket.category} · opened {formatDateTime(ticket.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: message.isStaff ? "#f1f8f1" : "#f7f9f7",
                        border: "1px solid #eef3ee",
                      }}
                    >
                      <div className={styles.muted} style={{ marginBottom: 4 }}>
                        {message.isStaff ? "LucidInvest support" : "You"} · {formatDateTime(message.createdAt)}
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{message.body}</p>
                    </li>
                  ))}
                </ul>
                {ticket.status !== "closed" && (
                  <JsonForm
                    endpoint={`/api/support/tickets/${ticket.id}`}
                    fields={[{ name: "body", label: "Reply", type: "textarea", rows: 2, required: true }]}
                    submitLabel="Send reply"
                    successText="Reply sent."
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
