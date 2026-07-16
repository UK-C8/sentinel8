import { redirect } from "next/navigation";

// Public front door: new visitors land on the free scan (BR-6 lead magnet),
// then flow /scan → /onboarding → /dashboard. When auth lands, branch here:
// logged-in → /dashboard, anonymous → /scan.
export default function Home() {
  redirect("/scan");
}
