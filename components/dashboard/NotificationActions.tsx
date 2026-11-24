"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/dashboard/dashboard.module.css";

export default function NotificationActions({ unread }: { unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`${styles.cta} ${styles.ctaGhost}`} onClick={markAll} disabled={busy || unread === 0}>
      {busy ? "Updating…" : unread === 0 ? "All read" : `Mark all read (${unread})`}
    </button>
  );
}
