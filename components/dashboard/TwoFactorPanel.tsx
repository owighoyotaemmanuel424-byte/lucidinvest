"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import styles from "@/components/dashboard/dashboard.module.css";

export default function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage({ tone: "error", text: apiErrorMessage(body, "That action could not be completed.") });
        return null;
      }
      return body;
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Try again." });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    const body = (await post({ action: "setup" })) as { secret?: string; otpauthUrl?: string } | null;
    if (body?.secret && body.otpauthUrl) {
      setSetup({ secret: body.secret, otpauthUrl: body.otpauthUrl });
      setMessage({ tone: "ok", text: "Add the secret to your authenticator app, then confirm a code below." });
    }
  }

  async function enable() {
    const body = await post({ action: "enable", code });
    if (body) {
      setMessage({ tone: "ok", text: "Two-factor authentication is now enabled." });
      setSetup(null);
      setCode("");
      router.refresh();
    }
  }

  async function disable() {
    const body = await post({ action: "disable", password });
    if (body) {
      setMessage({ tone: "ok", text: "Two-factor authentication has been turned off." });
      setPassword("");
      router.refresh();
    }
  }

  return (
    <div className={styles.form}>
      <dl className={styles.detailList}>
        <div className={styles.detailRow}>
          <dt className={styles.detailKey}>Status</dt>
          <dd className={styles.detailValue}>{enabled ? "Enabled" : "Not enabled"}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt className={styles.detailKey}>Method</dt>
          <dd className={styles.detailValue}>Time-based one-time code (TOTP, 30 seconds)</dd>
        </div>
      </dl>

      {!enabled && !setup && (
        <div className={styles.formActions}>
          <button type="button" className={styles.cta} onClick={startSetup} disabled={busy}>
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        </div>
      )}

      {!enabled && setup && (
        <>
          <div className={styles.notice}>
            <p style={{ margin: "0 0 6px" }}>Add this secret to your authenticator app:</p>
            <p className={styles.mono} style={{ margin: 0, fontWeight: 700, overflowWrap: "anywhere" }}>{setup.secret}</p>
            <p style={{ margin: "8px 0 0", overflowWrap: "anywhere" }} className={styles.mono}>{setup.otpauthUrl}</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="totp-code">Six-digit code</label>
            <input
              id="totp-code"
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cta} onClick={enable} disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Enable two-factor"}
            </button>
          </div>
        </>
      )}

      {enabled && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="disable-2fa-password">Confirm your password to disable</label>
          <input
            id="disable-2fa-password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <div className={styles.formActions}>
            <button type="button" className={`${styles.cta} ${styles.ctaGhost}`} onClick={disable} disabled={busy || password.length === 0}>
              {busy ? "Disabling…" : "Disable two-factor"}
            </button>
          </div>
        </div>
      )}

      {message && <p className={formMessageClass(message.tone)} role="status">{message.text}</p>}
    </div>
  );
}
