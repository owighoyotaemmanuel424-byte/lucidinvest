import Link from "next/link";
import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireUser } from "@/lib/auth";
import { listProducts } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  stocks: "Stocks",
  etfs: "ETFs",
  bonds: "Bonds",
  mutual_funds: "Mutual funds",
  crypto: "Crypto",
  portfolio: "Managed portfolio",
};

export default async function PlansPage() {
  await requireUser();
  const products = await listProducts();

  return (
    <>
      <PageHeader
        eyebrow="Investment plans"
        title="Investment plans and mandates"
        lead="Review each plan's minimum, term, fees and risk classification before you request a subscription. No return is guaranteed or implied."
        action={<Link href="/dashboard/investments" className={styles.cta}>Request an investment</Link>}
      />

      {products.length === 0 ? (
        <EmptyState
          title="No plans published"
          text="Approved investment plans appear here once they are published by our team."
        />
      ) : (
        <section className={styles.stats} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {products.map((product) => (
            <article key={product.id} className={styles.panel} aria-labelledby={`plan-${product.id}`}>
              <div className={styles.panelHead}>
                <div>
                  <p className={styles.eyebrow}>{CATEGORY_LABELS[product.category] ?? product.category}</p>
                  <h2 id={`plan-${product.id}`} className={styles.panelTitle} style={{ marginTop: 4 }}>{product.name}</h2>
                </div>
                <StatusBadge status={product.status} />
              </div>
              <p className={styles.muted}>{product.summary || product.description}</p>
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Minimum</dt>
                  <dd className={styles.detailValue}>{formatDecimal(product.minimumAmount, product.currency)}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Risk classification</dt>
                  <dd className={styles.detailValue} style={{ textTransform: "capitalize" }}>{product.riskLevel}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Term</dt>
                  <dd className={styles.detailValue}>{product.durationDays ? `${product.durationDays} days` : "Open-ended"}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Subscription fee</dt>
                  <dd className={styles.detailValue}>{(product.feeBps / 100).toFixed(2)}%</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt className={styles.detailKey}>Management fee</dt>
                  <dd className={styles.detailValue}>{(product.managementFeeBps / 100).toFixed(2)}% p.a.</dd>
                </div>
                {product.expenseRatio && (
                  <div className={styles.detailRow}>
                    <dt className={styles.detailKey}>Expense ratio</dt>
                    <dd className={styles.detailValue}>{(Number(product.expenseRatio) * 100).toFixed(2)}%</dd>
                  </div>
                )}
                {product.couponRate && (
                  <div className={styles.detailRow}>
                    <dt className={styles.detailKey}>Coupon</dt>
                    <dd className={styles.detailValue}>{(Number(product.couponRate) * 100).toFixed(2)}%</dd>
                  </div>
                )}
                {product.maturityDate && (
                  <div className={styles.detailRow}>
                    <dt className={styles.detailKey}>Maturity</dt>
                    <dd className={styles.detailValue}>{product.maturityDate.slice(0, 10)}</dd>
                  </div>
                )}
                {product.termsVersion && (
                  <div className={styles.detailRow}>
                    <dt className={styles.detailKey}>Terms version</dt>
                    <dd className={styles.detailValue}>{product.termsVersion}</dd>
                  </div>
                )}
              </dl>
              <Link href="/dashboard/investments" className={styles.cta}>Review disclosure & invest</Link>
            </article>
          ))}
        </section>
      )}

      <p className={styles.notice}>
        Subscriptions are requests: they remain pending until an authorised reviewer approves them and books the
        subscription entry. Capital is at risk. Past performance and simulated data do not predict future results.
      </p>
    </>
  );
}
