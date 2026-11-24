import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import StatusActions from "@/components/admin/StatusActions";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listProducts } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await listProducts({ includeInactive: true });

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Investment products"
        lead="Create and configure investment plans: minimum, term, fees, risk classification and allocation. Publishing changes availability only."
      />

      <section className={styles.panel} aria-labelledby="new-product">
        <h2 id="new-product" className={styles.panelTitle}>Create a product</h2>
        <JsonForm
          endpoint="/api/admin/products"
          fields={[
            { name: "name", label: "Product name", required: true },
            { name: "description", label: "Description", type: "textarea", required: true, rows: 3 },
            { name: "summary", label: "Short summary" },
            {
              name: "category",
              label: "Category",
              type: "select",
              required: true,
              options: [
                { value: "portfolio", label: "Managed portfolio" },
                { value: "stocks", label: "Stocks" },
                { value: "etfs", label: "ETFs" },
                { value: "bonds", label: "Bonds" },
                { value: "mutual_funds", label: "Mutual funds" },
                { value: "crypto", label: "Crypto" },
              ],
            },
            {
              name: "riskLevel",
              label: "Risk classification",
              type: "select",
              required: true,
              options: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ],
            },
            {
              name: "currency",
              label: "Currency",
              type: "select",
              required: true,
              options: [
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
                { value: "GBP", label: "GBP" },
              ],
            },
            { name: "minimumAmount", label: "Minimum investment", required: true, placeholder: "1000.00" },
            { name: "durationDays", label: "Term in days (blank = open-ended)", type: "number", min: 1, max: 3650 },
            { name: "feeBps", label: "Subscription fee (basis points)", type: "number", min: 0, max: 2000, defaultValue: 0 },
            { name: "managementFeeBps", label: "Management fee (basis points p.a.)", type: "number", min: 0, max: 2000, defaultValue: 0 },
            { name: "expenseRatio", label: "Expense ratio (%)", placeholder: "0.75" },
            { name: "couponRate", label: "Coupon rate (%)", placeholder: "4.25" },
            { name: "maturityDate", label: "Maturity date", type: "date" },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active (published)" },
                { value: "paused", label: "Paused" },
                { value: "retired", label: "Retired" },
              ],
            },
            { name: "termsVersion", label: "Terms version", placeholder: "2026-01" },
          ]}
          submitLabel="Create product"
          successText="Product created and recorded in the audit log."
        />
      </section>

      <section className={styles.panel} aria-labelledby="product-list">
        <div className={styles.panelHead}>
          <h2 id="product-list" className={styles.panelTitle}>{products.length} product{products.length === 1 ? "" : "s"}</h2>
        </div>
        {products.length === 0 ? (
          <EmptyState title="No products" text="Create the first investment plan above." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Risk</th>
                  <th scope="col" className={styles.num}>Minimum</th>
                  <th scope="col">Fees</th>
                  <th scope="col">Status</th>
                  <th scope="col">Publish / suspend</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td data-label="Product">
                      <div>{product.name}</div>
                      <div className={styles.muted}>{product.currency} · {product.durationDays ? `${product.durationDays} days` : "open-ended"}</div>
                    </td>
                    <td data-label="Category">{product.category.replace(/_/g, " ")}</td>
                    <td data-label="Risk" style={{ textTransform: "capitalize" }}>{product.riskLevel}</td>
                    <td data-label="Minimum" className={styles.num}>{formatDecimal(product.minimumAmount, product.currency)}</td>
                    <td data-label="Fees" className={styles.muted}>
                      {(product.feeBps / 100).toFixed(2)}% entry · {(product.managementFeeBps / 100).toFixed(2)}% p.a.
                    </td>
                    <td data-label="Status"><StatusBadge status={product.status} /></td>
                    <td data-label="Publish / suspend">
                      <StatusActions
                        endpoint={`/api/admin/products/${product.id}`}
                        record={product.name}
                        options={[
                          { value: "active", label: "Publish" },
                          { value: "paused", label: "Suspend" },
                          { value: "retired", label: "Retire" },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Do not describe a plan as guaranteed. Fees are basis points (100 bps = 1%). Changing a product never changes an
        existing investment&apos;s terms; those are recorded with the request.
      </p>
    </>
  );
}
