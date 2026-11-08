"use client";

import CreatorsEditor from "@/components/creators/CreatorsEditor";
import type { Creator } from "@/projects/story-mode/creators";
import StoryModeCreators from "./StoryModeCreators";

// Story Mode's creators editor (lab only): the shared editor, saving to projects/story-mode/creators.json.
export default function StoryModeCreatorsEditor({ initial }: { initial: Creator[] }) {
  return (
    <CreatorsEditor
      initial={initial}
      saveUrl="/lab/story-mode/creators"
      file="projects/story-mode/creators.json"
      accent="#ffb46e"
      preview={(creators) => (
        <div className="sm-section">
          <div className="sm-section-grid !py-12">
            <StoryModeCreators creators={creators} />
          </div>
        </div>
      )}
    />
  );
}
