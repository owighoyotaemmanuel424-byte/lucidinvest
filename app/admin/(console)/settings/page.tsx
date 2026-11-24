import PageHeader from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/admin-platform";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function groupValue(settings: { key: string; value: unknown }[], key: string): Record<string, unknown> {
  const found = settings.find((setting) => setting.key === key);
  return found && found.value && typeof found.value === "object" && !Array.isArray(found.value)
    ? (found.value as Record<string, unknown>)
    : {};
}

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getPlatformSettings();
  const platform = groupValue(settings, "platform");
  const trading = groupValue(settings, "trading");

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Platform settings"
        lead="Operational configuration only. Financial policy such as minimums, fees and risk lives on each investment product."
      />

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="platform-settings">
          <h2 id="platform-settings" className={styles.panelTitle}>Platform identity</h2>
          <JsonForm
            endpoint="/api/admin/settings"
            method="PATCH"
            hidden={{ group: "platform" }}
            fields={[
              { name: "name", label: "Platform name", required: true, defaultValue: String(platform.name ?? "LucidInvest") },
              { name: "supportEmail", label: "Support email", type: "email", defaultValue: String(platform.supportEmail ?? "") },
              { name: "demoLabel", label: "Demo data label", defaultValue: String(platform.demoLabel ?? "Simulated demo data") },
              {
                name: "maintenanceMode",
                label: "Maintenance mode (shows a service notice to customers)",
                type: "checkbox",
                defaultValue: Boolean(platform.maintenanceMode),
              },
            ]}
            submitLabel="Save platform settings"
            successText="Platform settings saved."
          />
        </section>

        <section className={styles.panel} aria-labelledby="trading-settings">
          <h2 id="trading-settings" className={styles.panelTitle}>Order review policy</h2>
          <JsonForm
            endpoint="/api/admin/settings"
            method="PATCH"
            hidden={{ group: "trading" }}
            fields={[
              {
                name: "ordersRequireReview",
                label: "All market orders require staff settlement",
                type: "checkbox",
                defaultValue: trading.ordersRequireReview !== false,
              },
              {
                name: "maxOrderNotional",
                label: "Maximum order notional (USD)",
                type: "number",
                min: 1,
                defaultValue: Number(trading.maxOrderNotional ?? 100000),
              },
              { name: "allowSell", label: "Allow sell orders", type: "checkbox", defaultValue: trading.allowSell !== false },
            ]}
            submitLabel="Save order policy"
            successText="Order policy saved."
          />
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="settings-history">
        <h2 id="settings-history" className={styles.panelTitle}>Stored settings</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Value</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.key}>
                  <td data-label="Group" className={styles.mono}>{setting.key}</td>
                  <td data-label="Value" className={styles.muted} style={{ overflowWrap: "anywhere" }}>
                    <code style={{ fontSize: 12 }}>{JSON.stringify(setting.value)}</code>
                  </td>
                  <td data-label="Updated">{formatDateTime(setting.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className={styles.notice}>
        Changing settings never changes a customer balance or an existing order. Every save writes a settings.updated
        audit event.
      </p>
    </>
  );
}
