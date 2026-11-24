import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dashboard";
import { listInstrumentsForAdmin } from "@/lib/marketplace";
import { formatDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminMarketDataPage() {
  await requireAdmin();
  const instruments = await listInstrumentsForAdmin();

  return (
    <>
      <PageHeader
        eyebrow="Market data"
        title="Market data & instruments"
        lead="Record the quotes used to value portfolios and settle orders. Rows are append-only price history; mark simulated data as demo."
      />

      <section className={styles.panel} aria-labelledby="record-price">
        <h2 id="record-price" className={styles.panelTitle}>Record a quote</h2>
        <JsonForm
          endpoint="/api/admin/market"
          fields={[
            {
              name: "instrumentId",
              label: "Instrument",
              type: "select",
              required: true,
              options: instruments.map((instrument) => ({
                value: instrument.id,
                label: `${instrument.symbol} · ${instrument.name}`,
              })),
            },
            { name: "price", label: "Price", required: true, placeholder: "42.18000000" },
            { name: "changePercent", label: "Change (%)", type: "number", step: "0.0001", defaultValue: 0 },
            { name: "isDemo", label: "This quote is simulated demo data", type: "checkbox", defaultValue: true },
          ]}
          submitLabel="Record quote"
          successText="Quote recorded. Portfolio valuations now use it."
        />
      </section>

      <section className={styles.panel} aria-labelledby="instrument-list">
        <div className={styles.panelHead}>
          <h2 id="instrument-list" className={styles.panelTitle}>{instruments.length} instruments</h2>
        </div>
        {instruments.length === 0 ? (
          <EmptyState title="No instruments" text="Apply migration 0008 to publish the demonstration instrument list." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Name</th>
                  <th scope="col">Class</th>
                  <th scope="col">Currency</th>
                  <th scope="col" className={styles.num}>Last price</th>
                  <th scope="col" className={styles.num}>Change</th>
                  <th scope="col">Data</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => (
                  <tr key={instrument.id}>
                    <td data-label="Symbol" className={styles.mono}>{instrument.symbol}</td>
                    <td data-label="Name">{instrument.name}</td>
                    <td data-label="Class">{instrument.assetClass.replace(/_/g, " ")}</td>
                    <td data-label="Currency">{instrument.currency}</td>
                    <td data-label="Last price" className={styles.num}>{formatDecimal(instrument.price, instrument.currency)}</td>
                    <td data-label="Change" className={styles.num}>{Number(instrument.changePercent ?? 0).toFixed(2)}%</td>
                    <td data-label="Data">{instrument.isDemo ? "simulated" : "recorded"}</td>
                    <td data-label="Recorded">{instrument.asOf ? formatDateTime(instrument.asOf) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.notice}>
        Quotes are not a live exchange feed. Do not present simulated prices as live market data to customers, and
        remember that recorded quotes directly affect order settlement.
      </p>
    </>
  );
}
