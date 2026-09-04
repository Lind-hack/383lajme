import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { deleteDosjeTopics, deleteMilestone } from "@/lib/admin/dosje";

/**
 * Dossier deletion.
 *
 * Deliberately the only destructive dosje endpoint, and it takes an explicit
 * list of slugs. There is no "delete everything that looks ineligible" call:
 * the cleanup screen computes the reasons, the operator sees them, and what is
 * sent here is what they chose. A rule that deletes on its own would eventually
 * delete a dossier that was merely waiting for its first article.
 */

/** One request cannot wipe the whole table by accident. */
const MAX_BATCH = 50;

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Trup i pavlefshëm JSON" }, { status: 400 });
  }

  const milestoneId = typeof payload.milestoneId === "string" ? payload.milestoneId.trim() : "";
  if (milestoneId) {
    const result = await deleteMilestone(milestoneId);
    return result.ok
      ? NextResponse.json({ ok: true, deleted: result.deleted })
      : NextResponse.json({ error: result.error }, { status: 500 });
  }

  const slugs = Array.isArray(payload.slugs)
    ? payload.slugs.filter((s): s is string => typeof s === "string")
    : [];

  if (slugs.length === 0) {
    return NextResponse.json({ error: "Asnjë dosje e zgjedhur." }, { status: 400 });
  }
  if (slugs.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Maksimumi ${MAX_BATCH} dosje për kërkesë.` },
      { status: 400 },
    );
  }

  const result = await deleteDosjeTopics(slugs);
  return result.ok
    ? NextResponse.json({ ok: true, deleted: result.deleted })
    : NextResponse.json({ error: result.error }, { status: 500 });
}
