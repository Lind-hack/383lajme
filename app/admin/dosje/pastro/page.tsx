import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { dosjeTopics } from "@/lib/admin/dosje";
import AdminNav from "../../_components/AdminNav";
import DosjeCleanup from "../_components/DosjeCleanup";

/**
 * Which dossiers are going nowhere, and why.
 *
 * A dossier with no anchors can never match an article -- 0051 makes anchors
 * the precondition for matching at all -- and one with no approved milestone
 * renders an empty page even once it does match. Neither state was visible
 * anywhere, so unpublishable topics accumulated with nothing to distinguish
 * them from ones simply waiting for their first article.
 */

export const dynamic = "force-dynamic";

export default async function DosjeCleanupPage() {
  if (!(await isAdminAuthed())) {
    return (
      <>
        <AdminNav />
        <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
          <p className="panel m-0 p-4 text-[13px] font-semibold">Hyr së pari.</p>
        </main>
      </>
    );
  }

  const { topics, mode, error } = await dosjeTopics();

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/admin/dosje" className="btn btn-sm">
            <ArrowLeft size={14} strokeWidth={2.3} aria-hidden />
            Radha
          </Link>
          <h1 className="m-0 text-[16px] font-black tracking-tight">Pastrimi i dosjeve</h1>
        </div>

        {error ? (
          <div
            role="alert"
            className="panel flex items-start gap-2.5 px-4 py-3.5"
            style={{ borderColor: "rgba(180,24,26,0.3)" }}
          >
            <AlertCircle size={17} aria-hidden style={{ color: "var(--a-danger)", flexShrink: 0 }} />
            <p className="m-0 text-[13px] font-semibold" style={{ color: "var(--a-danger)" }}>
              {error}
            </p>
          </div>
        ) : (
          <DosjeCleanup topics={topics} canDelete={mode === "service"} />
        )}
      </main>
    </>
  );
}
