"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import styles from "@/components/dashboard/dashboard.module.css";

export default function KycDocumentUpload() {
  const router = useRouter();
  const [kind, setKind] = useState("identity");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      setMessage({ tone: "error", text: "Choose a document to upload." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const data = new FormData();
      data.set("kind", kind);
      data.set("file", fileInput.files[0]);
      const response = await fetch("/api/account/kyc/documents", {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage({ tone: "error", text: apiErrorMessage(body, "That document could not be uploaded.") });
        return;
      }
      setMessage({ tone: "ok", text: "Document uploaded. Our compliance team can now review it." });
      form.reset();
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="kyc-doc-kind">Document type</label>
          <select id="kyc-doc-kind" className={styles.input} value={kind} onChange={(event) => setKind(event.target.value)} disabled={busy}>
            <option value="identity">Identity document</option>
            <option value="address">Proof of address</option>
            <option value="source_of_funds">Source of funds</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="kyc-doc-file">File</label>
          <input id="kyc-doc-file" name="file" className={styles.input} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} required />
          <p className={styles.hint}>PDF, JPEG or PNG up to 5 MB. Stored privately and only visible to you and compliance staff.</p>
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.cta} disabled={busy}>{busy ? "Uploading…" : "Upload document"}</button>
        {message && <p className={formMessageClass(message.tone)} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
