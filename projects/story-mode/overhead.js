// OSRS-style overhead text (yellow, black shadow) that follows a character's head anchor.
// This is the hook for voiced dialogue later: e.g. on 'turn', play an ElevenLabs clip and call
//   say('wise_old_man', 'Gather round, adventurer…', clipDurationMs)
// Text is decorative (aria-hidden); anything meaningful must also exist in the page's HTML.

export function createOverhead(container, engine) {
  const layer = document.createElement('div');
  layer.className = 'sm-overhead';
  layer.setAttribute('aria-hidden', 'true');
  container.append(layer);
  const active = new Set();
  let raf = 0;
  const pos = { x: 0, y: 0 };

  const tick = () => {
    raf = 0;
    for (const m of active) {
      const p = engine.anchorScreen(m.character, 'overhead', pos);
      if (p) m.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      m.el.style.visibility = p ? 'visible' : 'hidden';
    }
    if (active.size) raf = requestAnimationFrame(tick);
  };

  return {
    /** Show `text` above `character` for `ms` milliseconds. Returns a function that removes it early. */
    say(character, text, ms = 2600) {
      // OSRS shows one line per speaker: replace what this character was saying
      for (const m of active) if (m.character === character) m.remove();
      const el = document.createElement('div');
      el.className = 'sm-overhead-text';
      el.textContent = text;
      layer.append(el);
      const m = {
        character, el,
        remove() { clearTimeout(m.timer); el.remove(); active.delete(m); },
      };
      m.timer = setTimeout(m.remove, ms);
      active.add(m);
      if (!raf) raf = requestAnimationFrame(tick);
      return m.remove;
    },
    dispose() {
      cancelAnimationFrame(raf);
      for (const m of [...active]) m.remove();
      layer.remove();
    },
  };
}
