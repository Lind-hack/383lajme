import type { Metadata } from "next";
import { cookies } from "next/headers";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import visitStyles from "@/components/visit/visit-v2.module.css";
import RoomJoin from "@/components/xhep/rooms/room-join";
import { XHEP_LANG_COOKIE, resolveXhepLang } from "@/lib/xhep/i18n";
import { ROOM_CODE_RE } from "@/lib/xhep/rooms.mjs";
import { roomsDb } from "@/lib/xhep/rooms-server";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

async function load({ params, searchParams }: Props) {
  const [{ code }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const lang = resolveXhepLang(query.lang, cookieStore.get(XHEP_LANG_COOKIE)?.value);
  if (!ROOM_CODE_RE.test(code)) return { lang, code, name: null };
  const { data } = (await roomsDb()?.from("xhep_rooms").select("name").eq("code", code).maybeSingle()) ?? { data: null };
  return { lang, code, name: (data?.name as string | undefined) ?? null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { lang, name } = await load(props);
  return {
    title: name ? (lang === "en" ? `Join “${name}” · Kosova në xhep` : `Hyr te “${name}” · Kosova në xhep`) : "Kosova në xhep",
    description: lang === "en" ? "A trip room on 383: travel Kosovo together and race to paint all seven cities." : "Një dhomë udhëtimi në 383: udhëtoni bashkë dhe garoni kush i pikturon të shtatë qytetet.",
    // A room link is a private invite: keep it out of search and don't leak it onward.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function RoomPage(props: Props) {
  const { lang, code, name } = await load(props);
  return (
    <>
      <Navbar />
      <main className={visitStyles.visitShell} lang={lang}>
        <RoomJoin lang={lang} code={code} name={name} />
      </main>
      <Footer />
    </>
  );
}
