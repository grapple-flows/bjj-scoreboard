// Pure, dependency-free BJJ match-scoreboard logic.
//
// IBJJF scoring rules, belt time presets, the match state machine (scores,
// advantages, penalties, results) and its undo/redo history. No DOM and no
// I/O, so it runs anywhere: the <bjj-scoreboard> element uses it, and you can
// import it on its own from "bjj-scoreboard/scoring".
//
// Ported from the Grapple Flows app (src/utils/scoreboard.ts), which powers
// https://grappleflows.com/bjj-scoreboard. Function names are unchanged.

export type Side = "a" | "b";

export type Athlete = {
  name: string;
  points: number;
  advantages: number;
  penalties: number;
};

export type ResultType = "none" | "submission" | "time" | "decision";

export type Result = { type: ResultType; winner: Side | null };

/** One line of the match log. `at` is the match-clock time ("1:42") when the
 *  clock was running, so a shared result reads like a scoresheet. */
export type LogEntry = {
  side: Side;
  kind: "score" | "advantage" | "penalty" | "submission" | "decision";
  label: string;
  points?: number;
  at?: string;
};

export type Score = { a: Athlete; b: Athlete; result: Result; log?: LogEntry[] };

export type HistoryState = { past: Score[]; present: Score; future: Score[] };

export type Action =
  | { kind: "score"; side: Side; points: number; label?: string; at?: string }
  | { kind: "advantage"; side: Side; at?: string }
  | { kind: "penalty"; side: Side; at?: string }
  | { kind: "submission"; side: Side; at?: string }
  | { kind: "decision"; side: Side }
  | { kind: "endByTime" }
  | { kind: "swap" }
  | { kind: "resetScores" }
  | { kind: "setName"; side: Side; name: string }
  | { kind: "hydrate"; score: Score }
  | { kind: "undo" }
  | { kind: "redo" };

export type ScoringAction = { key: string; label: string; short: string; points: number };

export const SCORING_ACTIONS: ScoringAction[] = [
  { key: "takedown", label: "Takedown", short: "TD", points: 2 },
  { key: "sweep", label: "Sweep", short: "SW", points: 2 },
  { key: "knee", label: "Knee on Belly", short: "KoB", points: 2 },
  { key: "pass", label: "Guard Pass", short: "PASS", points: 3 },
  { key: "mount", label: "Mount", short: "MT", points: 4 },
  { key: "back", label: "Back Control", short: "BK", points: 4 },
];

export type BeltPreset = { key: string; label: string; seconds: number };

export const BELT_PRESETS: BeltPreset[] = [
  { key: "kids", label: "Kids", seconds: 240 },
  { key: "white", label: "White · Master", seconds: 300 },
  { key: "blue", label: "Blue", seconds: 360 },
  { key: "purple", label: "Purple", seconds: 420 },
  { key: "brown", label: "Brown", seconds: 480 },
  { key: "black", label: "Black", seconds: 600 },
];

/** Bump whenever the persisted shape changes so old payloads are ignored. */
export const STORAGE_VERSION = 1;

/** Seconds for a belt preset key, falling back to the white-belt default. */
export const beltSeconds = (key: string): number =>
  BELT_PRESETS.find((preset) => preset.key === key)?.seconds ?? 300;

export const blankAthlete = (name: string): Athlete => ({
  name,
  points: 0,
  advantages: 0,
  penalties: 0,
});

export const initialScore = (): Score => ({
  a: blankAthlete("Athlete 1"),
  b: blankAthlete("Athlete 2"),
  result: { type: "none", winner: null },
  log: [],
});

const appendLog = (score: Score, entry: LogEntry): LogEntry[] => {
  const clean: LogEntry = { ...entry };
  if (!clean.at) delete clean.at;
  return [...(score.log ?? []), clean];
};

export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

/** IBJJF tiebreak: points, then advantages, then fewest penalties. */
export const compareSides = (a: Athlete, b: Athlete): Side | "tie" => {
  if (a.points !== b.points) return a.points > b.points ? "a" : "b";
  if (a.advantages !== b.advantages) return a.advantages > b.advantages ? "a" : "b";
  if (a.penalties !== b.penalties) return a.penalties < b.penalties ? "a" : "b";
  return "tie";
};

const leadReason = (lead: Athlete, trail: Athlete): string => {
  if (lead.points !== trail.points) {
    const margin = lead.points - trail.points;
    return `leads by ${margin}`;
  }
  if (lead.advantages !== trail.advantages) return "ahead on advantages";
  return "ahead on penalties";
};

const winReason = (winner: Athlete, loser: Athlete): string => {
  if (winner.points !== loser.points) return "on points";
  if (winner.advantages !== loser.advantages) return "on advantages";
  return "on penalties";
};

export const isUntouched = (score: Score): boolean =>
  score.a.points === 0 &&
  score.b.points === 0 &&
  score.a.advantages === 0 &&
  score.b.advantages === 0 &&
  score.a.penalties === 0 &&
  score.b.penalties === 0 &&
  score.result.type === "none";

export type StatusInfo = { text: string; winner: Side | null; live: boolean; ended: boolean };

export const describeStatus = (score: Score): StatusInfo => {
  const { a, b, result } = score;

  if (result.type === "submission" && result.winner) {
    const w = result.winner === "a" ? a : b;
    return { text: `${w.name} wins by submission`, winner: result.winner, live: false, ended: true };
  }
  if (result.type === "decision" && result.winner) {
    const w = result.winner === "a" ? a : b;
    return { text: `${w.name} wins by referee decision`, winner: result.winner, live: false, ended: true };
  }
  if (result.type === "time") {
    if (!result.winner) {
      return { text: "Time. Referee decision needed", winner: null, live: false, ended: true };
    }
    const w = result.winner === "a" ? a : b;
    const l = result.winner === "a" ? b : a;
    return { text: `${w.name} wins ${winReason(w, l)}`, winner: result.winner, live: false, ended: true };
  }

  if (isUntouched(score)) {
    return { text: "Ready", winner: null, live: true, ended: false };
  }

  const lead = compareSides(a, b);
  if (lead === "tie") {
    return { text: "All even", winner: null, live: true, ended: false };
  }
  const w = lead === "a" ? a : b;
  const l = lead === "a" ? b : a;
  return { text: `${w.name} ${leadReason(w, l)}`, winner: lead, live: true, ended: false };
};

const withResultReset = (score: Score, side: Side, next: Athlete, entry: LogEntry): Score => ({
  ...score,
  [side]: next,
  result: { type: "none", winner: null },
  log: appendLog(score, entry),
});

const swapWinner = (winner: Side | null): Side | null =>
  winner === "a" ? "b" : winner === "b" ? "a" : null;

/** Apply a single action to a score, returning a new score (or the same
 *  reference when the action is a no-op). History bookkeeping lives in the
 *  reducer / each consumer; this is the bare state transition. */
export const mutate = (score: Score, action: Action): Score => {
  switch (action.kind) {
    case "score":
      return withResultReset(
        score,
        action.side,
        { ...score[action.side], points: score[action.side].points + action.points },
        {
          side: action.side,
          kind: "score",
          label: action.label ?? `${action.points} points`,
          points: action.points,
          at: action.at,
        },
      );
    case "advantage":
      return withResultReset(
        score,
        action.side,
        { ...score[action.side], advantages: score[action.side].advantages + 1 },
        { side: action.side, kind: "advantage", label: "Advantage", at: action.at },
      );
    case "penalty":
      return withResultReset(
        score,
        action.side,
        { ...score[action.side], penalties: score[action.side].penalties + 1 },
        { side: action.side, kind: "penalty", label: "Penalty", at: action.at },
      );
    case "submission":
      return {
        ...score,
        result: { type: "submission", winner: action.side },
        log: appendLog(score, { side: action.side, kind: "submission", label: "Submission", at: action.at }),
      };
    case "decision":
      return {
        ...score,
        result: { type: "decision", winner: action.side },
        log: appendLog(score, { side: action.side, kind: "decision", label: "Referee decision" }),
      };
    case "endByTime": {
      const lead = compareSides(score.a, score.b);
      return { ...score, result: { type: "time", winner: lead === "tie" ? null : lead } };
    }
    case "swap":
      return {
        a: score.b,
        b: score.a,
        result: { ...score.result, winner: swapWinner(score.result.winner) },
        log: (score.log ?? []).map((entry) => ({ ...entry, side: entry.side === "a" ? "b" : "a" })),
      };
    case "resetScores":
      return {
        a: blankAthlete(score.a.name),
        b: blankAthlete(score.b.name),
        result: { type: "none", winner: null },
        log: [],
      };
    case "setName":
      return { ...score, [action.side]: { ...score[action.side], name: action.name } };
    default:
      return score;
  }
};

/** History-aware reducer (undo/redo). Works as a React useReducer reducer or
 *  with any plain-JS state holder. */
export const reducer = (state: HistoryState, action: Action): HistoryState => {
  switch (action.kind) {
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case "hydrate":
      return { past: [], present: action.score, future: [] };
    case "setName":
      // Editing a name is metadata — never an undo step.
      return { ...state, present: mutate(state.present, action) };
    default: {
      const next = mutate(state.present, action);
      if (next === state.present) return state;
      return { past: [...state.past, state.present], present: next, future: [] };
    }
  }
};

export const haptic = (pattern: number | number[]): void => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
};

export type PersistedShape = {
  v: number;
  score: Score;
  clockEnabled: boolean;
  soundEnabled: boolean;
  beltKey: string;
};

/** Plain-text result for sharing: the outcome, the final numbers, and the
 *  match log in order. No link; the caller appends one. */
export const formatResultText = (score: Score): string => {
  const status = describeStatus(score);
  const line = (athlete: Athlete) =>
    `${athlete.name}: ${athlete.points} pts, ${athlete.advantages} adv, ${athlete.penalties} pen`;
  const lines = [status.text, line(score.a), line(score.b)];
  const log = score.log ?? [];
  if (log.length) {
    lines.push("", "Match log:");
    for (const entry of log) {
      const who = entry.side === "a" ? score.a.name : score.b.name;
      const pts = entry.points ? ` +${entry.points}` : "";
      lines.push(`${entry.at ? `${entry.at} ` : ""}${who}: ${entry.label}${pts}`);
    }
  }
  return lines.join("\n");
};

/** The 10-second warning: returns 10, 9 or 8 while that many whole seconds
 *  are left (one wood hit each), otherwise null. Skipped for phases of 11
 *  seconds or less. */
export function warningBeat(remaining: number, phaseTotal: number): number | null {
  if (phaseTotal <= 11 || remaining <= 0) return null;
  const beat = Math.ceil(remaining - 1e-9);
  return beat >= 8 && beat <= 10 ? beat : null;
}
