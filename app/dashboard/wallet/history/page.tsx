import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import walletStyles from "@/components/dashboard/wallet/wallet.module.css";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dashboard";
import { decimalToMinor, formatSignedMinor } from "@/lib/money";
import { getWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const KIND_FILTERS = [
  { value: "", label: "All activity" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "transfer", label: "Transfers" },
  { value: "investment", label: "Investments" },
];

const STATUS_FILTERS = [
  { value: "", label: "Any status" },
  { value: "posted", label: "Posted" },
  { value: "pending", label: "Pending" },
  { value: "reversed", label: "Reversed" },
  { value: "failed", label: "Failed" },
];

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function historyHref(params: { page?: number; kind?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.kind) query.set("kind", params.kind);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return suffix ? `/dashboard/wallet/history?${suffix}` : "/dashboard/wallet/history";
}

export default async function WalletHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; kind?: string | string[]; status?: string | string[] }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const kind = first(params.kind);
  const status = first(params.status);

  const history = await getWalletTransactions(user.id, { page, pageSize: 20, kind, status });
  const from = history.total === 0 ? 0 : (history.page - 1) * history.pageSize + 1;
  const to = Math.min(history.total, history.page * history.pageSize);

  return (
    <>
      <PageHeader
        eyebrow="Wallet history"
        title="Every wallet movement"
        lead="Ledger entries across your wallet and trading accounts, including the requests still awaiting review. Filter by type or status to narrow the list."
      />

      <section className={styles.panel} aria-labelledby="wallet-history">
        <div className={styles.panelHead}>
          <h2 id="wallet-history" className={styles.panelTitle}>
            {history.total} entr{history.total === 1 ? "y" : "ies"}
          </h2>
          <Link href="/dashboard/wallet" className={styles.panelLink}>
            Back to wallet
          </Link>
        </div>

        <div className={walletStyles.filters} aria-label="Filter by type">
          {KIND_FILTERS.map((filter) => (
            <Link
              key={`kind-${filter.value || "all"}`}
              href={historyHref({ kind: filter.value, status })}
              className={`${walletStyles.filterChip} ${kind === filter.value ? walletStyles.filterActive : ""}`}
              aria-current={kind === filter.value ? "true" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <div className={walletStyles.filters} aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={`status-${filter.value || "all"}`}
              href={historyHref({ kind, status: filter.value })}
              className={`${walletStyles.filterChip} ${status === filter.value ? walletStyles.filterActive : ""}`}
              aria-current={status === filter.value ? "true" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {history.entries.length === 0 ? (
          <EmptyState
            title="No entries for this filter"
            text="Try another type or status. Deposits and withdrawals appear once staff have posted the request; transfers appear immediately."
            action={
              <Link href="/dashboard/wallet" className={styles.cta}>
                Back to wallet
              </Link>
            }
          />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Description</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => {
                  const minor = decimalToMinor(entry.amount) ?? 0;
                  return (
                    <tr key={entry.id}>
                      <td data-label="Date">{formatDateTime(entry.createdAt)}</td>
                      <td data-label="Type" style={{ textTransform: "capitalize" }}>{entry.kind}</td>
                      <td data-label="Description">{entry.description}</td>
                      <td data-label="Reference" className={styles.mono}>{entry.reference ?? "—"}</td>
                      <td data-label="Source" className={styles.mono}>
                        {entry.walletNumber ?? entry.accountNumber ?? "—"}
                      </td>
                      <td data-label="Status"><StatusBadge status={entry.status} /></td>
                      <td data-label="Amount" className={styles.num}>
                        <span className={minor < 0 ? walletStyles.amountNeg : walletStyles.amountPos}>
                          {formatSignedMinor(minor, entry.currency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {history.total > 0 && (
          <div className={walletStyles.pager}>
            <span>
              Showing {from}–{to} of {history.total}
            </span>
            <div className={walletStyles.pagerLinks}>
              {history.page > 1 && (
                <Link className={walletStyles.filterChip} href={historyHref({ page: history.page - 1, kind, status })}>
                  ← Newer
                </Link>
              )}
              {history.hasMore && (
                <Link className={walletStyles.filterChip} href={historyHref({ page: history.page + 1, kind, status })}>
                  Older →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
