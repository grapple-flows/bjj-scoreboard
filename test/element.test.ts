// @vitest-environment happy-dom
// Smoke tests for the <bjj-scoreboard> element.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/index.js";
import { CREDIT_TEXT, CREDIT_URL, type BjjScoreboardElement, type EndEventDetail, type ScoreEventDetail } from "../src/index.js";

const mount = (attrs: Record<string, string> = {}): BjjScoreboardElement => {
  const el = document.createElement("bjj-scoreboard");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.body.append(el);
  return el;
};

const $ = <T extends Element = HTMLElement>(el: BjjScoreboardElement, selector: string): T => {
  const found = el.shadowRoot!.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const click = (el: BjjScoreboardElement, selector: string) => $<HTMLButtonElement>(el, selector).click();

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("<bjj-scoreboard>", () => {
  it("registers and renders both corners with labelled buttons", () => {
    const el = mount({ "name-a": "Ana", "name-b": "Bea" });
    expect(customElements.get("bjj-scoreboard")).toBeDefined();
    expect($(el, ".status").textContent).toBe("Ready");
    expect($<HTMLInputElement>(el, '[data-side="a"] .name').value).toBe("Ana");
    const takedown = $(el, '[data-act="score"][data-side="b"][data-key="takedown"]');
    expect(takedown.getAttribute("aria-label")).toBe("Takedown, 2 points for Bea");
    expect($(el, '[aria-live="polite"]')).toBeTruthy();
  });

  it("scores one-tap points, advantages and penalties, and fires events", () => {
    const el = mount({ "name-a": "Ana", "name-b": "Bea", "no-persist": "" });
    const events: ScoreEventDetail[] = [];
    el.addEventListener("bjj-scoreboard:score", (e) => events.push((e as CustomEvent<ScoreEventDetail>).detail));

    click(el, '[data-act="score"][data-side="a"][data-key="pass"]');
    click(el, '[data-act="score"][data-side="a"][data-key="mount"]');
    click(el, '[data-act="advantage"][data-side="b"]');
    click(el, '[data-act="penalty"][data-side="a"]');

    expect(el.score.a).toMatchObject({ points: 7, penalties: 1 });
    expect(el.score.b.advantages).toBe(1);
    expect($(el, '[data-side="a"] .points').textContent).toContain("7");
    expect($(el, ".status").textContent).toBe("Ana leads by 7");
    expect(events.map((e) => e.action)).toEqual(["score", "score", "advantage", "penalty"]);
    expect($(el, '[aria-live="polite"]').textContent).toContain("Ana 7, Bea 0");
  });

  it("undo and redo through the API and the buttons", () => {
    const el = mount({ "no-persist": "" });
    el.addPoints("a", "back");
    el.addPoints("a", 2, "Sweep");
    expect(el.score.a.points).toBe(6);
    click(el, '[data-act="undo"]');
    expect(el.score.a.points).toBe(4);
    el.redo();
    expect(el.score.a.points).toBe(6);
    expect(() => el.addPoints("a", "armbar")).toThrow(/Unknown scoring key/);
  });

  it("ends by time with IBJJF tiebreaks and asks for a decision when level", () => {
    const el = mount({ "name-a": "Ana", "name-b": "Bea", "no-persist": "" });
    const ends: EndEventDetail[] = [];
    el.addEventListener("bjj-scoreboard:end", (e) => ends.push((e as CustomEvent<EndEventDetail>).detail));

    el.addAdvantage("a");
    el.addAdvantage("b");
    el.endMatch();
    expect(el.getResult()).toMatchObject({ ended: true, type: "time", winner: null });
    expect($(el, ".decision").hidden).toBe(false);

    click(el, '[data-act="decision"][data-side="b"]');
    const result = el.getResult();
    expect(result).toMatchObject({ ended: true, type: "decision", winner: "b", winnerName: "Bea" });
    expect(result.summary.split("\n")[0]).toBe("Bea wins by referee decision");
    expect(ends.map((e) => e.type)).toEqual(["time", "decision"]);
    expect($(el, '[data-side="b"]').dataset.winner).toBe("true");
  });

  it("runs the clock from timestamps and ends the match at 0:00", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance", "Date"] });
    const el = mount({ duration: "0:30", "no-persist": "", "no-sound": "" });
    const ends: EndEventDetail[] = [];
    el.addEventListener("bjj-scoreboard:end", (e) => ends.push((e as CustomEvent<EndEventDetail>).detail));

    expect(el.duration).toBe(30);
    expect($(el, ".clock-time").textContent).toBe("00:30");
    el.start();
    vi.advanceTimersByTime(12_000);
    expect(el.remaining).toBeCloseTo(18, 0);
    expect($(el, ".clock-time").textContent).toBe("00:18");

    el.addPoints("b", "takedown");
    expect(el.score.log?.[0].at).toBe("0:12");

    el.pause();
    vi.advanceTimersByTime(5_000);
    expect(el.remaining).toBeCloseTo(18, 0);
    el.start();
    vi.advanceTimersByTime(20_000);
    expect(el.running).toBe(false);
    expect(el.remaining).toBe(0);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ type: "time", winner: "b" });
  });

  it("belt attribute sets the match length", () => {
    const el = mount({ belt: "black", "no-persist": "" });
    expect(el.duration).toBe(600);
    expect($(el, ".clock-time").textContent).toBe("10:00");
    el.setAttribute("belt", "blue");
    expect(el.duration).toBe(360);
  });

  it("puts a crawlable credit link in the light DOM, and no-credit removes it", () => {
    const el = mount({ "no-persist": "" });
    const link = el.querySelector<HTMLAnchorElement>('a[slot="credit"]');
    expect(link?.getAttribute("href")).toBe(CREDIT_URL);
    expect(link?.textContent).toBe(CREDIT_TEXT);
    expect(el.shadowRoot!.querySelector('slot[name="credit"]')).toBeTruthy();

    el.setAttribute("no-credit", "");
    expect(el.querySelector('a[slot="credit"]')).toBeNull();
    expect($(el, ".credit").hidden).toBe(true);
  });

  it("keeps a credit link written in the page markup", () => {
    document.body.innerHTML =
      '<bjj-scoreboard no-persist><a slot="credit" href="https://grappleflows.com/bjj-scoreboard">Mine</a></bjj-scoreboard>';
    const el = document.querySelector("bjj-scoreboard")!;
    const links = el.querySelectorAll('a[slot="credit"]');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Mine");
  });

  it("survives a reload through localStorage", () => {
    const first = mount({ id: "mat1" });
    first.setNames("Ana", "Bea");
    first.addPoints("a", "sweep");
    first.remove();

    const second = mount({ id: "mat1" });
    expect(second.score.a).toMatchObject({ name: "Ana", points: 2 });
    expect(second.score.b.name).toBe("Bea");
    expect(window.localStorage.getItem("bjj-scoreboard:mat1")).toContain('"v":1');
  });

  it("asks before clearing a scored match", () => {
    const el = mount({ "no-persist": "" });
    el.addPoints("a", "mount");
    click(el, '[data-act="reset"]');
    expect($(el, ".confirm").hidden).toBe(false);
    click(el, '[data-act="confirm-cancel"]');
    expect(el.score.a.points).toBe(4);
    click(el, '[data-act="reset"]');
    click(el, '[data-act="confirm-new"]');
    expect(el.score.a.points).toBe(0);
    expect(el.score.log).toEqual([]);
  });

  it("no-clock hides the clock and keeps score only", () => {
    const el = mount({ "no-clock": "", "no-persist": "" });
    expect($(el, ".clock").hidden).toBe(true);
    el.start();
    expect(el.running).toBe(false);
    el.addPoints("a", "takedown");
    expect(el.score.log?.[0].at).toBeUndefined();
  });

  it("names typed into the board are escaped as text", () => {
    const el = mount({ "no-persist": "" });
    el.setNames("<img src=x onerror=alert(1)>", "Bea");
    el.addPoints("a", "takedown");
    click(el, '[data-act="log"]');
    expect(el.shadowRoot!.querySelector("img")).toBeNull();
    expect($(el, ".log-who").textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
