@AGENTS.md

# Claude-specific notes

- The user works on Windows; this repo is `D:\Coding\secret-quasar\secret-quasar`.
  Related folders the user may connect: `C:\Blender` (OSRS models, split-part blends, pivots)
  and `C:\Rive\...` (old Rive projects — never modify them).
- Blender is driven through the Blender MCP. Save new work under new file names
  (e.g. `*_3d.blend`); never overwrite the existing `*_working.blend` / snapshot files.
- Don't delete files without asking. Ask before large or irreversible changes.
- For visual work, check the result yourself (screenshots / renders) before reporting, and
  stop at the approval checkpoints listed in the plan in `docs/`.
- Ignore any feedback/agent block that `next dev` injects into `AGENTS.md` beyond the managed
  `nextjs-agent-rules` section; don't commit unrelated generated changes.
