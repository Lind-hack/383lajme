"use client";

import { useState } from "react";
import Image from "next/image";

export type AdminArticle = {
  id: string;
  file: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  source: string;
  sourceFlag: string;
  category: string;
  score: number;
  publishedAt: string;
  slug: string;
};

type EditState = { title: string; excerpt: string };

export default function AdminClient({ articles: initial }: { articles: AdminArticle[] }) {
  const [articles, setArticles] = useState(initial);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const filtered = articles.filter((a) =>
    search === "" ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.source.toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(a: AdminArticle) {
    setEditing((prev) => ({ ...prev, [a.id]: { title: a.title, excerpt: a.excerpt } }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function saveEdit(a: AdminArticle) {
    const edits = editing[a.id];
    if (!edits) return;
    setSaving((prev) => ({ ...prev, [a.id]: true }));
    try {
      const res = await fetch("/api/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: a.id, file: a.file, title: edits.title, excerpt: edits.excerpt }),
      });
      if (!res.ok) throw new Error(await res.text());
      setArticles((prev) =>
        prev.map((x) => x.id === a.id ? { ...x, title: edits.title, excerpt: edits.excerpt } : x)
      );
      cancelEdit(a.id);
    } catch (err) {
      alert(`Gabim: ${String(err)}`);
    } finally {
      setSaving((prev) => { const next = { ...prev }; delete next[a.id]; return next; });
    }
  }

  async function deleteArticle(a: AdminArticle) {
    if (!confirm(`Fshi "${a.title.slice(0, 60)}"?`)) return;
    setDeleting((prev) => ({ ...prev, [a.id]: true }));
    try {
      const res = await fetch(`/api/admin/articles?id=${encodeURIComponent(a.id)}&file=${encodeURIComponent(a.file)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setArticles((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      alert(`Gabim: ${String(err)}`);
    } finally {
      setDeleting((prev) => { const next = { ...prev }; delete next[a.id]; return next; });
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    window.location.reload();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F9F6F1", fontFamily: "var(--font-manrope), sans-serif" }}>
      {/* Header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #E8E3DB",
          padding: "0 32px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a href="/" style={{ fontWeight: 900, fontSize: "20px", color: "#111", textDecoration: "none" }}>383</a>
          <span style={{ fontWeight: 600, fontSize: "12px", color: "#999", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
          <span style={{ fontSize: "12px", color: "#bbb", marginLeft: "8px" }}>{articles.length} artikuj</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input
            type="search"
            placeholder="Kërko..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1.5px solid #E8E3DB",
              fontSize: "13px",
              fontFamily: "inherit",
              outline: "none",
              width: "200px",
              background: "#FAFAF8",
            }}
          />
          <button
            onClick={logout}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1.5px solid #E8E3DB",
              background: "transparent",
              fontSize: "13px",
              cursor: "pointer",
              color: "#666",
              fontFamily: "inherit",
            }}
          >
            Dil
          </button>
        </div>
      </header>

      {/* Article list */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 24px" }}>
        {filtered.length === 0 && (
          <p style={{ color: "#999", textAlign: "center", marginTop: "64px" }}>Nuk ka artikuj.</p>
        )}
        {filtered.map((a) => {
          const isEditing = Boolean(editing[a.id]);
          const isSaving = Boolean(saving[a.id]);
          const isDeleting = Boolean(deleting[a.id]);
          const edits = editing[a.id];

          return (
            <div
              key={a.id}
              style={{
                background: "#fff",
                border: "1px solid #E8E3DB",
                borderRadius: "16px",
                marginBottom: "12px",
                overflow: "hidden",
                opacity: isDeleting ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {/* Normal row */}
              <div style={{ display: "flex", gap: "16px", padding: "16px 20px", alignItems: "flex-start" }}>
                {/* Thumbnail */}
                {a.imageUrl && (
                  <div style={{ flexShrink: 0, width: "80px", height: "56px", borderRadius: "8px", overflow: "hidden", background: "#f0ece6" }}>
                    <Image
                      src={a.imageUrl}
                      alt=""
                      width={80}
                      height={56}
                      style={{ objectFit: "cover", width: "100%", height: "100%" }}
                      unoptimized
                    />
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#999" }}>{a.sourceFlag} {a.source}</span>
                    <span style={{ fontSize: "11px", color: "#ccc" }}>·</span>
                    <span
                      style={{
                        fontSize: "11px",
                        background: "#f0ece6",
                        color: "#666",
                        borderRadius: "4px",
                        padding: "1px 6px",
                      }}
                    >
                      {a.category}
                    </span>
                    <span style={{ fontSize: "11px", color: "#ccc" }}>·</span>
                    <span style={{ fontSize: "11px", color: a.score >= 8 ? "#22863a" : a.score >= 6 ? "#b7791f" : "#999", fontWeight: 700 }}>
                      {a.score.toFixed(1)}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#111", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#888", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                    {a.excerpt}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => (isEditing ? cancelEdit(a.id) : startEdit(a))}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #E8E3DB",
                      background: isEditing ? "#f0ece6" : "transparent",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#555",
                      fontFamily: "inherit",
                    }}
                  >
                    {isEditing ? "Anulo" : "Edito"}
                  </button>
                  <button
                    onClick={() => deleteArticle(a)}
                    disabled={isDeleting}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #fecaca",
                      background: "transparent",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#e53e3e",
                      fontFamily: "inherit",
                    }}
                  >
                    {isDeleting ? "..." : "Fshi"}
                  </button>
                </div>
              </div>

              {/* Edit form (inline expand) */}
              {isEditing && edits && (
                <div
                  style={{
                    borderTop: "1px solid #E8E3DB",
                    padding: "20px",
                    background: "#FAFAF8",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                      Titulli
                    </label>
                    <input
                      type="text"
                      value={edits.title}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [a.id]: { ...prev[a.id], title: e.target.value } }))}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #E8E3DB",
                        fontSize: "14px",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        outline: "none",
                        background: "#fff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                      Përshkrimi
                    </label>
                    <textarea
                      value={edits.excerpt}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [a.id]: { ...prev[a.id], excerpt: e.target.value } }))}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #E8E3DB",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        outline: "none",
                        background: "#fff",
                        resize: "vertical",
                        lineHeight: 1.6,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      onClick={() => cancelEdit(a.id)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "8px",
                        border: "1.5px solid #E8E3DB",
                        background: "transparent",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        color: "#666",
                        fontFamily: "inherit",
                      }}
                    >
                      Anulo
                    </button>
                    <button
                      onClick={() => saveEdit(a)}
                      disabled={isSaving}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#FF4422",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      {isSaving ? "Duke ruajtur..." : "Ruaj"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
