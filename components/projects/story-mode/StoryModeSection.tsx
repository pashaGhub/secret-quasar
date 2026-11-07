import StoryModeCopy from "./StoryModeCopy";
import StoryModeViewer from "./StoryModeViewer";
import StoryModeCreators from "./StoryModeCreators";
import { CREATORS } from "@/projects/story-mode/creators";
import "./story-mode-section.css";

/**
 * Story Mode (RuneLite TTS plugin) — server-rendered section shell: scene on the left (above on
 * mobile), copy on the right, creators & contributors across the bottom. The WebGL scene is a
 * client island that loads its engine lazily.
 */
export default function StoryModeSection() {
  return (
    <section id="story-mode" aria-labelledby="story-mode-title" className="sm-section">
      <div className="sm-section-bg" aria-hidden="true" />
      <div className="sm-section-grid">
        <StoryModeViewer />
        <StoryModeCopy />
        <StoryModeCreators creators={CREATORS} />
      </div>
    </section>
  );
}
