"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/navbar";
import DardaniImage from "@/components/dardani/dardani-image";
import { ArrowLeft, Check } from "lucide-react";
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
      <main className={`auth-stage ${styles.stage}`}>
        <div className="auth-plumes" aria-hidden="true">
          {["l1", "l2", "l3", "r1", "r2", "r3"].map((id) => (
            <div key={id} className={`auth-plume auth-plume-${id}`}><div className="auth-plume-body" /></div>
          ))}
        </div>
        <div className="auth-grain" aria-hidden="true" />
        <section className={`auth-card ${styles.card}`} aria-labelledby="password-heading">
          <div className="auth-rim" aria-hidden="true"><div className="auth-rim-sweep" /></div>
          <div className={styles.brand}>
            <Link href="/" className={styles.wordmark} aria-label="383 — faqja kryesore">383<span aria-hidden="true">.</span></Link>
            <DardaniImage name="key" decorative priority className={styles.mascot} />
          </div>
          <h1 id="password-heading" className={styles.heading}>
            {resetting ? "Vendos fjalëkalimin e ri" : "Ke harruar fjalëkalimin?"}
          </h1>
          <p className={styles.description}>
            {resetting ? "Zgjidh një fjalëkalim të ri për llogarinë tënde."
              : "Shkruaj emailin e llogarisë. Do të të dërgojmë një link për të ndryshuar fjalëkalimin."}
          </p>
          {success && (
            <div role="status" className={styles.success}>
              <Check size={18} aria-hidden="true" />
              <p>{resetting ? "Fjalëkalimi u ndryshua me sukses. Mund të vazhdosh me llogarinë tënde."
                : "Nëse ky email ka një llogari, do të marrësh një link nga noreply@383ks.com. Kontrollo edhe dosjen e spamit."}</p>
            </div>
          )}
          {!(resetting && success) && (
            <form onSubmit={submit} className={styles.form}>
              {resetting ? (
                <>
                  <div className={styles.field}>
                  <label htmlFor="new-password" className={styles.label}>Fjalëkalimi i ri</label>
                  <input id="new-password" type="password" autoComplete="new-password" required minLength={8}
                    value={password} onChange={(event) => setPassword(event.target.value)} disabled={!ready || loading}
                    className={styles.input} aria-describedby="password-help" />
                  <p id="password-help" className={styles.help}>Të paktën 8 karaktere.</p>
                  </div>
                  <div className={styles.field}>
                  <label htmlFor="confirm-password" className={styles.label}>Përsërit fjalëkalimin</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8}
                    value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={!ready || loading}
                    className={styles.input} />
                  </div>
                  {!ready && !error && <p role="status" className={styles.help}>Duke verifikuar linkun…</p>}
                </>
              ) : (
                <div className={styles.field}>
                  <label htmlFor="recovery-email" className={styles.label}>Email</label>
                  <input id="recovery-email" type="email" autoComplete="email" required value={email}
                    placeholder="emri@email.com" autoCapitalize="none" spellCheck={false}
                    onChange={(event) => setEmail(event.target.value)} disabled={loading} className={styles.input} />
                </div>
              )}
              {error && <p role="alert" className={styles.error}>{error}</p>}
              <button type="submit" disabled={loading || (resetting && !ready) || (!resetting && resendIn > 0)}
                className={styles.submit}>
                {loading ? "Duke pritur…" : resetting ? "Ruaj fjalëkalimin" : resendIn > 0 ? `Dërgo përsëri (${resendIn}s)` : "Dërgo linkun"}
              </button>
            </form>
          )}
          {resetting && !success && (
            <a href="/hyr/fjalekalimi" className={styles.newLink}>Kërko një link të ri</a>
          )}
          <div className={styles.footer}>
            <Link href={resetting && success ? "/" : "/hyr"} className={styles.backLink}>
              <ArrowLeft size={15} aria-hidden="true" />
              {resetting && success ? "Vazhdo në 383" : "Kthehu te hyrja"}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
