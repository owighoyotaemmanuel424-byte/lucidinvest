"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AuthForm.module.css";

type Props = { mode: "login" | "register"; selectedAccount?: string };

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      {off && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

const PANEL_CONTENT = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Sign in to Lucid Global Invest",
    lead: "Access your dashboard, account status and market coverage in one place.",
    panelTitle: "Your markets, one secure desk.",
    panelLead: "Sign in to pick up where you left off.",
    features: [
      {
        title: "Markets that move with you",
        text: "Forex, stocks, commodities, crypto, futures and options from a single account.",
      },
      {
        title: "Protected by design",
        text: "Passwords are hashed with scrypt and sessions use signed, HttpOnly cookies.",
      },
      {
        title: "Help within reach",
        text: "Reach our team from the live chat available on every page of the site.",
      },
    ],
  },
  register: {
    eyebrow: "GET STARTED",
    title: "Create your Lucid Global Invest account",
    lead: "A few details and your personal dashboard is ready.",
    panelTitle: "Open your account in minutes.",
    panelLead: "Join investors tracking global markets with Lucid Global Invest.",
    features: [
      {
        title: "One account, six markets",
        text: "Forex, stocks, commodities, crypto, futures and options in one place.",
      },
      {
        title: "Straightforward onboarding",
        text: "Create the account, sign in and review your dashboard right away.",
      },
      {
        title: "Security from day one",
        text: "Scrypt password hashing and signed, HttpOnly session cookies as standard.",
      },
    ],
  },
} as const;

export default function AuthForm({ mode, selectedAccount }: Props) {
  const router = useRouter();
  const uid = useId();
  const registering = mode === "register";
  const content = PANEL_CONTENT[mode];

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailId = `${uid}-email`;
  const nameId = `${uid}-name`;
  const passwordId = `${uid}-password`;
  const confirmId = `${uid}-confirm`;
  const longEnough = password.length >= 12;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (registering) {
      if (fullName.trim().replace(/\s+/g, " ").length < 2) {
        setError("Enter your full name (2–100 characters).");
        return;
      }
      if (!longEnough) {
        setError("Choose a password with at least 12 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Both passwords must match.");
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(registering ? { fullName, referralCode } : {}),
          ...(!registering && code ? { code } : {}),
          email,
          password,
        }),
      });

      let message = "";
      let requiresCode = false;
      try {
        const result: unknown = await response.json();
        if (result && typeof result === "object") {
          if ("error" in result && typeof result.error === "string") message = result.error;
          if ("twoFactorRequired" in result && result.twoFactorRequired === true) requiresCode = true;
        }
      } catch {
        /* Non-JSON responses still fall back to the generic message below. */
      }

      if (!response.ok) {
        if (requiresCode) setTwoFactorRequired(true);
        setError(message || "We could not complete your request. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Connection problem. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.panel}>
          <Link href="/" className={styles.logoChip} aria-label="Lucid Global Invest home">
            <Image
              src="/assets/images/resources/lucid-global-invest-logo.png"
              alt="Lucid Global Invest"
              width={142}
              height={71}
              priority
              className={styles.logoImage}
            />
          </Link>
          <h2 className={styles.panelTitle}>{content.panelTitle}</h2>
          <p className={styles.panelLead}>{content.panelLead}</p>
          <ul className={styles.features}>
            {content.features.map((feature) => (
              <li key={feature.title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <CheckIcon />
                </span>
                <span>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span className={styles.featureText}>{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.panelFooter}>Secure sign-in · scrypt hashing · HttpOnly sessions</p>
        </div>

        <div className={styles.formSide}>
          <Link href="/" className={styles.back}>
            ← Back to website
          </Link>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 className={styles.title}>{content.title}</h1>
          <p className={styles.lead}>{content.lead}</p>
          {registering && selectedAccount ? (
            <p className={styles.lead}>
              You selected a {selectedAccount} account. Once your account is created you can open it from your
              dashboard.
            </p>
          ) : null}

          <form className={styles.form} onSubmit={submit} noValidate={false}>
            {registering && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={nameId}>
                  Full name
                </label>
                <div className={styles.control}>
                  <input
                    id={nameId}
                    className={styles.input}
                    name="name"
                    autoComplete="name"
                    placeholder="Jordan Miller"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor={emailId}>
                Email address
              </label>
              <div className={styles.control}>
                <input
                  id={emailId}
                  className={styles.input}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={passwordId}>
                Password
              </label>
              <div className={styles.control}>
                <input
                  id={passwordId}
                  className={`${styles.input} ${styles.inputPassword}`}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  placeholder={registering ? "At least 12 characters" : "Your password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className={styles.toggle}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {registering && (
                <p className={`${styles.hint} ${longEnough ? styles.hintOk : ""}`}>
                  {longEnough ? "✓ 12 character minimum met" : "Use at least 12 characters."}
                </p>
              )}
            </div>

            {!registering && twoFactorRequired && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${uid}-code`}>
                  Authenticator code
                </label>
                <div className={styles.control}>
                  <input
                    id={`${uid}-code`}
                    className={styles.input}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </div>
                <p className={styles.hint}>Open your authenticator app and enter the current six-digit code.</p>
              </div>
            )}

            {!registering && (
              <p className={styles.switch} style={{ margin: 0 }}>
                <Link href="/forgot-password">Forgot password?</Link>
              </p>
            )}

            {registering && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={confirmId}>
                  Confirm password
                </label>
                <div className={styles.control}>
                  <input
                    id={confirmId}
                    className={`${styles.input} ${styles.inputPassword}`}
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                    aria-pressed={showConfirm}
                  >
                    <EyeIcon off={showConfirm} />
                  </button>
                </div>
              </div>
            )}

            {registering && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${uid}-referral`}>
                  Referral code <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
                </label>
                <div className={styles.control}>
                  <input
                    id={`${uid}-referral`}
                    className={styles.input}
                    autoComplete="off"
                    placeholder="LI..."
                    maxLength={20}
                    value={referralCode}
                    onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? (registering ? "Creating your account…" : "Signing you in…") : registering ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className={styles.switch}>
            {registering ? "Already have an account?" : "New to Lucid Global Invest?"}{" "}
            <Link href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link>
          </p>
          <p className={styles.footnote}>
            {registering
              ? "New accounts are reviewed before investment and money-movement features are enabled. Keep your password private — we will never ask you to share it by email."
              : "Keep your password private. Lucid Global Invest will never ask you to share it by email."}
          </p>
        </div>
      </section>
    </main>
  );
}
