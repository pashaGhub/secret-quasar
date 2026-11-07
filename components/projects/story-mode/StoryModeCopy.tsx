// Text column of the Story Mode section. No hooks, so it renders on the server (home page) and in
// the client lab alike. The real heading is the visually hidden text; the per-letter title is a
// decorative duplicate that "ignites" each time the book opens (CSS reacts to the scene's data-book).
const TITLE = "Story Mode";
const SUBTITLE = "Experience OSRS like never before";

/** Where "Read more" goes. Placeholder until the project page / plugin page exists. */
export const READ_MORE_HREF = "https://github.com/phyce/rl-natural-speech";

const POINTS = [
  {
    title: "Relive every quest",
    body: "Familiar quests, told the way they were always meant to sound.",
  },
  {
    title: "Integrate ElevenLabs",
    body: "Connect your ElevenLabs account and quest dialogue is voiced as you play.",
  },
  {
    title: "Create custom voices",
    body: "Shape a unique voice for any character, or design your own.",
  },
];

export default function StoryModeCopy() {
  const external = /^https?:\/\//.test(READ_MORE_HREF);
  return (
    <div className="sm-copy">
      <p className="sm-kicker">RuneLite plugin · Natural Speech</p>

      <hgroup>
        <h2 id="story-mode-title" className="sm-title">
          <span className="sr-only">{TITLE}</span>
          <span aria-hidden="true">
            {[...TITLE].map((ch, i) =>
              ch === " " ? (
                <span key={i} className="sm-sp" />
              ) : (
                <span
                  key={i}
                  className="sm-l"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {ch}
                </span>
              ),
            )}
          </span>
        </h2>
        <p
          className="sm-subtitle"
          style={{ "--n": TITLE.length } as React.CSSProperties}
        >
          {SUBTITLE}
        </p>
      </hgroup>

      <svg className="sm-divider" viewBox="0 0 240 18" aria-hidden="true">
        <path className="sm-divider-line" pathLength={1} d="M108 9 H4" />
        <path className="sm-divider-line" pathLength={1} d="M132 9 H236" />
        <path className="sm-divider-gem" d="M120 2 L127 9 L120 16 L113 9 Z" />
        <circle className="sm-divider-gem" cx="120" cy="9" r="1.6" />
      </svg>

      <p className="sm-lede">
        Quests deserve better than a monotone reader. Story Mode gives every NPC
        a real voice — with emotion, pacing and personality — so each dialogue
        plays like a scene from an audiobook.
      </p>

      <ul className="sm-points">
        {POINTS.map((p) => (
          <li key={p.title}>
            <svg className="sm-bullet" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" />
            </svg>
            <div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <a
        className="sm-btn sm-btn-lg sm-readmore"
        href={READ_MORE_HREF}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <svg className="sm-btn-gem" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" />
        </svg>
        Read more
        <span className="sr-only"> about Story Mode</span>
        <svg className="sm-btn-arrow" viewBox="0 0 20 12" aria-hidden="true">
          <path d="M1 6 H17 M12 1.5 L17.5 6 L12 10.5" />
        </svg>
      </a>
    </div>
  );
}
