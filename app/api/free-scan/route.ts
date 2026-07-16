import { NextRequest, NextResponse } from "next/server";
import { validateRepoUrl, hashIp, isRateLimited, createFreeScan } from "@/lib/free-scan";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({ url: null }));
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Repository URL required" }, { status: 400 });
  }

  const repo = validateRepoUrl(url);
  if ("error" in repo) {
    return NextResponse.json({ error: repo.error }, { status: 400 });
  }

  // Client IP — trust the platform's forwarded header (Vercel sets x-forwarded-for)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "0.0.0.0";
  const ipHash = hashIp(ip);

  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      { error: "Rate limit reached (5 scans/hour). Sign up for unlimited scans." },
      { status: 429 }
    );
  }

  const token = await createFreeScan(repo, ipHash);
  await track("free_scan_started", ipHash, { repo: repo.display });

  return NextResponse.json({ token, repo: repo.display }, { status: 202 });
}
