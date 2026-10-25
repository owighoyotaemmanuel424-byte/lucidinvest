"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register" };

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...(registering ? { fullName } : {}), email, password }),
      });
      const result: unknown = await response.json();
      const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error : "";
      if (!response.ok) {
        setError(message || "We could not complete your request. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Connection problem. Please check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/">LucidInvest</Link>
        <p className="auth-eyebrow">{registering ? "GET STARTED" : "WELCOME BACK"}</p>
        <h1 id="auth-title">{registering ? "Create your account" : "Sign in to LucidInvest"}</h1>
        <p className="auth-description">{registering ? "Set up your personal account to get started." : "Enter your account details to continue."}</p>
        <form onSubmit={submit}>
          {registering && (
            <label className="auth-label">Full name
              <input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} minLength={2} maxLength={100} required />
            </label>
          )}
          <label className="auth-label">Email address
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required />
          </label>
          <label className="auth-label">Password
            <input type="password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={registering ? 12 : 1} maxLength={128} required />
            {registering && <span className="auth-hint">Use at least 12 characters.</span>}
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
        </form>
        <p className="auth-switch">{registering ? "Already have an account?" : "New to LucidInvest?"}{" "}
          <Link href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link>
        </p>
        <p className="auth-footnote">Keep your password private. LucidInvest will never ask you to share it by email.</p>
      </section>
      <style jsx>{`
        .auth-shell{min-height:100vh;display:grid;place-items:center;padding:32px 18px;background:linear-gradient(135deg,#f4f7fb,#e9eef8);color:#17233b}
        .auth-card{width:100%;max-width:460px;background:#fff;padding:clamp(26px,5vw,44px);border-radius:20px;box-shadow:0 20px 60px rgba(18,36,70,.12)}
        .auth-brand{font-size:24px;font-weight:800;letter-spacing:-.7px;color:#153c75;text-decoration:none}
        .auth-eyebrow{margin:28px 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#426bb0}
        h1{font-size:clamp(27px,4vw,34px);line-height:1.2;letter-spacing:-.8px;margin:0}
        .auth-description{color:#667085;line-height:1.6;margin:12px 0 28px}
        form{display:grid;gap:18px}
        .auth-label{display:grid;gap:8px;font-size:14px;font-weight:650}
        input{width:100%;box-sizing:border-box;border:1px solid #d7deea;border-radius:10px;padding:13px 14px;font:inherit;color:#17233b;background:#fff;outline:none}
        input:focus{border-color:#426bb0;box-shadow:0 0 0 3px rgba(66,107,176,.14)}
        .auth-hint{font-size:12px;font-weight:400;color:#667085}
        .auth-error{margin:0;padding:11px 13px;border-radius:9px;background:#fff0f0;color:#9b2525;font-size:13px}
        .auth-submit{border:0;border-radius:10px;padding:14px 18px;background:#173f7b;color:white;font:inherit;font-weight:750;cursor:pointer}
        .auth-submit:disabled{opacity:.65;cursor:wait}
        .auth-switch{text-align:center;color:#667085;font-size:14px;margin:22px 0 0}
        .auth-switch a{color:#173f7b;font-weight:750}
        .auth-footnote{border-top:1px solid #edf0f5;padding-top:18px;margin:22px 0 0;color:#8a94a6;font-size:12px;line-height:1.6;text-align:center}
      `}</style>
    </main>
  );
}
