"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, formMessageClass, readJson } from "@/components/dashboard/api";
import styles from "@/components/dashboard/dashboard.module.css";

export type JsonField = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "password" | "textarea" | "select" | "checkbox" | "multiselect" | "date";
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean | string[];
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  rows?: number;
  help?: string;
};

type Value = string | number | boolean | string[];

function initialValue(field: JsonField): Value {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "checkbox") return false;
  if (field.type === "multiselect") return [];
  return "";
}

/**
 * Small reusable form that posts a JSON body to an API route and then refreshes
 * the server-rendered page. Keeping one implementation means every new console
 * form gets the same same-origin fetch, error handling and feedback behaviour.
 */
export default function JsonForm({
  endpoint,
  method = "POST",
  fields,
  hidden = {},
  submitLabel = "Save",
  successText = "Saved.",
  confirmText,
}: {
  endpoint: string;
  method?: "POST" | "PATCH";
  fields: JsonField[];
  hidden?: Record<string, unknown>;
  submitLabel?: string;
  successText?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, initialValue(field)])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function update(name: string, value: Value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);

    const payload: Record<string, unknown> = { ...hidden };
    for (const field of fields) {
      const raw: Value = values[field.name];
      let value: unknown = raw;
      if (field.type === "number" && raw !== "") value = Number(raw);
      if (raw === "") value = null;
      payload[field.name] = value;
    }

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setMessage({ tone: "error", text: apiErrorMessage(body, "That action could not be completed.") });
        return;
      }
      setMessage({ tone: "ok", text: successText });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Connection problem. Check your internet connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        {fields.map((field) => {
          const id = `${endpoint.replace(/[^a-z0-9]/gi, "-")}-${field.name}`;
          const value = values[field.name];
          if (field.type === "checkbox") {
            return (
              <div className={styles.field} key={field.name}>
                <label className={styles.label} htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => update(field.name, event.target.checked)}
                    disabled={busy}
                  />
                  {field.label}
                </label>
                {field.help && <p className={styles.hint}>{field.help}</p>}
              </div>
            );
          }
          if (field.type === "multiselect") {
            const selected = Array.isArray(value) ? value : [];
            return (
              <div className={styles.field} key={field.name} style={{ gridColumn: "1 / -1" }}>
                <span className={styles.label}>{field.label}</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
                  {(field.options ?? []).map((option) => (
                    <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(option.value)}
                        onChange={(event) =>
                          update(
                            field.name,
                            event.target.checked
                              ? [...selected, option.value]
                              : selected.filter((entry) => entry !== option.value),
                          )
                        }
                        disabled={busy}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          }
          if (field.type === "select") {
            return (
              <div className={styles.field} key={field.name}>
                <label className={styles.label} htmlFor={id}>{field.label}</label>
                <select
                  id={id}
                  className={styles.input}
                  value={String(value ?? "")}
                  onChange={(event) => update(field.name, event.target.value)}
                  disabled={busy}
                  required={field.required}
                >
                  {!field.required && <option value="">—</option>}
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {field.help && <p className={styles.hint}>{field.help}</p>}
              </div>
            );
          }
          if (field.type === "textarea") {
            return (
              <div className={styles.field} key={field.name} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.label} htmlFor={id}>{field.label}</label>
                <textarea
                  id={id}
                  className={styles.input}
                  style={{ height: "auto", padding: "12px 14px", minHeight: 90 }}
                  rows={field.rows ?? 4}
                  value={String(value ?? "")}
                  onChange={(event) => update(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  disabled={busy}
                  required={field.required}
                />
                {field.help && <p className={styles.hint}>{field.help}</p>}
              </div>
            );
          }
          return (
            <div className={styles.field} key={field.name}>
              <label className={styles.label} htmlFor={id}>{field.label}</label>
              <input
                id={id}
                className={styles.input}
                type={field.type ?? "text"}
                value={String(value ?? "")}
                onChange={(event) => update(field.name, event.target.value)}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={busy}
                required={field.required}
              />
              {field.help && <p className={styles.hint}>{field.help}</p>}
            </div>
          );
        })}
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.cta} disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {message && <p className={formMessageClass(message.tone)} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
