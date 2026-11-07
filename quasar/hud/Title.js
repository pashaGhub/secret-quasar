// "SECRET QUASAR" title — a visual overlay on the GPU canvas, driven by the timeline through
// the bridge (independent of which HUD is mounted, and still visible with the HUD off).
// The accessible, crawlable <h1> is rendered by React; this element is decorative (aria-hidden).
//
//   off   → before the jets ignite (and again after a restart)
//   drop  → Phase 4, as the jets punch out: big centred title card, decoded letter by letter
//   dock  → Phase 5 (active): settles into the upper-left slot under the visor header
//
// On every periodic energy burst the title glitches in sync with the screen.

const WORD1 = 'SECRET';
const WORD2 = 'QUASAR';
const GLYPHS = '▚▞░▒▓/\\<>#%Σ∆Ξ01';
const DROP_AT = 0.28; // phase-4 progress at which the jets ignite (T.ACTIVATE + 1.4 s)

const letters = (w) => [...w].map((c) => `<span data-c="${c}">${c}</span>`).join('');

/**
 * @param {HTMLElement} root   the title element
 * @param {HTMLElement} host   the hero element — its size sets the layout scale
 * @returns {{ dispose(): void, show(stage: 'dock'|'drop'|'off'): void }}
 */
export function mountTitle(root, host, { telemetry }) {
  root.classList.add('sq-title', 'instant');
  root.dataset.stage = 'off';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <span class="sq-l1">${letters(WORD1)}</span>
    <span class="sq-l2">${letters(WORD2)}</span>
    <span class="sq-bar"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>`;

  const spans = [...root.querySelectorAll('[data-c]')];

  // same layout scale and portrait switch as the HUD (hud.css)
  const layout = () => {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    const compact = w / h < 0.95 || w < 760;
    const s = compact ? Math.min(1.5, Math.max(0.6, Math.min(w / 490, h / 1000)))
      : Math.min(1.3, Math.max(0.45, Math.min(w / 1440, h / 860)));
    root.style.setProperty('--s', s.toFixed(3));
    root.classList.toggle('compact', compact);
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(host);

  let stage = null;
  let lastBurst = -1;
  let raf = 0;
  let glitchTimer = 0;
  let instantRaf = 0;

  // letter-by-letter decode: random glyphs settle into the real characters
  const decode = () => {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const tick = (now) => {
      const e = (now - t0) / 1000;
      let busy = false;
      spans.forEach((s, i) => {
        const settle = 0.18 + i * 0.055;
        if (e < settle) { s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; busy = true; }
        else s.textContent = s.dataset.c;
      });
      if (busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const glitch = () => {
    root.classList.remove('glitch');
    void root.offsetWidth; // restart the animation
    root.classList.add('glitch');
    clearTimeout(glitchTimer);
    glitchTimer = setTimeout(() => root.classList.remove('glitch'), 480);
  };

  const setStage = (next, { quiet = false } = {}) => {
    if (next === stage) return;
    // first appearance mid-sequence (deep link / resize) → no fly-in
    if (stage === null || (stage === 'off' && next === 'dock')) {
      root.classList.add('instant');
      cancelAnimationFrame(instantRaf);
      instantRaf = requestAnimationFrame(() => { instantRaf = requestAnimationFrame(() => root.classList.remove('instant')); });
    }
    if (!quiet && next !== 'off' && (stage === 'off' || stage === null)) { decode(); glitch(); }
    root.dataset.stage = next;
    stage = next;
  };

  const unsub = telemetry.subscribe((Tm) => {
    setStage(Tm.phase === 4 ? 'dock' : Tm.phase === 3 && Tm.phaseProgress >= DROP_AT ? 'drop' : 'off');
    const b = Tm.burstCount ?? 0;
    if (b !== lastBurst) {
      if (lastBurst >= 0 && b > lastBurst && stage === 'dock') glitch();
      lastBurst = b;
    }
  });

  return {
    /** Pin the title to a stage without the timeline (used by the static fallback). */
    show(next) { unsub(); setStage(next, { quiet: true }); },
    dispose() {
      unsub();
      ro.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(instantRaf);
      clearTimeout(glitchTimer);
      root.innerHTML = '';
      root.className = '';
      root.removeAttribute('data-stage');
    },
  };
}
