"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";
import styles from "./password.module.css";

export default function PasswordPage() {
  return <Suspense><PasswordForm /></Suspense>;
}

function PasswordForm() {
  const searchParams = useSearchParams();
  const resetting = searchParams.get("mode") === "reset";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(searchParams.has("error")
    ? "Linku ka skaduar ose është përdorur. Kërko një link të ri."
    : "");
  const [success, setSuccess] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!resetting) return;
    let stopped = false;
    async function checkSession() {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (stopped) return;
        if (error || !data.user) {
          setError("Linku ka skaduar ose është përdorur. Kërko një link të ri.");
        } else {
          setReady(true);
        }
      } catch {
        if (!stopped) setError("Nuk mund të verifikohej linku. Provo përsëri.");
      }
    }
    void checkSession();
    return () => { stopped = true; };
  }, [resetting]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || (!resetting && resendIn > 0) || (resetting && !ready)) return;
    setError("");
    if (resetting && password !== confirmPassword) {
      setError("Fjalëkalimet nuk përputhen.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (resetting) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
      } else {
        // The callback is already allowed by the auth server's redirect list.
        // The recovery email template uses token_hash so it also works on another device.
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/hyr/fjalekalimi?mode=reset")}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
        if (error) throw error;
        setResendIn(60);
      }
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/rate limit|too many/i.test(message)) {
        setError("Shumë kërkesa. Provo përsëri pas disa minutash.");
      } else if (/same_password/i.test(message) || /different.*password/i.test(message)) {
        setError("Zgjidh një fjalëkalim ndryshe nga ai i mëparshmi.");
      } else if (/password.*(short|least|weak)/i.test(message)) {
        setError("Fjalëkalimi duhet të ketë të paktën 8 karaktere.");
      } else {
        setError(resetting
          ? "Fjalëkalimi nuk u ndryshua. Provo përsëri ose kërko një link të ri."
          : "Emaili nuk u dërgua. Provo përsëri më vonë.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="auth-stage" style={{ fontFamily: "var(--font-manrope), sans-serif" }}>
        <section className="auth-card" aria-labelledby="password-heading">
          <h1 id="password-heading" style={{ fontSize: 24, margin: "0 0 12px", color: "#111" }}>
            {resetting ? "Vendos fjalëkalimin e ri" : "Ke harruar fjalëkalimin?"}
          </h1>
          <p style={{ color: "#666", lineHeight: 1.6, fontSize: 14, marginBottom: 24 }}>
            {resetting ? "Zgjidh një fjalëkalim të ri për llogarinë tënde."
              : "Shkruaj emailin e llogarisë. Do të të dërgojmë një link për të ndryshuar fjalëkalimin."}
          </p>
          {success && (
            <p role="status" style={{ color: "#22613B", fontSize: 14, lineHeight: 1.6 }}>
              {resetting ? "Fjalëkalimi u ndryshua me sukses. Mund të vazhdosh me llogarinë tënde."
                : "Nëse ky email ka një llogari, do të marrësh një link nga noreply@383ks.com. Kontrollo edhe dosjen e spamit."}
            </p>
          )}
          {!(resetting && success) && (
            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              {resetting ? (
                <>
                  <label htmlFor="new-password">Fjalëkalimi i ri</label>
                  <input id="new-password" type="password" autoComplete="new-password" required minLength={8}
                    value={password} onChange={(event) => setPassword(event.target.value)} disabled={!ready || loading}
                    className={styles.input} aria-describedby="password-help" />
                  <p id="password-help" style={{ margin: 0, fontSize: 12, color: "#666" }}>Të paktën 8 karaktere.</p>
                  <label htmlFor="confirm-password">Përsërit fjalëkalimin</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8}
                    value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={!ready || loading}
                    className={styles.input} />
                  {!ready && !error && <p role="status">Duke verifikuar linkun…</p>}
                </>
              ) : (
                <>
                  <label htmlFor="recovery-email">Email</label>
                  <input id="recovery-email" type="email" autoComplete="email" required value={email}
                    onChange={(event) => setEmail(event.target.value)} disabled={loading} className={styles.input} />
                </>
              )}
              {error && <p role="alert" style={{ color: "#B52D21", fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading || (resetting && !ready) || (!resetting && resendIn > 0)}
                className={styles.submit}>
                {loading ? "Duke pritur…" : resetting ? "Ruaj fjalëkalimin" : resendIn > 0 ? `Dërgo përsëri (${resendIn}s)` : "Dërgo linkun"}
              </button>
            </form>
          )}
          {resetting && !success && (
            <p style={{ fontSize: 13 }}><a href="/hyr/fjalekalimi" style={{ color: "#A72D16" }}>Kërko një link të ri</a></p>
          )}
          <p style={{ fontSize: 13, marginTop: 24 }}>
            <Link href={resetting && success ? "/" : "/hyr"} style={{ color: "#A72D16" }}>
              {resetting && success ? "Vazhdo në 383" : "Kthehu te hyrja"}
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
