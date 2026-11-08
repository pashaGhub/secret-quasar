// "The fellowship" band under the Awkward Silence Button section: the people behind it, from
// projects/awkward-silence-button/creators.json. No hooks, so it renders on the server.
import { initials, safeHref, safeSrc, type Creator } from "@/projects/story-mode/creators";

export default function AsbCreators({ creators }: { creators: Creator[] }) {
  if (!creators.length) return null;
  return (
    <div className="asb-creators">
      <p className="asb-kicker asb-creators-kicker">The fellowship</p>
      <h3 id="asb-creators" className="asb-creators-title">
        Creators &amp; contributors
      </h3>
      <ul className="asb-creators-list" aria-labelledby="asb-creators">
        {creators.map((c, i) => {
          const href = safeHref(c.url);
          const src = safeSrc(c.avatar);
          const external = !!href && /^https?:/i.test(href);
          const body = (
            <>
              <span className="asb-avatar" aria-hidden="true">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small remote avatars (any host)
                  <img src={src} alt="" width={44} height={44} loading="lazy" decoding="async" />
                ) : (
                  <span className="asb-avatar-initials">{initials(c.name)}</span>
                )}
              </span>
              <span className="asb-creator-text">
                <span className="asb-creator-name">{c.name}</span>
                {c.role && <span className="asb-creator-role">{c.role}</span>}
              </span>
              {href && (
                <svg className="asb-creator-link" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3 H13 V10 M13 3 L4 12" />
                </svg>
              )}
            </>
          );
          return (
            <li key={`${c.name}-${i}`}>
              {href ? (
                <a
                  className="asb-creator"
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {body}
                  {external && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              ) : (
                <div className="asb-creator">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
