import { NextResponse } from "next/server";
import { githubAppInstallUrl } from "@/lib/github";

// Redirect operator to GitHub App install page
export async function GET() {
  return NextResponse.redirect(githubAppInstallUrl());
}
