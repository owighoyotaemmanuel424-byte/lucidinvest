import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dashboard";
import { ensureReferralCode, listReferrals } from "@/lib/customer-services";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const user = await requireUser();
  const [code, referrals] = await Promise.all([ensureReferralCode(user.id), listReferrals(user.id)]);
  const converted = referrals.filter((referral) => referral.status === "converted" || referral.status === "rewarded").length;

  return (
    <>
      <PageHeader
        eyebrow="Referrals"
        title="Invite an investor"
        lead="Share your code when someone registers. Referral rewards are only paid after review; no reward is promised by inviting someone."
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="referral-code">
          <h2 id="referral-code" className={styles.panelTitle}>Your referral code</h2>
          <p className={styles.mono} style={{ fontSize: 24, fontWeight: 750, margin: 0, letterSpacing: 1 }}>{code}</p>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Invitations</dt>
              <dd className={styles.detailValue}>{referrals.length}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Registered</dt>
              <dd className={styles.detailValue}>{converted}</dd>
            </div>
          </dl>
          <p className={styles.hint}>
            The code can be entered on the registration form. Rewards, if any, are configured by the platform and
            recorded against each referral — this page does not credit a balance.
          </p>
        </section>

        <section className={styles.panel} aria-labelledby="invite">
          <h2 id="invite" className={styles.panelTitle}>Record an invitation</h2>
          <JsonForm
            endpoint="/api/referrals"
            fields={[
              { name: "email", label: "Email address", type: "email", required: true, placeholder: "friend@example.com" },
            ]}
            submitLabel="Record invitation"
            successText="Invitation recorded. It is marked converted when that address registers with your code."
          />
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="referral-list">
        <h2 id="referral-list" className={styles.panelTitle}>Invitation history</h2>
        {referrals.length === 0 ? (
          <EmptyState title="No invitations yet" text="Invitations you record appear here with their status." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Invited</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Reward</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td data-label="Invited">{referral.referredEmail}</td>
                    <td data-label="Status"><StatusBadge status={referral.status} /></td>
                    <td data-label="Reward" className={styles.num}>{formatDecimal(referral.rewardAmount, "USD")}</td>
                    <td data-label="Recorded">{formatDate(referral.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
