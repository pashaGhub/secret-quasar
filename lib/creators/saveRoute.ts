import { writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeCreators } from "@/projects/story-mode/creators";

/**
 * POST handler for a project's dev-only creators route (`app/lab/<slug>/creators/route.dev.ts`):
 * validates the list and writes it to `file` (repo-relative, e.g. "projects/<slug>/creators.json").
 * Development only: it 404s in production builds (and the route file only exists under `next dev`);
 * same-origin only, so another site open in the browser can't rewrite the file. Commit the JSON to publish.
 */
export function creatorsSaveHandler(file: string) {
  const target = path.join(process.cwd(), ...file.split("/"));
  return async function POST(request: Request) {
    if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

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
    await writeFile(target, JSON.stringify(creators, null, 2) + "\n", "utf8");
    return Response.json({ ok: true, creators });
  };
}
