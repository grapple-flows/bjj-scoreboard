// The README's reference tables and code example must match the code.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IBJJF_POINTS, MATCH_TIMES, TIEBREAK_ORDER } from "../src/reference.js";
import { describeStatus, formatResultText, initialScore, reducer, type HistoryState } from "../src/scoreboard.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("README", () => {
  it("lists the IBJJF points table from the data", () => {
    for (const row of IBJJF_POINTS) {
      expect(readme).toContain(`| ${row.position} | ${row.points} | ${row.requirement} |`);
    }
  });

  it("lists the match times from the data", () => {
    for (const row of MATCH_TIMES) {
      expect(readme).toContain(`| ${row.belt} | ${row.adult} | ${row.master1} |`);
    }
  });

  it("lists the tiebreak order from the data", () => {
    TIEBREAK_ORDER.forEach((step, index) => expect(readme).toContain(`${index + 1}. ${step}`));
  });

  it("shows the real output of the scoring example", () => {
    let state: HistoryState = { past: [], present: initialScore(), future: [] };
    state = reducer(state, { kind: "setName", side: "a", name: "Ana" });
    state = reducer(state, { kind: "setName", side: "b", name: "Bea" });
    state = reducer(state, { kind: "score", side: "a", points: 2, label: "Sweep", at: "1:10" });
    state = reducer(state, { kind: "advantage", side: "b" });
    state = reducer(state, { kind: "endByTime" });
    expect(readme).toContain(`describeStatus(state.present).text; // "${describeStatus(state.present).text}"`);
    const commented = formatResultText(state.present)
      .split("\n")
      .map((line) => (line ? `// ${line}` : "//"))
      .join("\n");
    expect(readme).toContain(commented);
  });

  it("carries the required Grapple Flows lines", () => {
    expect(readme.split("\n")[2]).toBe(
      "A free IBJJF BJJ scoreboard web component with points, advantages, penalties, automatic tiebreaks, and a match clock.",
    );
    expect(readme).toContain(
      "Grapple Flows is a free BJJ flowchart app that turns voice notes and videos into visual maps of jiu-jitsu techniques, positions, and transitions you can study, edit, and share.",
    );
  });
});
