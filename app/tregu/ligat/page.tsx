import { redirect } from "next/navigation";

/** Ligat live on the Tregu floor now, under Sportet në Treg. Old invite links
 *  (/tregu/ligat?kodi=K7MQ2P) still land on the join preview there. */
export default async function LigatPage({ searchParams }: { searchParams: Promise<{ kodi?: string | string[] }> }) {
  const { kodi } = await searchParams;
  const code = (Array.isArray(kodi) ? kodi[0] : kodi)?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  redirect(code ? `/tregu?kodi=${code}#ligat` : "/tregu#ligat");
}
