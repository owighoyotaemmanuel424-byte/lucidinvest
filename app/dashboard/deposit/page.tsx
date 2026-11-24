import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import MoneyRequestPanel from "@/components/dashboard/MoneyRequestPanel";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dashboard";
import { decimalToMinor, formatDecimal, formatMinor } from "@/lib/money";
import { getWalletOverview, getWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function DepositPage() {
  const user = await requireUser();
  const [overview, history] = await Promise.all([
    getWalletOverview(user.id),
    getWalletTransactions(user.id, { kind: "deposit", pageSize: 20 }),
  ]);
  const { wallet, pendingRequests } = overview;
  const heldMinor = pendingRequests
    .filter((request) => request.kind === "withdrawal")
    .reduce((total, request) => total + (decimalToMinor(request.amount) ?? 0), 0);
  const available = Math.max(0, (decimalToMinor(wallet.balance) ?? 0) - heldMinor);

  return (
    <>
      <PageHeader
        eyebrow="Funding"
        title="Deposit funds"
        lead="Record a bank transfer or approved payment instruction. Finance confirms receipt before your balance changes."
        action={<Link href="/dashboard/withdraw" className={`${styles.cta} ${styles.ctaGhost}`}>Withdraw instead</Link>}
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="deposit-form">
          <div className={styles.panelHead}>
            <h2 id="deposit-form" className={styles.panelTitle}>New deposit request</h2>
            <StatusBadge status={wallet.status} />
          </div>
          <MoneyRequestPanel
            kind="deposit"
            currency={wallet.currency}
            walletNumber={wallet.walletNumber}
            available={formatMinor(available, wallet.currency)}
          />
        </section>

        <section className={styles.panel} aria-labelledby="deposit-balance">
          <h2 id="deposit-balance" className={styles.panelTitle}>Wallet</h2>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Wallet balance</dt>
              <dd className={styles.detailValue}>{formatDecimal(wallet.balance, wallet.currency)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Available after pending withdrawals</dt>
              <dd className={styles.detailValue}>{formatMinor(available, wallet.currency)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Wallet number</dt>
              <dd className={styles.detailValue}><span className={styles.mono}>{wallet.walletNumber}</span></dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailKey}>Currency</dt>
              <dd className={styles.detailValue}>{wallet.currency}</dd>
            </div>
          </dl>
          <p className={styles.notice}>
            Bank transfer is the supported deposit method in this deployment. No card processor or open-banking provider
            is connected, so there is no instant crediting. Never send funds to details that did not come from our
            verified contact channels.
          </p>
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="deposit-history">
        <div className={styles.panelHead}>
          <h2 id="deposit-history" className={styles.panelTitle}>Deposit history</h2>
          <Link href="/dashboard/statements" className={styles.panelLink}>Download statement</Link>
        </div>
        {history.entries.length === 0 ? (
          <EmptyState title="No deposits yet" text="Confirmed deposits and pending requests will be listed here." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Date">{formatDate(entry.createdAt)}</td>
                    <td data-label="Reference" className={styles.mono}>{entry.reference ?? "—"}</td>
                    <td data-label="Description">{entry.description}</td>
                    <td data-label="Status"><StatusBadge status={entry.status} /></td>
                    <td data-label="Amount" className={styles.num}>{formatDecimal(entry.amount, entry.currency)}</td>
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
