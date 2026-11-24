import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listAllReferrals } from "@/lib/customer-services";
import { formatDate } from "@/lib/dashboard";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  await requireAdmin();
  const referrals = await listAllReferrals(200);

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Referrals"
        lead="Referral invitations and conversions. A reward is only recorded after review; no balance is credited automatically."
      />

      <section className={styles.panel} aria-labelledby="referral-list">
        <div className={styles.panelHead}>
          <h2 id="referral-list" className={styles.panelTitle}>{referrals.length} referral{referrals.length === 1 ? "" : "s"}</h2>
        </div>
        {referrals.length === 0 ? (
          <EmptyState title="No referrals" text="Invitations recorded by customers appear here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Referrer</th>
                  <th scope="col">Invited</th>
                  <th scope="col">Code</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Reward</th>
                  <th scope="col">Created</th>
                  <th scope="col">Converted</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td data-label="Referrer">
                      <div>{referral.referrerName}</div>
                      <div className={styles.muted}>{referral.referrerEmail}</div>
                    </td>
                    <td data-label="Invited">{referral.referredEmail}</td>
                    <td data-label="Code" className={styles.mono}>{referral.code}</td>
                    <td data-label="Status"><StatusBadge status={referral.status} /></td>
                    <td data-label="Reward" className={styles.num}>{formatDecimal(referral.rewardAmount, "USD")}</td>
                    <td data-label="Created">{formatDate(referral.createdAt)}</td>
                    <td data-label="Converted">{referral.convertedAt ? formatDate(referral.convertedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Reward amounts are configuration, not accrued money. Any payout must go through the normal approved adjustment
        process and be recorded.
      </p>
    </>
  );
}
