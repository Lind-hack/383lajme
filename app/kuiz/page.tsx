import { redirect } from "next/navigation";

// Kuizi i ditës was retired on 2026-10-24. Shared quiz links land on the
// homepage instead of an empty quiz; components/kuizi-dites and
// lib/kuizi-server are kept, so the page can come back from git history.
export default function KuizPage() {
  redirect("/");
}
