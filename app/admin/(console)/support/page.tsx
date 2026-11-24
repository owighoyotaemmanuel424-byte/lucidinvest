import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { getTicketMessages, listAllTickets } from "@/lib/customer-services";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireAdmin();
  const tickets = await listAllTickets();
  const threads = await Promise.all(
    tickets.map(async (ticket) => ({ ticket, messages: await getTicketMessages(ticket.id) })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        lead="Reply to customers and move tickets through the support workflow. Every reply notifies the customer and records an audit event."
      />

      {threads.length === 0 ? (
        <EmptyState title="No tickets" text="Customer support requests appear here." />
      ) : (
        threads.map(({ ticket, messages }) => (
          <section key={ticket.id} className={styles.panel} aria-labelledby={`ticket-${ticket.id}`}>
            <div className={styles.panelHead}>
              <div>
                <h2 id={`ticket-${ticket.id}`} className={styles.panelTitle}>{ticket.subject}</h2>
                <p className={styles.muted} style={{ margin: "4px 0 0" }}>
                  <span className={styles.mono}>{ticket.reference}</span> · {ticket.customerName} · {ticket.customerEmail} ·{" "}
                  {formatDateTime(ticket.createdAt)}
                </p>
              </div>
              <div className={styles.formActions}>
                <StatusBadge status={ticket.status} />
                <span className={styles.badge}>{ticket.priority}</span>
              </div>
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
                    {message.isStaff ? `Staff · ${message.authorName ?? "team"}` : `Customer · ${message.authorName ?? ticket.customerName}`} ·{" "}
                    {formatDateTime(message.createdAt)}
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{message.body}</p>
                </li>
              ))}
            </ul>

            <JsonForm
              endpoint={`/api/support/tickets/${ticket.id}`}
              fields={[
                { name: "body", label: "Reply to customer", type: "textarea", rows: 3, required: true },
                {
                  name: "status",
                  label: "Set status",
                  type: "select",
                  options: [
                    { value: "", label: "Leave unchanged" },
                    { value: "in_progress", label: "In progress" },
                    { value: "resolved", label: "Resolved" },
                    { value: "closed", label: "Closed" },
                    { value: "open", label: "Open" },
                  ],
                },
              ]}
              submitLabel="Send reply"
              successText="Reply sent and the customer notified."
            />
          </section>
        ))
      )}
    </>
  );
}
