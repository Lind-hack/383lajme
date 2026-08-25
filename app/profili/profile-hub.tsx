"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, BookOpen, Check, ChevronRight, Coins, LogOut, Pencil, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeBookmarkIds } from "@/lib/profile-hub.mjs";
import styles from "./profile.module.css";

type SavedArticle = {
  articleId: string; slug: string; title: string; excerpt: string; category: string;
  source: string; imageUrl: string | null; publishedAt: string | null; savedAt: string | null;
};
type TreguData = {
  coins: number; activePositions: number; history: { t: number; coins: number }[];
  transactions: { id: string; type: string; amount: number; createdAt: string; market: { question?: string; slug?: string } | null }[];
};
const TX_LABELS: Record<string, string> = {
  signup_bonus: "Bonusi i mirëseardhjes", daily_bonus: "Bonusi ditor", bet: "Tregtim i hapur",
  sell: "Pozicion i shitur", payout: "Treg i fituar", withdrawal: "Tërheqje",
};

const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
const SHORT_MONTHS = ["jan", "shk", "mar", "pri", "maj", "qer", "kor", "gush", "sht", "tet", "nën", "dhj"];

function formatDate(value: string | null, short = false) {
  if (!value) return "Nuk ka të dhëna";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nuk ka të dhëna";
  const day = date.getUTCDate();
  const month = (short ? SHORT_MONTHS : MONTHS)[date.getUTCMonth()];
  return short ? `${day} ${month}` : `${day} ${month} ${date.getUTCFullYear()}`;
}

function formatCoins(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function BalanceChart({ history }: { history: { t: number; coins: number }[] }) {
  const width = 520, height = 112;
  if (history.length < 2) return <div className={styles.chartEmpty}>Historia fillon me tregtimin e parë.</div>;
  const minT = history[0].t, maxT = history.at(-1)?.t ?? minT + 1;
  const values = history.map((point) => point.coins);
  const minV = Math.min(...values), maxV = Math.max(...values), spread = maxV - minV || 1;
  const x = (t: number) => ((t - minT) / (maxT - minT || 1)) * width;
  const y = (value: number) => 8 + (1 - (value - minV) / spread) * (height - 20);
  const path = history.map((point, index) => index === 0
    ? `M${x(point.t).toFixed(1)},${y(point.coins).toFixed(1)}`
    : `H${x(point.t).toFixed(1)} V${y(point.coins).toFixed(1)}`).join(" ");
  const last = history.at(-1)!;
  return <svg className={styles.balanceChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ndryshimi i bilancit gjatë 30 ditëve të fundit"><path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={x(last.t)} cy={y(last.coins)} r="5" fill="currentColor" stroke="#fff" strokeWidth="2" /></svg>;
}

export default function ProfileHub({ identity, savedArticles: initialSaved, tregu, dataUnavailable, profileUnavailable }: {
  identity: { fullName: string; displayName: string; email: string; initials: string; anonymous: boolean; joinedAt: string; lastSignInAt: string | null; provider: string };
  savedArticles: SavedArticle[]; tregu: TreguData; dataUnavailable: { savedArticles: boolean; tregu: boolean }; profileUnavailable: boolean;
}) {
  const router = useRouter();
  const [savedArticles, setSavedArticles] = useState(initialSaved);
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [draftName, setDraftName] = useState(identity.displayName);
  const [editingName, setEditingName] = useState(false);
  const [anonymous, setAnonymous] = useState(identity.anonymous);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [dangerMessage, setDangerMessage] = useState<string | null>(null);

  useEffect(() => {
    let localIds: string[] = [];
    try { localIds = normalizeBookmarkIds(JSON.parse(localStorage.getItem("bookmarks") ?? "[]")); } catch { return; }
    const remoteIds = new Set(initialSaved.map((article) => article.articleId));
    const missingIds = localIds.filter((articleId) => !remoteIds.has(articleId));
    if (!missingIds.length) return;
    void Promise.all(missingIds.map(async (articleId) => {
      const response = await fetch("/api/profile/saved-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const article = data.article;
      if (!article) return null;
      return {
        articleId: article.article_id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
        source: article.source,
        imageUrl: article.image_url,
        publishedAt: article.published_at,
        savedAt: article.saved_at,
      } satisfies SavedArticle;
    })).then((migrated) => {
      const articles = migrated.filter((article): article is SavedArticle => article !== null);
      if (articles.length) setSavedArticles((current) => [...articles, ...current]);
    });
  }, [initialSaved]);

  const balanceChange = useMemo(() => tregu.coins - (tregu.history[0]?.coins ?? tregu.coins), [tregu]);

  async function saveSettings(nextAnonymous = anonymous, nextName = draftName) {
    setSettingsBusy(true); setSettingsMessage(null);
    try {
      const response = await fetch("/api/profile/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: nextName, anonymous: nextAnonymous }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ndryshimet nuk u ruajtën.");
      const savedName = data.profile?.display_name ?? nextName.trim();
      setAnonymous(nextAnonymous); setDisplayName(savedName); setDraftName(savedName); setEditingName(false); setSettingsMessage("Ndryshimet u ruajtën.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Ndryshimet nuk u ruajtën. Provo përsëri.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeSaved(articleId: string) {
    setRemoveBusy(articleId); setSavedMessage(null);
    try {
      const response = await fetch("/api/profile/saved-articles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Artikulli nuk u hoq.");
      setSavedArticles((articles) => articles.filter((article) => article.articleId !== articleId));
      try { const ids = normalizeBookmarkIds(JSON.parse(localStorage.getItem("bookmarks") ?? "[]")); localStorage.setItem("bookmarks", JSON.stringify(ids.filter((id) => id !== articleId))); } catch { /* Account copy remains authoritative. */ }
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : "Artikulli nuk u hoq. Provo përsëri.");
    } finally {
      setRemoveBusy(null);
    }
  }

  async function signOut() {
    setSignOutBusy(true); setDangerMessage(null);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/"); router.refresh();
    } catch {
      setDangerMessage("Dalja nuk u krye. Kontrollo lidhjen dhe provo përsëri.");
      setSignOutBusy(false);
    }
  }
  async function deleteAccount() {
    if (deleteText.trim().toUpperCase() !== "FSHIJE") return;
    setDeleteBusy(true); setDangerMessage(null);
    try {
      const response = await fetch("/api/profile/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: deleteText }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Llogaria nuk u fshi.");
      await createClient().auth.signOut(); router.push("/"); router.refresh();
    } catch (error) {
      setDangerMessage(error instanceof Error ? error.message : "Llogaria nuk u fshi. Provo përsëri.");
      setDeleteBusy(false);
    }
  }

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.identity}>
      <div className={styles.avatar} aria-hidden>{identity.initials}</div>
      <div className={styles.identityCopy}><h1>{identity.fullName || displayName}</h1><p>{identity.email}</p><div className={styles.identityMeta}><span>Anëtar që nga {formatDate(identity.joinedAt)}</span><span>Hyrja e fundit {formatDate(identity.lastSignInAt, true)}</span></div></div>
      <div className={styles.profileState} data-anonymous={anonymous}><ShieldCheck size={18} aria-hidden /><div><strong>{anonymous ? "Profili publik është anonim" : "Profili publik përdor emrin tënd"}</strong><span>Ti vazhdon ta shohësh aktivitetin tënd normalisht.</span></div></div>
    </header>

    <nav className={styles.sectionNav} aria-label="Seksionet e profilit"><a href="#te-ruajtura"><Bookmark size={16} aria-hidden /> Të ruajtura</a><a href="#tregu"><Coins size={16} aria-hidden /> Tregu</a><a href="#privatesia"><ShieldCheck size={16} aria-hidden /> Privatësia</a><a href="#llogaria"><UserRound size={16} aria-hidden /> Llogaria</a></nav>

    <section id="te-ruajtura" className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>Leximi yt i ruajtur</h2><p>Artikujt që ruan mbeten këtu derisa t&apos;i heqësh vetë.</p></div><span className={styles.count}>{savedArticles.length} artikuj</span></div>
      {dataUnavailable.savedArticles ? <div className={styles.dataError} role="status"><strong>Të ruajturat nuk mund të ngarkoheshin.</strong><span>Asgjë nuk është humbur. Rifresko faqen për të provuar përsëri.</span></div> : !savedArticles.length ? <div className={styles.emptyState}><BookOpen size={28} aria-hidden /><div><strong>Nuk ke ruajtur ende asnjë artikull.</strong><p>Përdor butonin “Ruaj artikullin” gjatë leximit.</p></div><Link href="/">Shfleto lajmet <ArrowRight size={15} aria-hidden /></Link></div> :
        <div className={styles.savedLayout}>{savedArticles.map((article, index) => <article key={article.articleId} className={index === 0 ? styles.savedLead : styles.savedRow}>{article.imageUrl ? <img src={article.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className={styles.imageFallback}>383</div>}<div className={styles.savedCopy}><span>{article.category || article.source}</span><h3><Link href={`/article/${article.slug}`}>{article.title}</Link></h3>{index === 0 && article.excerpt && <p>{article.excerpt}</p>}<div className={styles.savedActions}><Link href={`/article/${article.slug}`}>Lexo artikullin <ChevronRight size={14} aria-hidden /></Link><button type="button" onClick={() => void removeSaved(article.articleId)} disabled={removeBusy === article.articleId}>{removeBusy === article.articleId ? "Po hiqet..." : "Hiqe"}</button></div></div></article>)}</div>}
      {savedMessage && <p className={styles.inlineError} role="status">{savedMessage}</p>}
    </section>

    <section id="tregu" className={`${styles.section} ${styles.treguSection}`}>
      <div className={styles.sectionHeading}><div><h2>383 Coin dhe tregtimet</h2><p>Bilanci, lëvizja 30-ditore dhe aktiviteti yt më i fundit.</p></div><Link className={styles.primaryLink} href="/tregu/portofoli">Hap portofolin <ArrowRight size={15} aria-hidden /></Link></div>
      {dataUnavailable.tregu ? <div className={styles.dataError} role="status"><strong>Të dhënat e Tregut nuk mund të ngarkoheshin.</strong><span>Bilanci yt nuk po paraqitet si zero. Provo përsëri pas pak.</span></div> : <div className={styles.treguGrid}><div className={styles.balancePanel}><div className={styles.balanceTop}><span>Bilanci i lirë</span><strong>{formatCoins(tregu.coins)} <small>383C</small></strong></div><BalanceChart history={tregu.history} /><div className={styles.balanceFoot}><span className={balanceChange >= 0 ? styles.positive : styles.negative}>{balanceChange >= 0 ? "+" : ""}{balanceChange.toFixed(0)} 383C në 30 ditë</span><span>{tregu.activePositions} pozicione aktive</span></div></div>
        <div className={styles.activityPanel}><h3>Aktiviteti i fundit</h3>{!tregu.transactions.length ? <p className={styles.noActivity}>Tregtimi yt i parë do të shfaqet këtu.</p> : tregu.transactions.map((tx) => <div key={tx.id} className={styles.activityRow}><div><strong>{TX_LABELS[tx.type] ?? tx.type}</strong><span>{tx.market?.question ?? formatDate(tx.createdAt, true)}</span></div><b data-positive={tx.amount >= 0}>{tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(0)}</b></div>)}</div></div>
      }
    </section>

    <section id="privatesia" className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>Emri dhe privatësia</h2><p>Kontrollo se si shfaqesh kur komenton, tregton dhe ndërvepron.</p></div></div>
      <div className={styles.settingsGrid}><div className={styles.nameSetting}><div className={styles.settingIcon}><UserRound size={20} aria-hidden /></div><div className={styles.settingBody}><span>Emri publik</span>{editingName ? <div className={styles.nameEditor}><label htmlFor="display-name">Emri që shfaqet</label><input id="display-name" value={draftName} onChange={(event) => setDraftName(event.target.value.slice(0, 48))} maxLength={48} /><div><button type="button" onClick={() => void saveSettings()} disabled={settingsBusy}>Ruaj</button><button type="button" onClick={() => { setDraftName(displayName); setEditingName(false); }}>Anulo</button></div></div> : <div className={styles.nameValue}><strong>{displayName}</strong><button type="button" onClick={() => setEditingName(true)}><Pencil size={14} aria-hidden /> Ndrysho</button></div>}</div></div>
        <div className={styles.anonymousSetting}><div><strong>Shfaqem si Anonim</strong><p>Emri yt fshihet nga komentet, listat e mbajtësve dhe aktiviteti publik në Tregu. Emaili nuk shfaqet kurrë.</p></div><button type="button" role="switch" aria-checked={anonymous} aria-label="Shfaqem si Anonim" className={styles.switch} data-on={anonymous} disabled={settingsBusy || profileUnavailable} onClick={() => void saveSettings(!anonymous, displayName)}><span /></button></div></div>
      {settingsMessage && <p className={styles.settingsMessage} role="status"><Check size={14} aria-hidden /> {settingsMessage}</p>}{profileUnavailable && <p className={styles.settingsError}>Cilësimet e reja kërkojnë përditësimin e bazës së të dhënave.</p>}
    </section>

    <section id="llogaria" className={styles.accountSection}><div className={styles.accountInfo}><h2>Llogaria dhe qasja</h2><dl><div><dt>Emaili</dt><dd>{identity.email}</dd></div><div><dt>Mënyra e hyrjes</dt><dd>{identity.provider === "google" ? "Google" : "Email"}</dd></div><div><dt>Privatësia</dt><dd><Link href="/privatesia">Lexo politikën</Link></dd></div></dl></div>
      <div className={styles.dangerZone}><h2>Zona e rrezikut</h2><p>Dil nga kjo pajisje ose fshije përgjithmonë llogarinë dhe të dhënat e lidhura me të.</p><div className={styles.dangerActions}><button type="button" className={styles.signOut} disabled={signOutBusy} onClick={() => void signOut()}><LogOut size={16} aria-hidden /> {signOutBusy ? "Po del..." : "Dil nga llogaria"}</button><button type="button" className={styles.deleteTrigger} onClick={() => setDeleteOpen((open) => !open)}><Trash2 size={16} aria-hidden /> Fshi llogarinë</button></div>{deleteOpen && <div className={styles.deleteConfirm}><label htmlFor="delete-confirm">Shkruaj <strong>FSHIJE</strong> për ta konfirmuar.</label><div><input id="delete-confirm" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /><button type="button" onClick={() => void deleteAccount()} disabled={deleteBusy || deleteText.trim().toUpperCase() !== "FSHIJE"}>{deleteBusy ? "Po fshihet..." : "Fshije përgjithmonë"}</button></div></div>}{dangerMessage && <p className={styles.settingsError} role="alert">{dangerMessage}</p>}</div></section>
  </div></main>;
}
