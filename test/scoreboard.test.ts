// Ported from the Grapple Flows app (src/utils/scoreboard.test.ts).
import { describe, expect, it } from "vitest";
import {
  SCORING_ACTIONS,
  formatResultText,
  initialScore,
  mutate,
  reducer,
  type HistoryState,
} from "../src/scoreboard.js";
import { IBJJF_POINTS } from "../src/reference.js";

const start = (): HistoryState => ({ past: [], present: initialScore(), future: [] });

describe("match log", () => {
  it("records each score with its label and clock time", () => {
    let state = start();
    state = reducer(state, { kind: "setName", side: "a", name: "Ana" });
    state = reducer(state, { kind: "setName", side: "b", name: "Bea" });
    state = reducer(state, { kind: "score", side: "a", points: 2, label: "Takedown", at: "0:41" });
    state = reducer(state, { kind: "advantage", side: "b" });
    state = reducer(state, { kind: "score", side: "a", points: 3, label: "Guard Pass", at: "2:05" });
    expect(state.present.log).toEqual([
      { side: "a", kind: "score", label: "Takedown", points: 2, at: "0:41" },
      { side: "b", kind: "advantage", label: "Advantage" },
      { side: "a", kind: "score", label: "Guard Pass", points: 3, at: "2:05" },
    ]);

    // Undo takes the last entry back off the log with the points.
    state = reducer(state, { kind: "undo" });
    expect(state.present.log).toHaveLength(2);
    expect(state.present.a.points).toBe(2);
  });

  it("flips sides on swap and clears on reset", () => {
    let score = mutate(initialScore(), { kind: "score", side: "a", points: 4, label: "Mount" });
    score = mutate(score, { kind: "swap" });
    expect(score.log?.[0].side).toBe("b");
    expect(score.b.points).toBe(4);
    score = mutate(score, { kind: "resetScores" });
    expect(score.log).toEqual([]);
  });

  it("reads old saved scores without a log", () => {
    const legacy = { ...initialScore() };
    delete legacy.log;
    const next = mutate(legacy, { kind: "penalty", side: "b" });
    expect(next.log).toEqual([{ side: "b", kind: "penalty", label: "Penalty" }]);
  });
});

describe("formatResultText", () => {
  it("summarizes the outcome and the log", () => {
    let score = initialScore();
    score = mutate(score, { kind: "setName", side: "a", name: "Ana" });
    score = mutate(score, { kind: "setName", side: "b", name: "Bea" });
    score = mutate(score, { kind: "score", side: "a", points: 2, label: "Sweep", at: "1:10" });
    score = mutate(score, { kind: "endByTime" });
    expect(formatResultText(score)).toBe(
      [
        "Ana wins on points",
        "Ana: 2 pts, 0 adv, 0 pen",
        "Bea: 0 pts, 0 adv, 0 pen",
        "",
        "Match log:",
        "1:10 Ana: Sweep +2",
      ].join("\n"),
    );
  });
});

describe("points table", () => {
  it("matches the scoring buttons", () => {
    const table = IBJJF_POINTS.map((row) => [row.position.toLowerCase(), row.points]);
    expect(table).toEqual(SCORING_ACTIONS.map((a) => [a.label.toLowerCase(), a.points]));
  });
});
