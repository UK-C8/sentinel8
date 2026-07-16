import { createSign } from "crypto";

// Generates a GitHub App JWT (10 min validity) used to exchange for
// an installation access token. Private key is PEM, stored in env.
function appJWT(): string {
  const appId = process.env.GITHUB_APP_ID!;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const sig = sign.sign(privateKey, "base64url");
  return `${unsigned}.${sig}`;
}

export async function getInstallationToken(installationId: string): Promise<string> {
  const jwt = appJWT();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { token: string };
  return data.token;
}

export function githubAppInstallUrl(): string {
  return `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
}
