"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import styles from "./info-pages.module.css";

export default function ContactEmailCopy({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  async function copyEmail() {
    setMessage("Po kopjohet adresa…");
    try {
      await navigator.clipboard.writeText(email);
      setMessage("Adresa u kopjua. Mund ta vendosësh në emailin tënd.");
    } catch {
      setMessage("Kopjimi nuk u krye. Mund ta përzgjedhësh dhe kopjosh adresën më sipër.");
    }
  }
  return <div className="relative mt-6">
    <button type="button" className={styles.copy} onClick={copyEmail}><Copy size={16} aria-hidden="true" />Kopjo adresën e emailit</button>
    <p className={styles.copyStatus} role="status">{message}</p>
  </div>;
}
