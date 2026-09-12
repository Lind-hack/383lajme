import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import AutomationDashboard from "./AutomationDashboard";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  if (!(await isAdminAuthed())) redirect("/admin");
  return <AutomationDashboard />;
}
