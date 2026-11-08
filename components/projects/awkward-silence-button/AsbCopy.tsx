// Text column of the Awkward Silence Button section (copy from the app's locales/en/common.json).
// No hooks, so it renders on the server. The real heading is the visually hidden text; the per-letter
// title is a decorative duplicate that pops in with the scene's first press (AsbSectionFx + CSS).
// The legend chips light up for the category the latest press chose.
const TITLE: [string, string][] = [
  ["Awkward Silence", "asb-t-plain"],
  ["Button", "asb-t-hot"],
];
const TITLE_TEXT = TITLE.map(([w]) => w).join(" ");

export const SITE_HREF = "https://awkwardsilencebutton.com";

const STEPS = [
  "Press the big red button",
  "Get a random icebreaker question",
  "Break the silence and let the conversation flow",
];

/** Display order = the app's CATEGORY_KEYS; colours = the scene's (app hues, saturated). */
export const CATEGORIES = [
  { key: "personal", label: "Personal", color: "#a66bff" },
  { key: "romantic", label: "Romantic", color: "#ff4f86" },
  { key: "philosophical", label: "Philosophical", color: "#2ff5dc" },
  { key: "culture", label: "Culture", color: "#ffc72e" },
  { key: "common", label: "Common", color: "#3f8cff" },
  { key: "food", label: "Food", color: "#ff8a1f" },
  { key: "travelAndAdventure", label: "Travel & Adventure", color: "#45ff8a" },
] as const;

export default function AsbCopy() {
  let n = 0; // running letter index for the stagger
  return (
    <div className="asb-copy">
      <p className="asb-kicker">Icebreaker app · Web, iOS &amp; Android</p>

      <hgroup>
        <h2 id="asb-title" className="asb-title">
          <span className="sr-only">{TITLE_TEXT}</span>
          <span aria-hidden="true">
            {TITLE.map(([word, cls]) => (
              <span key={word} className={`asb-tw ${cls}`}>
                {[...word].map((ch) => {
                  const i = n++; // one index per character: the key and the stagger delay (--i)
                  return ch === " " ? (
                    <span key={i} className="asb-sp"> </span>
                  ) : (
                    <span key={i} className="asb-l" style={{ "--i": i } as React.CSSProperties}>
                      {ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </span>
        </h2>
        <p className="asb-tagline">Press when the conversation dies.</p>
      </hgroup>

      <p className="asb-lede">
        One press is all it takes to rescue a dying conversation. The Awkward Silence Button instantly
        delivers a fun icebreaker question — no preparation, no awkwardness required.
      </p>

      <ol className="asb-steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <span className="asb-step-n" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <ul className="asb-legend" aria-label="Question categories">
        {CATEGORIES.map((c) => (
          <li key={c.key} className="asb-chip" data-cat={c.key} style={{ "--c": c.color } as React.CSSProperties}>
            <span
              className="asb-chip-icon"
              aria-hidden="true"
              style={{ "--icon": `url(/projects/awkward-silence-button/icons/${c.key}.svg)` } as React.CSSProperties}
            />
            {c.label}
          </li>
        ))}
      </ul>

      <a className="asb-cta" href={SITE_HREF} target="_blank" rel="noopener noreferrer">
        Try it at awkwardsilencebutton.com
        <span className="sr-only"> (opens in a new tab)</span>
        <svg className="asb-cta-arrow" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 9 L9 3 M4 3 H9 V8" />
        </svg>
      </a>
    </div>
  );
}
