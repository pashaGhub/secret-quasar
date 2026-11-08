import { creatorsSaveHandler } from "@/lib/creators/saveRoute";

// Development-only: the Story Mode lab saves the creators list into the repo through this route
// (404 in production builds). Commit the JSON to publish a change.
export const POST = creatorsSaveHandler("projects/story-mode/creators.json");
