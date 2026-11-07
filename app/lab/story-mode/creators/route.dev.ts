import { writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeCreators } from "@/projects/story-mode/creators";

// Development-only: the Story Mode lab saves the creators list into the repo through this route.
// It 404s in production builds (and Vercel's filesystem is read-only anyway); commit the JSON to
// publish a change.
const FILE = path.join(process.cwd(), "projects", "story-mode", "creators.json");

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  // same-origin only: another site open in the browser can't rewrite the file
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const creators = normalizeCreators((body as { creators?: unknown } | null)?.creators);
  await writeFile(FILE, JSON.stringify(creators, null, 2) + "\n", "utf8");
  return Response.json({ ok: true, creators });
}
