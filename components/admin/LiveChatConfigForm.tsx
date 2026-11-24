"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/dashboard/dashboard.module.css";

type Config = { enabled: boolean; provider: "tawk"; propertyId: string; widgetId: string };

export default function LiveChatConfigForm({ initial }: { initial: Config }) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/live-chat", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "error", text: body.error || "Unable to save live chat settings." });
        return;
      }
      setMessage({ tone: "ok", text: "Live chat configuration saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.notice}>
        Connect the existing Tawk.to workspace or temporarily hide the chat launcher. Your property and widget IDs are public embed identifiers, not passwords or API secrets.
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="live-chat-enabled">
          <input id="live-chat-enabled" type="checkbox" checked={config.enabled} disabled={busy}
            onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))} />
          {" "}Enable live chat on the website
        </label>
      </div>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-chat-provider">Chat provider</label>
          <select id="live-chat-provider" className={styles.input} value={config.provider} disabled>
            <option value="tawk">Tawk.to</option>
          </select>
          <p className={styles.hint}>Tawk.to is the provider currently integrated into LucidInvest.</p>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-chat-property">Property ID</label>
          <input id="live-chat-property" className={styles.input} value={config.propertyId} disabled={busy}
            placeholder="Your Tawk.to property ID" required maxLength={64}
            onChange={(event) => setConfig((current) => ({ ...current, propertyId: event.target.value.trim() }))} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-chat-widget">Widget ID</label>
          <input id="live-chat-widget" className={styles.input} value={config.widgetId} disabled={busy}
            placeholder="Your Tawk.to widget ID" required maxLength={64}
            onChange={(event) => setConfig((current) => ({ ...current, widgetId: event.target.value.trim() }))} />
        </div>
      </div>
      <div className={styles.formActions}>
        <button className={styles.cta} type="submit" disabled={busy}>{busy ? "Saving…" : "Save live chat settings"}</button>
        {message && <p className={message.tone === "ok" ? styles.formOk : styles.formError} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
