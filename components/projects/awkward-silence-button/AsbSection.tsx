import AsbCopy from "./AsbCopy";
import AsbCreators from "./AsbCreators";
import AsbScene from "./AsbScene";
import AsbSectionFx from "./AsbSectionFx";
import { CREATORS } from "@/projects/awkward-silence-button/creators";
import "./asb-section.css";

/**
 * Awkward Silence Button — server-rendered section shell: copy on the left, the WebGL scene on the
 * right (above the copy on phones). The scene is a client island that loads its engine lazily;
 * AsbSectionFx ties the legend chips and the title reveal to the scene's asb:* events. Creators &
 * contributors ("The fellowship") run across the bottom, as in Story Mode.
 */
export default function AsbSection() {
  return (
    <section id="awkward-silence-button" aria-labelledby="asb-title" className="asb-section">
      <div className="asb-section-bg" aria-hidden="true" />
      <div className="asb-section-grid">
        <AsbCopy />
        <div className="asb-viewer">
          <div className="asb-frame">
            <AsbScene />
          </div>
          <p className="asb-hint" aria-hidden="true">
            <span className="asb-hint-dot" />
            <span className="asb-hint-pointer">Click the button — or wait for it</span>
            <span className="asb-hint-touch">Tap the button — or wait for it</span>
          </p>
        </div>
        <AsbCreators creators={CREATORS} />
      </div>
      <AsbSectionFx />
    </section>
  );
}
