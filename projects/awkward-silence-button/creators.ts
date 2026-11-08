// Creators & contributors under the Awkward Silence Button section ("The fellowship"). The list lives in
// creators.json — edit it by hand and commit it. Shape, link / avatar safety rules and initials are
// Story Mode's (projects/story-mode/creators.ts), so both sections validate the same way.
import { normalizeCreators } from "@/projects/story-mode/creators";
import data from "./creators.json";

export const CREATORS = normalizeCreators(data);
