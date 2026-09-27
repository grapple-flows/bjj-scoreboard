// bjj-scoreboard: an IBJJF BJJ scoreboard web component, plus its scoring logic.
//
// Importing this module registers <bjj-scoreboard> (when running in a
// browser). For the scoring functions alone, with no side effects, import
// "bjj-scoreboard/scoring".

import { defineBjjScoreboard } from "./element.js";

export * from "./scoring.js";
export {
  BjjScoreboardElement,
  CREDIT_TEXT,
  CREDIT_URL,
  TAG_NAME,
  defineBjjScoreboard,
  parseDuration,
  type ClockEventDetail,
  type EndEventDetail,
  type MatchResult,
  type ScoreEventDetail,
} from "./element.js";
export { createScoreboardSounds, type ScoreboardSounds } from "./audio.js";

defineBjjScoreboard();
