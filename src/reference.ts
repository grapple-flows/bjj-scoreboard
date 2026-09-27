// IBJJF reference content shown in the README and used by the tests to check
// that the scoring buttons match the published points table.
//
// Taken from the Grapple Flows scoreboard page
// (https://grappleflows.com/bjj-scoreboard). Rules change: always check the
// current IBJJF rulebook for your event.

export type RuleSource = { label: string; href: string };

/** Where the numbers come from. */
export const RULE_SOURCES: readonly RuleSource[] = [
  { label: "IBJJF Rules Book v6.1 (June 2024)", href: "https://ibjjf.com/books-videos" },
];

export type PointsRow = { position: string; points: number; requirement: string };

/** IBJJF points. Gi and no-gi share the same values. */
export const IBJJF_POINTS: readonly PointsRow[] = [
  { position: "Takedown", points: 2, requirement: "Put your opponent down and establish on top for 3 seconds." },
  { position: "Sweep", points: 2, requirement: "Reverse from bottom guard to a dominant top position." },
  { position: "Knee on belly", points: 2, requirement: "Knee across the torso, posted upright, foot off the mat." },
  { position: "Guard pass", points: 3, requirement: "Clear the legs and stabilize control past the guard." },
  { position: "Mount", points: 4, requirement: "Sit on the chest with both knees on the mat." },
  { position: "Back control", points: 4, requirement: "Both hooks in (or a body triangle) behind the opponent." },
];

/** How a match without a submission is decided when time runs out, in order. */
export const TIEBREAK_ORDER: readonly string[] = [
  "Most points wins.",
  "If points are tied, most advantages wins.",
  "If advantages are tied, the fewest penalties wins.",
  "If everything is level, it goes to a referee decision.",
];

export type MatchTimeRow = { belt: string; adult: string; master1: string };

/** IBJJF regulation match length by belt, adult and Master 1. */
export const MATCH_TIMES: readonly MatchTimeRow[] = [
  { belt: "White", adult: "5:00", master1: "5:00" },
  { belt: "Blue", adult: "6:00", master1: "6:00" },
  { belt: "Purple", adult: "7:00", master1: "6:00" },
  { belt: "Brown", adult: "8:00", master1: "6:00" },
  { belt: "Black", adult: "10:00", master1: "6:00" },
];
