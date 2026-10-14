import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "160px 24px 100px", color: "var(--theme-ink, #111111)" }}>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", lineHeight: 1.15 }}>Faqja nuk u gjet</h1>
        <p style={{ lineHeight: 1.7, color: "var(--theme-muted, #625e58)" }}>Adresa mund të ketë ndryshuar ose faqja nuk është më e disponueshme.</p>
        <Link href="/" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, padding: "12px 22px", borderRadius: 99, color: "#fff", fontWeight: 750, textDecoration: "none", marginTop: 16 }}>Kthehu në kryefaqe</Link>
      </main>
      <Footer />
    </>
  );
}
