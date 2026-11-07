"use client";

import { useState } from "react";
import { MAX_CREATORS, normalizeCreators, safeHref, safeSrc, type Creator } from "@/projects/story-mode/creators";
import StoryModeCreators from "./StoryModeCreators";

// Lab-only editor for the creators list: edit, reorder, add and remove rows with a live preview,
// then "Save to repo" writes projects/story-mode/creators.json through the dev-only route.
// Commit that file to publish the change.
type Row = Creator & { key: number };
let nextKey = 1;
const withKeys = (list: Creator[]): Row[] => list.map((c) => ({ ...c, key: nextKey++ }));
const strip = (rows: Row[]): Creator[] => rows.map(({ name, role, url, avatar }) => ({ name, role, url, avatar }));

const FIELDS: { k: keyof Creator; label: string; placeholder: string }[] = [
  { k: "name", label: "Name", placeholder: "Display name (required)" },
  { k: "role", label: "Role", placeholder: "e.g. Plugin author" },
  { k: "url", label: "Link", placeholder: "https://github.com/user" },
  { k: "avatar", label: "Avatar", placeholder: "https://github.com/user.png" },
];

export default function StoryModeCreatorsEditor({ initial }: { initial: Creator[] }) {
  const [rows, setRows] = useState<Row[]>(() => withKeys(initial));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(initial));
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "busy"; text: string } | null>(null);

  const clean = normalizeCreators(strip(rows));
  const dirty = JSON.stringify(clean) !== saved;

  const update = (key: number, k: keyof Creator, v: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const next = rs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () =>
    setRows((rs) => (rs.length >= MAX_CREATORS ? rs : [...rs, { name: "", role: "", url: "", avatar: "", key: nextKey++ }]));
  const revert = () => {
    setRows(withKeys(JSON.parse(saved) as Creator[]));
    setStatus(null);
  };

  const save = async () => {
    setStatus({ kind: "busy", text: "Saving…" });
    try {
      const res = await fetch("/lab/story-mode/creators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ creators: clean }),
      });
      const json = (await res.json().catch(() => ({}))) as { creators?: Creator[]; error?: string };
      if (!res.ok || !json.creators) throw new Error(json.error || `HTTP ${res.status}`);
      setSaved(JSON.stringify(json.creators));
      setRows(withKeys(json.creators));
      setStatus({ kind: "ok", text: `Saved ${json.creators.length} to projects/story-mode/creators.json — commit it to publish.` });
    } catch (e) {
      setStatus({ kind: "err", text: `Save failed: ${(e as Error).message}` });
    }
  };

  const input =
    "w-full min-w-0 rounded-sm border border-white/15 bg-black/40 px-2 py-1.5 text-[13px] text-[#e8dcc8] placeholder:text-white/25 focus:border-[#ffb46e] focus:outline-none";
  const btn = "rounded-sm border border-white/15 px-2 py-1 text-white/70 hover:border-[#ffb46e] hover:text-[#ffb46e] disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-white/70";

  return (
    // right padding keeps the editor clear of the fixed lil-gui panel (300 px, top right)
    <section id="creators-editor" className="border-t border-white/10 py-10 pl-6 pr-6 font-mono text-xs lg:pr-[330px]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="tracking-[0.3em] text-[#ffb46e]">CREATORS EDITOR</h2>
          <span className="text-white/40">
            {clean.length} shown{rows.length !== clean.length ? ` · ${rows.length - clean.length} without a name (skipped)` : ""}
            {dirty ? " · unsaved changes" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <button className={btn} onClick={revert} disabled={!dirty}>
              Revert
            </button>
            <button
              className="rounded-sm border border-[#ffb46e] bg-[#ffb46e]/10 px-3 py-1 text-[#ffb46e] hover:bg-[#ffb46e]/20 disabled:opacity-30"
              onClick={save}
              disabled={!dirty || status?.kind === "busy"}
            >
              Save to repo
            </button>
          </div>
        </div>
        {status && (
          <p className={`mt-2 ${status.kind === "err" ? "text-red-400" : status.kind === "ok" ? "text-emerald-300" : "text-white/50"}`} role="status">
            {status.text}
          </p>
        )}

        <ol className="mt-5 grid gap-2">
          {rows.map((r, i) => {
            const badUrl = r.url.trim() !== "" && !safeHref(r.url);
            const badAvatar = r.avatar.trim() !== "" && !safeSrc(r.avatar);
            return (
              <li key={r.key} className="grid grid-cols-[1.5rem_repeat(4,minmax(0,1fr))_auto] items-start gap-2">
                <span className="pt-2 text-right text-white/30">{i + 1}</span>
                {FIELDS.map((f) => {
                  const bad = (f.k === "url" && badUrl) || (f.k === "avatar" && badAvatar) || (f.k === "name" && !r.name.trim());
                  return (
                    <label key={f.k} className="grid gap-1">
                      <span className="sr-only">{f.label}</span>
                      <input
                        className={`${input} ${bad ? "border-red-400/60" : ""}`}
                        value={r[f.k]}
                        placeholder={f.placeholder}
                        onChange={(e) => update(r.key, f.k, e.target.value)}
                      />
                      {f.k === "url" && badUrl && <span className="text-[11px] text-red-400">Use https://…, mailto:… or /path</span>}
                      {f.k === "avatar" && badAvatar && <span className="text-[11px] text-red-400">Use https://… or /path</span>}
                    </label>
                  );
                })}
                <span className="flex gap-1">
                  <button className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.name || "row"} up`}>
                    ↑
                  </button>
                  <button className={btn} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.name || "row"} down`}>
                    ↓
                  </button>
                  <button className={btn} onClick={() => remove(r.key)} aria-label={`Remove ${r.name || "row"}`}>
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <button className={`${btn} mt-3`} onClick={add} disabled={rows.length >= MAX_CREATORS}>
          + Add creator
        </button>
        <p className="mt-3 text-white/35">
          Links open in a new tab. Leave Link empty for a non-clickable card. Avatar empty → initials. Unsafe links are ignored on the page.
        </p>
      </div>

      <div className="sm-section mt-10">
        <div className="sm-section-grid !py-12">
          <StoryModeCreators creators={clean} />
        </div>
      </div>
    </section>
  );
}
