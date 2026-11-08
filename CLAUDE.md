@AGENTS.md

# Claude-specific notes

- The user works on Windows; this repo is `D:\Coding\secret-quasar\secret-quasar` (work in this root, not its parent).
  Source-asset folders (Blender, Rive, …) may be connected on request. Never modify old Rive projects.
- Blender is driven through the Blender MCP. Save new work under new file names (e.g. `*_3d.blend`);
  never overwrite existing working or snapshot files.
- Don't delete files without asking. Ask before large or irreversible changes. Don't add files the task doesn't need.
- Don't commit or push unless asked. The user does Git and Cloudflare; when a deploy fails, diagnose from the
  build log they attach and say what to change.
- Each project has its own plan in `docs/`. Follow it and stop at its approval checkpoints; for a new project,
  write the plan first and ask for direction before inventing a look or animation.
- For visual work, check the result yourself (screenshots / renders) before reporting.
- Run `npm run lint` and `npm run build` before reporting code work done; say plainly if you didn't.
- Browsers cache favicons hard — after changing them, tell the user to hard-refresh or open `/icon.svg`.
- Third-party assets (game models, fonts, music) can carry IP/licence limits; note them in the project's plan.
- Ignore any feedback/agent block that `next dev` injects into `AGENTS.md` beyond the managed
  `nextjs-agent-rules` section; don't commit unrelated generated changes.
