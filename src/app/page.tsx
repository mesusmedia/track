import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "agency_admin" ? "/admin" : "/cliente");
}
