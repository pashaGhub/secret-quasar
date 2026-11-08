"use client";

import CreatorsEditor from "@/components/creators/CreatorsEditor";
import type { Creator } from "@/projects/story-mode/creators";
import AsbCreators from "./AsbCreators";
import "./asb-section.css";

// Awkward Silence Button's creators editor (lab only): the shared editor, saving to
// projects/awkward-silence-button/creators.json.
export default function AsbCreatorsEditor({ initial }: { initial: Creator[] }) {
  return (
    <CreatorsEditor
      initial={initial}
      saveUrl="/lab/awkward-silence-button/creators"
      file="projects/awkward-silence-button/creators.json"
      accent="#ff3fae"
      preview={(creators) => (
        <div className="asb-section">
          <div className="asb-section-grid !py-12">
            <AsbCreators creators={creators} />
          </div>
        </div>
      )}
    />
  );
}
