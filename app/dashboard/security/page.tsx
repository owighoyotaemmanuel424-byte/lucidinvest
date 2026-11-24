import PageHeader from "@/components/dashboard/PageHeader";
import RevokeSessions from "@/components/dashboard/RevokeSessions";
import ChangePasswordForm from "@/components/dashboard/ChangePasswordForm";
import TwoFactorPanel from "@/components/dashboard/TwoFactorPanel";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { getSecurityOverview } from "@/lib/customer-services";
import { formatDateTime, getSessions } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardSecurityPage() {
  const user = await requireUser();
  const [sessions, security] = await Promise.all([getSessions(user.id), getSecurityOverview(user.id)]);

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Account security"
        lead="Change your password, enable two-factor authentication and review where your account has been used."
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="change-password">
          <div className={styles.panelHead}>
            <h2 id="change-password" className={styles.panelTitle}>Change password</h2>
            <span className={styles.muted}>At least 12 characters</span>
          </div>
          <ChangePasswordForm />
        </section>

        <section className={styles.panel} aria-labelledby="two-factor">
          <h2 id="two-factor" className={styles.panelTitle}>Two-factor authentication</h2>
          <TwoFactorPanel enabled={security.twoFactorEnabled} />
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="sessions">
        <div className={styles.panelHead}>
          <h2 id="sessions" className={styles.panelTitle}>
            {sessions.length} active session{sessions.length === 1 ? "" : "s"}
          </h2>
          <RevokeSessions otherSessions={Math.max(sessions.length - 1, 0)} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Started</th>
                <th scope="col">Last seen</th>
                <th scope="col">Expires</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{formatDateTime(session.created_at)}</td>
                  <td>{formatDateTime(session.last_seen_at)}</td>
                  <td>{formatDateTime(session.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="login-history">
        <div className={styles.panelHead}>
          <h2 id="login-history" className={styles.panelTitle}>Login history</h2>
          <span className={styles.muted}>Most recent 20 attempts</span>
        </div>
        {security.logins.length === 0 ? (
          <p className={styles.muted}>No sign-in attempts have been recorded for this account yet.</p>
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Result</th>
                  <th scope="col">IP address</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {security.logins.map((event) => (
                  <tr key={event.id}>
                    <td data-label="When">{formatDateTime(event.createdAt)}</td>
                    <td data-label="Result" style={{ color: event.success ? "#146b32" : "#a12b2b" }}>
                      {event.success ? "Signed in" : "Failed"}
                    </td>
                    <td data-label="IP address" className={styles.mono}>{event.ip ?? "—"}</td>
                    <td data-label="Detail" className={styles.muted}>{event.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="security-notes">
        <h2 id="security-notes" className={styles.panelTitle}>How your account is protected</h2>
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Password storage</dt>
            <dd className={styles.detailValue}>scrypt hash with a per-account salt</dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Session cookies</dt>
            <dd className={styles.detailValue}>Signed, HttpOnly, SameSite=Lax, 7-day expiry</dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Session records</dt>
            <dd className={styles.detailValue}>Stored as SHA-256 digests, never as raw tokens</dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailKey}>Write protection</dt>
            <dd className={styles.detailValue}>Same-origin checks on every state-changing request</dd>
          </div>
        </dl>
      </section>

      <p className={styles.notice}>
        If you see a session you do not recognise, change your password here and sign out the other devices. A failed
        sign-in attempt is still recorded in your login history.
      </p>
    </>
  );
}
