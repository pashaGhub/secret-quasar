import { creatorsSaveHandler } from "@/lib/creators/saveRoute";

// Development-only: the Awkward Silence Button lab saves the creators list into the repo through this route
// (404 in production builds). Commit the JSON to publish a change.
export const POST = creatorsSaveHandler("projects/awkward-silence-button/creators.json");
