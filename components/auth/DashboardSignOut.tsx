"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/login");
      router.refresh();
      setBusy(false);
    }
  }
  return <button type="button" onClick={signOut} disabled={busy} style={{border:"1px solid #d7deea",borderRadius:9,padding:"10px 16px",background:"#fff",color:"#173f7b",fontWeight:700,cursor:"pointer"}}>{busy ? "Signing out…" : "Sign out"}</button>;
}
