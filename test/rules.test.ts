// Tiebreaks, results, belt times and the clock helpers.

import { describe, expect, it } from "vitest";
import {
  BELT_PRESETS,
  SCORING_ACTIONS,
  beltSeconds,
  compareSides,
  describeStatus,
  formatClock,
  initialScore,
  isUntouched,
  mutate,
  reducer,
  warningBeat,
  type Action,
  type Score,
} from "../src/scoreboard.js";
import { MATCH_TIMES } from "../src/reference.js";
import { parseDuration } from "../src/element.js";

const play = (actions: Action[], score: Score = initialScore()): Score =>
  actions.reduce((current, action) => mutate(current, action), score);

describe("IBJJF points", () => {
  it("scores takedown, sweep, knee on belly 2, guard pass 3, mount and back 4", () => {
    expect(Object.fromEntries(SCORING_ACTIONS.map((a) => [a.key, a.points]))).toEqual({
      takedown: 2,
      sweep: 2,
      knee: 2,
      pass: 3,
      mount: 4,
      back: 4,
    });
  });
});

describe("tiebreaks", () => {
  it("points first", () => {
    const score = play([
      { kind: "score", side: "a", points: 2 },
      { kind: "advantage", side: "b" },
      { kind: "advantage", side: "b" },
      { kind: "endByTime" },
    ]);
    expect(score.result).toEqual({ type: "time", winner: "a" });
    expect(describeStatus(score).text).toBe("Athlete 1 wins on points");
  });

  it("then advantages", () => {
    const score = play([
      { kind: "score", side: "a", points: 2 },
      { kind: "score", side: "b", points: 2 },
      { kind: "advantage", side: "b" },
      { kind: "endByTime" },
    ]);
    expect(score.result.winner).toBe("b");
    expect(describeStatus(score).text).toBe("Athlete 2 wins on advantages");
  });

  it("then the fewest penalties", () => {
    const score = play([{ kind: "penalty", side: "a" }, { kind: "endByTime" }]);
    expect(score.result.winner).toBe("b");
    expect(describeStatus(score).text).toBe("Athlete 2 wins on penalties");
  });

  it("then a referee decision", () => {
    let score = play([{ kind: "advantage", side: "a" }, { kind: "advantage", side: "b" }, { kind: "endByTime" }]);
    expect(score.result).toEqual({ type: "time", winner: null });
    expect(describeStatus(score)).toMatchObject({ text: "Time. Referee decision needed", ended: true, winner: null });
    score = mutate(score, { kind: "decision", side: "a" });
    expect(describeStatus(score).text).toBe("Athlete 1 wins by referee decision");
  });

  it("compareSides reports a dead-even match as a tie", () => {
    const { a, b } = initialScore();
    expect(compareSides(a, b)).toBe("tie");
  });
});

describe("live status", () => {
  it("reads Ready, the lead, and All even", () => {
    let score = initialScore();
    expect(describeStatus(score).text).toBe("Ready");
    score = mutate(score, { kind: "score", side: "b", points: 3 });
    expect(describeStatus(score)).toMatchObject({ text: "Athlete 2 leads by 3", winner: "b", live: true });
    score = mutate(score, { kind: "score", side: "a", points: 3 });
    expect(describeStatus(score).text).toBe("All even");
  });

  it("a submission ends the match; scoring again reopens it", () => {
    let score = mutate(initialScore(), { kind: "submission", side: "a" });
    expect(describeStatus(score)).toMatchObject({ text: "Athlete 1 wins by submission", ended: true });
    score = mutate(score, { kind: "score", side: "b", points: 2 });
    expect(score.result.type).toBe("none");
  });
});

describe("history", () => {
  it("undo and redo walk the history; names are not undo steps", () => {
    let state = { past: [], present: initialScore(), future: [] } as ReturnType<typeof reducer>;
    state = reducer(state, { kind: "score", side: "a", points: 4, label: "Mount" });
    state = reducer(state, { kind: "setName", side: "a", name: "Ana" });
    expect(state.past).toHaveLength(1);
    state = reducer(state, { kind: "undo" });
    expect(state.present.a.points).toBe(0);
    expect(state.present.a.name).toBe("Athlete 1");
    state = reducer(state, { kind: "redo" });
    expect(state.present.a.points).toBe(4);
    expect(reducer(state, { kind: "redo" })).toBe(state);
  });

  it("isUntouched is true only for a fresh board", () => {
    expect(isUntouched(initialScore())).toBe(true);
    expect(isUntouched(mutate(initialScore(), { kind: "penalty", side: "a" }))).toBe(false);
  });
});

describe("match clock helpers", () => {
  it("belt presets match the IBJJF adult table", () => {
    for (const row of MATCH_TIMES) {
      const preset = BELT_PRESETS.find((p) => p.key === row.belt.toLowerCase());
      expect(preset, row.belt).toBeDefined();
      expect(formatClock(preset!.seconds).replace(/^0/, "")).toBe(row.adult);
    }
    expect(beltSeconds("black")).toBe(600);
    expect(beltSeconds("nope")).toBe(300);
  });

  it("formatClock rounds up to whole seconds", () => {
    expect(formatClock(300)).toBe("05:00");
    expect(formatClock(59.2)).toBe("01:00");
    expect(formatClock(0.1)).toBe("00:01");
    expect(formatClock(-3)).toBe("00:00");
  });

  it("warningBeat fires on 10, 9 and 8 seconds left", () => {
    expect(warningBeat(10, 300)).toBe(10);
    expect(warningBeat(8.5, 300)).toBe(9);
    expect(warningBeat(7.9, 300)).toBe(8);
    expect(warningBeat(7, 300)).toBeNull();
    expect(warningBeat(10.5, 300)).toBeNull();
    expect(warningBeat(9, 10)).toBeNull();
  });

  it("parseDuration reads m:ss and seconds", () => {
    expect(parseDuration("4:30")).toBe(270);
    expect(parseDuration("04:30")).toBe(270);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("soon")).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });
});
