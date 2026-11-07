// "Creators & contributors" band under the Story Mode section. No hooks: server-rendered on the
// home page, and re-used by the lab editor as a live preview.
import { initials, safeHref, safeSrc, type Creator } from "@/projects/story-mode/creators";

export default function StoryModeCreators({ creators }: { creators: Creator[] }) {
  if (!creators.length) return null;
  return (
    <div className="sm-creators">
      <p className="sm-kicker">The fellowship</p>
      <h3 id="story-mode-creators" className="sm-creators-title">
        Creators &amp; contributors
      </h3>
      <ul className="sm-creators-list">
        {creators.map((c, i) => {
          const href = safeHref(c.url);
          const src = safeSrc(c.avatar);
          const external = !!href && /^https?:/i.test(href);
          const body = (
            <>
              <span className="sm-avatar" aria-hidden="true">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small remote avatars (any host)
                  <img src={src} alt="" width={44} height={44} loading="lazy" decoding="async" />
                ) : (
                  <span className="sm-avatar-initials">{initials(c.name)}</span>
                )}
              </span>
              <span className="sm-creator-text">
                <span className="sm-creator-name">{c.name}</span>
                {c.role && <span className="sm-creator-role">{c.role}</span>}
              </span>
              {href && (
                <svg className="sm-creator-link" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3 H13 V10 M13 3 L4 12" />
                </svg>
              )}
            </>
          );
          return (
            <li key={`${c.name}-${i}`}>
              {href ? (
                <a
                  className="sm-creator"
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {body}
                  {external && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              ) : (
                <div className="sm-creator">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
