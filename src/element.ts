// <bjj-scoreboard>: a framework-free IBJJF match scoreboard.
//
// Behavior mirrors the Grapple Flows scoreboard at
// https://grappleflows.com/bjj-scoreboard: one-tap points, advantages,
// penalties, automatic tiebreaks, a belt-timed match clock, undo and redo, a
// match log, fullscreen for a TV, and a shareable result. All scoring rules
// live in ./scoreboard.ts; this file is only the view, the clock and the
// browser wiring (audio, storage, fullscreen, keyboard).

import { createScoreboardSounds, type ScoreboardSounds } from "./audio.js";
import {
  BELT_PRESETS,
  SCORING_ACTIONS,
  STORAGE_VERSION,
  beltSeconds,
  describeStatus,
  formatClock,
  formatResultText,
  haptic,
  initialScore,
  isUntouched,
  reducer,
  warningBeat,
  type Action,
  type Athlete,
  type HistoryState,
  type LogEntry,
  type PersistedShape,
  type ResultType,
  type Score,
  type Side,
  type StatusInfo,
} from "./scoreboard.js";
import { STYLES } from "./styles.js";

export const TAG_NAME = "bjj-scoreboard";

/** Where the default credit link points. */
export const CREDIT_URL =
  "https://grappleflows.com/bjj-scoreboard?utm_source=github&utm_medium=referral&utm_campaign=bjj-scoreboard&ref=github";
export const CREDIT_TEXT = "Free BJJ scoreboard by Grapple Flows";

/** What getResult() returns and the `bjj-scoreboard:end` event carries. */
export type MatchResult = {
  /** True once the match has a result (submission, time, or decision). */
  ended: boolean;
  type: ResultType;
  winner: Side | null;
  winnerName: string | null;
  /** The status line, e.g. "Ana wins on advantages". */
  text: string;
  a: Athlete;
  b: Athlete;
  log: LogEntry[];
  /** Plain-text scoresheet: outcome, final numbers, and the match log. */
  summary: string;
};

export type ScoreEventDetail = {
  action: Action["kind"];
  score: Score;
  status: StatusInfo;
};

export type EndEventDetail = MatchResult;

export type ClockEventDetail = {
  running: boolean;
  /** Seconds left on the match clock. */
  remaining: number;
  /** Full match length in seconds. */
  duration: number;
};

const OBSERVED = [
  "belt",
  "duration",
  "name-a",
  "name-b",
  "color-a",
  "color-b",
  "heading",
  "no-clock",
  "no-sound",
  "no-credit",
  "no-persist",
  "storage-key",
  "share-url",
] as const;

const TICK_MS = 100;

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

/** "4:30", "04:30" or "270" to seconds. Anything else is null. */
export const parseDuration = (value: string | null): number | null => {
  if (value == null) return null;
  const text = value.trim();
  if (!text) return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  const seconds = clock ? Number(clock[1]) * 60 + Number(clock[2]) : Number(text);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
};

/** Vibrate on phones, but only after the visitor has interacted with the
 *  page (browsers block and log it otherwise, e.g. for API calls on load). */
const buzz = (pattern: number | number[]): void => {
  const activation = (typeof navigator !== "undefined" ? navigator : undefined) as
    | (Navigator & { userActivation?: { hasBeenActive: boolean } })
    | undefined;
  if (activation?.userActivation && !activation.userActivation.hasBeenActive) return;
  haptic(pattern);
};

const sideLabel = (side: Side) => (side === "a" ? "corner 1" : "corner 2");

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(
    el &&
      (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable),
  );
};

const isInteractive = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (isTypingTarget(el) || el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SUMMARY"));
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

// Importing on a server (SSR) must not throw, so extend a stand-in there.
const Base: typeof HTMLElement =
  typeof HTMLElement !== "undefined" ? HTMLElement : (class {} as unknown as typeof HTMLElement);

type Attrs = Record<string, string | boolean | undefined>;

/** Tiny DOM builder. Text always goes through textContent, never innerHTML. */
const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "text") el.textContent = String(value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) el.append(child);
  return el;
};

const ICONS = {
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  swap: "M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16",
  expand: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  shrink: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
} as const;

const icon = (name: keyof typeof ICONS): SVGSVGElement => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
};

type PanelRefs = {
  root: HTMLElement;
  name: HTMLInputElement;
  badge: HTMLElement;
  points: HTMLElement;
  pointsValue: HTMLElement;
  adv: HTMLElement;
  pen: HTMLElement;
  scoreButtons: HTMLButtonElement[];
  advBtn: HTMLButtonElement;
  penBtn: HTMLButtonElement;
  subBtn: HTMLButtonElement;
};

type Refs = {
  base: HTMLElement;
  heading: HTMLElement;
  status: HTMLElement;
  announce: HTMLElement;
  clock: HTMLElement;
  clockTime: HTMLElement;
  toggleClock: HTMLButtonElement;
  belt: HTMLSelectElement;
  panels: Record<Side, PanelRefs>;
  result: HTMLElement;
  toast: HTMLElement;
  confirm: HTMLElement;
  confirmCancel: HTMLButtonElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  endMatch: HTMLButtonElement;
  decision: HTMLElement;
  decisionA: HTMLButtonElement;
  decisionB: HTMLButtonElement;
  newMatch: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
  settingsBtn: HTMLButtonElement;
  settings: HTMLElement;
  clockSwitch: HTMLInputElement;
  soundSwitch: HTMLInputElement;
  log: HTMLElement;
  logToggle: HTMLButtonElement;
  logList: HTMLOListElement;
  credit: HTMLElement;
};

export class BjjScoreboardElement extends Base {
  static get observedAttributes(): string[] {
    return [...OBSERVED];
  }

  private history: HistoryState = { past: [], present: initialScore(), future: [] };
  private clockEnabled = true;
  private soundEnabled = true;
  private beltKey = "white";
  private customSeconds: number | null = null;
  private remainingSeconds = beltSeconds("white");
  private isRunning = false;
  private startedAt = 0;
  private remainingAtStart = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private warned: number | null = null;
  private settingsOpen = false;
  private logOpen = false;
  private confirmOpen = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private refs: Refs | null = null;
  private sounds: ScoreboardSounds | null = null;
  private lastAnnouncement = "";
  private lastPoints: Record<Side, number> = { a: 0, b: 0 };
  private initialized = false;

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  connectedCallback(): void {
    if (!this.initialized) {
      this.initialized = true;
      this.build();
      this.restore();
      this.applyAttributes();
      this.lastPoints = { a: this.score.a.points, b: this.score.b.points };
    }
    this.ensureCredit();
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.onFullscreenChange);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("keydown", this.onWindowKey);
    if (this.isRunning && !this.ticker) this.ticker = setInterval(this.tick, TICK_MS);
    this.render();
  }

  disconnectedCallback(): void {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this.onFullscreenChange);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("keydown", this.onWindowKey);
    // Keep the running state: the clock is timestamp-based, so moving the
    // element in the DOM does not lose time. The ticker restarts on connect.
    this.stopTicker();
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (!this.initialized || oldValue === value) return;
    switch (name) {
      case "belt":
      case "duration":
        this.applyTiming();
        break;
      case "name-a":
      case "name-b":
        if (value != null) this.dispatch({ kind: "setName", side: name === "name-a" ? "a" : "b", name: value });
        break;
      case "no-clock":
        this.setClockEnabled(value == null);
        break;
      case "no-sound":
        this.soundEnabled = value == null;
        break;
      case "no-credit":
        this.ensureCredit();
        break;
      default:
        break;
    }
    this.applyPresentation();
    this.render();
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  /** Current score (a snapshot; mutating it does nothing). */
  get score(): Score {
    return this.history.present;
  }

  /** Seconds left on the match clock. */
  get remaining(): number {
    this.syncClock();
    return this.remainingSeconds;
  }

  /** Whether the match clock is running. */
  get running(): boolean {
    return this.isRunning;
  }

  /** Full match length in seconds (from `duration`, else `belt`). */
  get duration(): number {
    return this.customSeconds ?? beltSeconds(this.beltKey);
  }

  get canUndo(): boolean {
    return this.history.past.length > 0;
  }

  get canRedo(): boolean {
    return this.history.future.length > 0;
  }

  /** Start (or resume) the match clock. Restarts from full time if it hit 0:00. */
  start(): void {
    if (!this.clockEnabled || this.isRunning) return;
    void this.sounds?.unlock();
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = this.duration;
      this.warned = null;
    }
    this.startedAt = now();
    this.remainingAtStart = this.remainingSeconds;
    this.isRunning = true;
    this.startTicker();
    this.emitClock();
    this.render();
  }

  /** Pause the match clock. */
  pause(): void {
    if (!this.isRunning) return;
    this.syncClock();
    this.isRunning = false;
    this.stopTicker();
    this.emitClock();
    this.render();
  }

  /** Start if paused, pause if running. */
  toggleClock(): void {
    if (this.isRunning) this.pause();
    else this.start();
  }

  /** Stop the clock and put it back to full time. Scores are untouched. */
  resetClock(): void {
    const wasRunning = this.isRunning;
    this.isRunning = false;
    this.stopTicker();
    this.remainingSeconds = this.duration;
    this.warned = null;
    if (wasRunning) this.emitClock();
    this.render();
  }

  /** New match: clears both scores and the log, and resets the clock. Names stay. */
  reset(): void {
    this.confirmOpen = false;
    this.dispatch({ kind: "resetScores" });
    this.resetClock();
  }

  /** Add points to a side. `pointsOrKey` is a number, or a scoring key:
   *  "takedown", "sweep", "knee", "pass", "mount", "back". */
  addPoints(side: Side, pointsOrKey: number | string, label?: string): void {
    if (typeof pointsOrKey === "string") {
      const scoring = SCORING_ACTIONS.find((item) => item.key === pointsOrKey);
      if (!scoring) throw new Error(`Unknown scoring key "${pointsOrKey}"`);
      this.dispatch({ kind: "score", side, points: scoring.points, label: label ?? scoring.label, at: this.clockAt() });
      return;
    }
    if (!Number.isFinite(pointsOrKey) || pointsOrKey <= 0) return;
    this.dispatch({ kind: "score", side, points: pointsOrKey, label, at: this.clockAt() });
  }

  addAdvantage(side: Side): void {
    this.dispatch({ kind: "advantage", side, at: this.clockAt() });
  }

  addPenalty(side: Side): void {
    this.dispatch({ kind: "penalty", side, at: this.clockAt() });
  }

  /** End the match with a submission win for `side`. */
  submission(side: Side): void {
    this.finish({ kind: "submission", side, at: this.clockAt() });
  }

  /** Award a referee decision to `side` (used when a match ends dead even). */
  decision(side: Side): void {
    this.dispatch({ kind: "decision", side });
  }

  /** End the match now and apply the IBJJF tiebreaks. */
  endMatch(): void {
    this.finish({ kind: "endByTime" });
  }

  undo(): void {
    this.dispatch({ kind: "undo" });
  }

  redo(): void {
    this.dispatch({ kind: "redo" });
  }

  /** Swap corners: names, scores, and the log all move sides. */
  swap(): void {
    this.dispatch({ kind: "swap" });
  }

  setNames(nameA?: string, nameB?: string): void {
    if (nameA != null) this.dispatch({ kind: "setName", side: "a", name: nameA });
    if (nameB != null) this.dispatch({ kind: "setName", side: "b", name: nameB });
  }

  /** Replace the whole score (e.g. restoring from your own storage). Clears undo history. */
  setScore(score: Score): void {
    this.dispatch({ kind: "hydrate", score });
  }

  getResult(): MatchResult {
    const score = this.history.present;
    const status = describeStatus(score);
    const winner = status.ended ? status.winner : null;
    return {
      ended: status.ended,
      type: score.result.type,
      winner,
      winnerName: winner ? score[winner].name : null,
      text: status.text,
      a: { ...score.a },
      b: { ...score.b },
      log: (score.log ?? []).map((entry) => ({ ...entry })),
      summary: formatResultText(score),
    };
  }

  /** Enter or leave fullscreen (for a TV or projector). */
  async toggleFullscreen(): Promise<void> {
    const doc = document as FullscreenDocument;
    const el = this as unknown as FullscreenElement;
    try {
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        await el.webkitRequestFullscreen?.();
      }
    } catch {
      /* the browser refused (e.g. not a user gesture) */
    }
  }

  /** Low-level: apply any scoreboard Action (see the scoring API). */
  dispatch(action: Action): void {
    const before = this.history;
    const next = reducer(before, action);
    if (next === before) return;
    this.history = next;
    this.persist();
    this.render();
    if (action.kind === "setName" || action.kind === "hydrate") return;

    const score = next.present;
    const status = describeStatus(score);
    this.announce(action, score, status);
    this.emit<ScoreEventDetail>("score", { action: action.kind, score, status });

    const prev = before.present.result;
    const changed = prev.type !== score.result.type || prev.winner !== score.result.winner;
    if (status.ended && changed && action.kind !== "undo" && action.kind !== "swap") {
      this.emit<EndEventDetail>("end", this.getResult());
    }
  }

  // ---------------------------------------------------------------------
  // Attributes, storage, credit
  // ---------------------------------------------------------------------

  private get storageKey(): string {
    return this.getAttribute("storage-key") || (this.id ? `bjj-scoreboard:${this.id}` : "bjj-scoreboard");
  }

  private get persistEnabled(): boolean {
    return !this.hasAttribute("no-persist");
  }

  private restore(): void {
    if (!this.persistEnabled) return;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedShape;
      if (!saved || saved.v !== STORAGE_VERSION) return;
      if (saved.score?.a && saved.score?.b && saved.score?.result) {
        this.history = reducer(this.history, { kind: "hydrate", score: saved.score });
      }
      if (typeof saved.clockEnabled === "boolean") this.clockEnabled = saved.clockEnabled;
      if (typeof saved.soundEnabled === "boolean") this.soundEnabled = saved.soundEnabled;
      if (typeof saved.beltKey === "string" && BELT_PRESETS.some((preset) => preset.key === saved.beltKey)) {
        this.beltKey = saved.beltKey;
      }
    } catch {
      /* storage blocked or malformed */
    }
  }

  private persist(): void {
    if (!this.persistEnabled || !this.initialized) return;
    const payload: PersistedShape = {
      v: STORAGE_VERSION,
      score: this.history.present,
      clockEnabled: this.clockEnabled,
      soundEnabled: this.soundEnabled,
      beltKey: this.beltKey,
    };
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      /* storage full or blocked */
    }
  }

  /** Attributes are the page author's intent, so they win over saved state. */
  private applyAttributes(): void {
    const nameA = this.getAttribute("name-a");
    const nameB = this.getAttribute("name-b");
    if (nameA != null) this.history = reducer(this.history, { kind: "setName", side: "a", name: nameA });
    if (nameB != null) this.history = reducer(this.history, { kind: "setName", side: "b", name: nameB });
    if (this.hasAttribute("no-clock")) this.clockEnabled = false;
    if (this.hasAttribute("no-sound")) this.soundEnabled = false;
    this.applyTiming();
    this.applyPresentation();
    if (typeof window !== "undefined") this.sounds = createScoreboardSounds();
  }

  private applyTiming(): void {
    const belt = this.getAttribute("belt");
    if (belt && BELT_PRESETS.some((preset) => preset.key === belt)) this.beltKey = belt;
    this.customSeconds = parseDuration(this.getAttribute("duration"));
    this.isRunning = false;
    this.stopTicker();
    this.remainingSeconds = this.duration;
    this.warned = null;
  }

  private applyPresentation(): void {
    const refs = this.refs;
    if (!refs) return;
    const heading = this.getAttribute("heading");
    refs.heading.textContent = heading ?? "";
    refs.heading.hidden = !heading;
    for (const side of ["a", "b"] as const) {
      const color = this.getAttribute(`color-${side}`);
      if (color) refs.base.style.setProperty(`--bjj-sb-color-${side}`, color);
      else refs.base.style.removeProperty(`--bjj-sb-color-${side}`);
    }
  }

  /** The credit is a light DOM <a slot="credit"> so it is part of the page's
   *  own HTML for crawlers. Put your own in the markup and it is used as is. */
  private ensureCredit = (): void => {
    // While the page is still parsing, the author's own credit link may not
    // have arrived yet. Decide once the document is parsed.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.ensureCredit, { once: true });
      return;
    }
    const hidden = this.hasAttribute("no-credit");
    const slotted = Array.from(this.children).filter((child) => child.getAttribute("slot") === "credit");
    const auto = slotted.filter((child) => child.hasAttribute("data-bjj-sb-credit"));
    const authored = slotted.length - auto.length;
    // An author-written link always wins over the generated one.
    if (hidden || authored > 0) auto.forEach((child) => child.remove());
    if (!hidden && slotted.length === 0) {
      const link = h("a", {
        slot: "credit",
        href: CREDIT_URL,
        "data-bjj-sb-credit": true,
        text: CREDIT_TEXT,
      });
      this.append(link);
    }
    if (this.refs) this.refs.credit.hidden = hidden;
  };

  private setClockEnabled(enabled: boolean): void {
    this.clockEnabled = enabled;
    if (!enabled) this.resetClock();
  }

  // ---------------------------------------------------------------------
  // Clock
  // ---------------------------------------------------------------------

  private syncClock(): void {
    if (!this.isRunning) return;
    const elapsed = (now() - this.startedAt) / 1000;
    this.remainingSeconds = Math.max(0, this.remainingAtStart - elapsed);
  }

  private startTicker(): void {
    this.stopTicker();
    if (this.isConnected) this.ticker = setInterval(this.tick, TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    this.syncClock();
    const beat = warningBeat(this.remainingSeconds, this.duration);
    if (beat !== null && this.warned !== beat) {
      this.warned = beat;
      if (this.soundEnabled) this.sounds?.clack();
    }
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.isRunning = false;
      this.stopTicker();
      if (this.soundEnabled) this.sounds?.bell();
      buzz([40, 60, 40]);
      this.emitClock();
      this.dispatch({ kind: "endByTime" });
    }
    this.renderClock();
  };

  private onVisibility = (): void => {
    if (document.visibilityState === "visible") this.tick();
  };

  /** Match-clock time for the log ("1:42"), only once the clock has moved. */
  private clockAt(): string | undefined {
    this.syncClock();
    if (!this.clockEnabled || this.remainingSeconds >= this.duration) return undefined;
    return formatClock(this.duration - this.remainingSeconds).replace(/^0(?=\d:)/, "");
  }

  private finish(action: Action): void {
    buzz([20, 40]);
    if (this.soundEnabled) this.sounds?.bell();
    this.pause();
    this.dispatch(action);
  }

  // ---------------------------------------------------------------------
  // Events and announcements
  // ---------------------------------------------------------------------

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(`bjj-scoreboard:${name}`, { detail, bubbles: true, composed: true }));
  }

  private emitClock(): void {
    this.emit<ClockEventDetail>("clock", {
      running: this.isRunning,
      remaining: this.remainingSeconds,
      duration: this.duration,
    });
  }

  private announce(action: Action, score: Score, status: StatusInfo): void {
    if (!this.refs) return;
    const nameOf = (side: Side) => score[side].name;
    let what = "";
    switch (action.kind) {
      case "score":
        what = `${nameOf(action.side)}: ${action.label ?? "Points"} plus ${action.points}.`;
        break;
      case "advantage":
        what = `${nameOf(action.side)}: advantage.`;
        break;
      case "penalty":
        what = `${nameOf(action.side)}: penalty.`;
        break;
      case "undo":
        what = "Undone.";
        break;
      case "redo":
        what = "Redone.";
        break;
      case "swap":
        what = "Corners swapped.";
        break;
      case "resetScores":
        what = "New match.";
        break;
      default:
        break;
    }
    const tally = `${score.a.name} ${score.a.points}, ${score.b.name} ${score.b.points}.`;
    let text = [what, `${status.text}.`, tally].filter(Boolean).join(" ");
    // Screen readers skip a live region whose text did not change.
    if (text === this.lastAnnouncement) text += " ";
    this.lastAnnouncement = text;
    this.refs.announce.textContent = text;
  }

  private showToast(message: string): void {
    if (!this.refs) return;
    this.refs.toast.textContent = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this.refs) this.refs.toast.textContent = "";
    }, 3200);
  }

  private async shareResult(): Promise<void> {
    const status = describeStatus(this.score);
    const url = this.getAttribute("share-url");
    const text = formatResultText(this.score) + (url ? `\n${url}` : "");
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: status.text, text });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = this.copyFallback(text);
    }
    this.showToast(copied ? "Result copied. Paste it into a group chat or send it to your coach." : "Could not copy on this browser.");
  }

  private copyFallback(text: string): boolean {
    const area = h("textarea", { readonly: true, "aria-hidden": "true" });
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    this.refs?.base.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  // ---------------------------------------------------------------------
  // Keyboard and fullscreen
  // ---------------------------------------------------------------------

  private get isFullscreen(): boolean {
    const doc = document as FullscreenDocument;
    return (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) === this;
  }

  private get fullscreenSupported(): boolean {
    const doc = document as FullscreenDocument;
    return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  }

  private onFullscreenChange = (): void => {
    this.render();
  };

  /** Keys: Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z or Ctrl+Y redo, Space start or
   *  pause, F fullscreen. They apply when focus is inside the board, while it
   *  is fullscreen, or anywhere on the page with the `global-keys` attribute.
   *  Space and F never override a focused button, link, or field. */
  private onWindowKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const origin = (event.composedPath?.()[0] ?? event.target) as EventTarget | null;
    const inside = event.composedPath?.().includes(this) ?? false;
    const scoped = inside || this.isFullscreen || this.hasAttribute("global-keys");
    if (!scoped || isTypingTarget(origin)) return;
    if (!inside && isTypingTarget(document.activeElement)) return;

    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (meta && key === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (meta && key === "y") {
      event.preventDefault();
      this.redo();
      return;
    }
    if (event.key === "Escape" && this.confirmOpen) {
      this.confirmOpen = false;
      this.render();
      return;
    }
    if (meta || event.altKey || isInteractive(origin)) return;
    if (event.key === " " && this.clockEnabled) {
      event.preventDefault();
      this.toggleClock();
    } else if (key === "f" && this.fullscreenSupported) {
      void this.toggleFullscreen();
    }
  };

  // ---------------------------------------------------------------------
  // View
  // ---------------------------------------------------------------------

  private buildPanel(side: Side): PanelRefs {
    const name = h("input", {
      class: "name",
      type: "text",
      maxlength: "28",
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": `Name, ${sideLabel(side)}`,
      part: "name",
    });
    name.addEventListener("input", () => this.dispatch({ kind: "setName", side, name: name.value }));
    name.addEventListener("focus", () => name.select());

    const badge = h("span", { class: "badge", hidden: true });
    const pointsValue = h("span", { text: "0" });
    const points = h("p", { class: "points", part: "points" }, [h("span", { class: "sr-only", text: "Points: " }), pointsValue]);
    const adv = h("strong", { text: "0" });
    const pen = h("strong", { text: "0" });

    const scoreButtons = SCORING_ACTIONS.map((scoring) =>
      h("button", { type: "button", class: "score-btn", "data-act": "score", "data-side": side, "data-key": scoring.key }, [
        h("span", { text: scoring.label }),
        h("span", { class: "pts", "aria-hidden": "true", text: `+${scoring.points}` }),
      ]),
    );
    const advBtn = h("button", { type: "button", class: "minor-btn", "data-act": "advantage", "data-side": side, text: "+ Advantage" });
    const penBtn = h("button", { type: "button", class: "minor-btn", "data-kind": "pen", "data-act": "penalty", "data-side": side, text: "+ Penalty" });
    const subBtn = h("button", { type: "button", class: "minor-btn", "data-kind": "sub", "data-act": "submission", "data-side": side, text: "Submission" });

    const root = h("section", { class: "athlete", "data-side": side, part: `athlete athlete-${side}` }, [
      h("div", { class: "athlete-head" }, [name, badge]),
      points,
      h("div", { class: "tallies" }, [
        h("span", { class: "tally", "data-kind": "adv" }, [adv, " Adv"]),
        h("span", { class: "tally", "data-kind": "pen" }, [pen, " Pen"]),
      ]),
      h("div", { class: "grid" }, scoreButtons),
      h("div", { class: "minor" }, [advBtn, penBtn, subBtn]),
    ]);
    return { root, name, badge, points, pointsValue, adv, pen, scoreButtons, advBtn, penBtn, subBtn };
  }

  private build(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const style = h("style", { text: STYLES });

    const heading = h("p", { class: "heading", part: "heading", hidden: true });
    const status = h("p", { class: "status", part: "status" });
    const announce = h("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });

    const clockTime = h("div", { class: "clock-time", part: "clock-time", role: "timer", "aria-live": "off", "aria-label": "Time left" });
    const toggleClock = h("button", { type: "button", class: "btn", "data-kind": "primary", "data-act": "toggle-clock", text: "Start" });
    const belt = h("select", { "aria-label": "Match length by belt" });
    belt.addEventListener("change", () => {
      if (belt.value !== "custom") {
        this.beltKey = belt.value;
        this.customSeconds = null;
      }
      this.isRunning = false;
      this.stopTicker();
      this.remainingSeconds = this.duration;
      this.warned = null;
      this.persist();
      this.emitClock();
      this.render();
    });
    const clock = h("div", { class: "clock", part: "clock", role: "group", "aria-label": "Match clock" }, [
      clockTime,
      h("div", { class: "clock-controls" }, [
        toggleClock,
        h("button", { type: "button", class: "btn", "data-act": "reset-clock", text: "Reset clock" }),
        h("label", { class: "belt" }, [h("span", { text: "Belt", "aria-hidden": "true" }), belt]),
      ]),
    ]);

    const panels = { a: this.buildPanel("a"), b: this.buildPanel("b") };
    const mat = h("div", { class: "mat", part: "mat" }, [panels.a.root, panels.b.root]);

    const toast = h("p", { class: "toast", role: "status" });
    const result = h("div", { class: "result", part: "result", hidden: true }, [
      h("button", { type: "button", class: "btn", "data-act": "share", text: "Share result" }),
    ]);

    const confirmCancel = h("button", { type: "button", class: "btn", "data-act": "confirm-cancel", text: "Cancel" });
    const confirm = h("div", { class: "confirm", role: "alertdialog", "aria-label": "Start a new match?", hidden: true }, [
      h("p", { text: "Start a new match? This clears both scores." }),
      confirmCancel,
      h("button", { type: "button", class: "btn", "data-kind": "finish", "data-act": "confirm-new", text: "New match" }),
    ]);

    const undo = h("button", { type: "button", class: "btn", "data-act": "undo" }, [icon("undo"), "Undo"]);
    const redo = h("button", { type: "button", class: "btn", "data-act": "redo" }, [icon("redo"), "Redo"]);
    const endMatch = h("button", { type: "button", class: "btn", "data-kind": "finish", "data-act": "end", text: "End match" });
    const decisionA = h("button", { type: "button", class: "btn", "data-act": "decision", "data-side": "a" });
    const decisionB = h("button", { type: "button", class: "btn", "data-act": "decision", "data-side": "b" });
    const decision = h("div", { class: "decision", role: "group", "aria-label": "Referee decision", hidden: true }, [
      h("span", { text: "Decision:" }),
      decisionA,
      decisionB,
    ]);
    const newMatch = h("button", { type: "button", class: "btn", "data-kind": "finish", "data-act": "new", text: "New match", hidden: true });
    const fullscreen = h("button", { type: "button", class: "btn", "data-act": "fullscreen" });
    const settingsBtn = h("button", { type: "button", class: "btn", "data-act": "settings", "aria-expanded": "false", "aria-controls": "sb-settings", text: "Settings" });
    const bar = h("div", { class: "bar", part: "controls" }, [
      undo,
      redo,
      endMatch,
      decision,
      newMatch,
      h("button", { type: "button", class: "btn", "data-act": "swap" }, [icon("swap"), "Swap"]),
      h("button", { type: "button", class: "btn", "data-act": "reset", text: "Reset" }),
      fullscreen,
      settingsBtn,
    ]);

    const clockSwitch = h("input", { type: "checkbox" });
    const soundSwitch = h("input", { type: "checkbox" });
    clockSwitch.addEventListener("change", () => {
      this.setClockEnabled(clockSwitch.checked);
      this.persist();
      this.render();
    });
    soundSwitch.addEventListener("change", () => {
      this.soundEnabled = soundSwitch.checked;
      if (this.soundEnabled) void this.sounds?.unlock();
      this.persist();
      this.render();
    });
    const settings = h("div", { class: "settings", id: "sb-settings", part: "settings", hidden: true }, [
      h("label", { class: "switch" }, [clockSwitch, "Show match clock"]),
      h("label", { class: "switch" }, [soundSwitch, "Sound (end tone and 10-second warning)"]),
      h("p", {
        class: "note",
        text: "Turn the clock off to run the match on a wall clock and just keep score. On iPhone, tap Start once and switch off silent mode for sound.",
      }),
    ]);

    const logToggle = h("button", { type: "button", class: "log-toggle", "data-act": "log", "aria-expanded": "false", "aria-controls": "sb-log" });
    const logList = h("ol", { class: "log-list", id: "sb-log", hidden: true });
    const log = h("div", { class: "log", part: "log", hidden: true }, [logToggle, logList]);

    const creditSlot = h("slot", { name: "credit" });
    creditSlot.addEventListener("slotchange", () => this.ensureCredit());
    const credit = h("div", { class: "credit", part: "credit" }, [creditSlot]);

    const base = h("div", { class: "sb", part: "base" }, [
      h("header", { class: "header", part: "header" }, [heading, status]),
      announce,
      clock,
      mat,
      result,
      toast,
      confirm,
      bar,
      settings,
      log,
      credit,
    ]);

    shadow.replaceChildren(style, base);
    shadow.addEventListener("click", this.onClick);
    shadow.addEventListener("pointerdown", () => {
      if (this.soundEnabled) void this.sounds?.unlock();
    });

    this.refs = {
      base,
      heading,
      status,
      announce,
      clock,
      clockTime,
      toggleClock,
      belt,
      panels,
      result,
      toast,
      confirm,
      confirmCancel,
      undo,
      redo,
      endMatch,
      decision,
      decisionA,
      decisionB,
      newMatch,
      fullscreen,
      settingsBtn,
      settings,
      clockSwitch,
      soundSwitch,
      log,
      logToggle,
      logList,
      credit,
    };
  }

  private onClick = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
    if (!target) return;
    const side = target.dataset.side as Side | undefined;
    switch (target.dataset.act) {
      case "score": {
        const scoring = SCORING_ACTIONS.find((item) => item.key === target.dataset.key);
        if (!scoring || !side) return;
        buzz(12);
        this.addPoints(side, scoring.key);
        break;
      }
      case "advantage":
        if (!side) return;
        buzz(12);
        this.addAdvantage(side);
        break;
      case "penalty":
        if (!side) return;
        buzz(12);
        this.addPenalty(side);
        break;
      case "submission":
        if (side) this.submission(side);
        break;
      case "decision":
        if (side) this.decision(side);
        break;
      case "toggle-clock":
        this.toggleClock();
        break;
      case "reset-clock":
        this.resetClock();
        break;
      case "undo":
        this.undo();
        break;
      case "redo":
        this.redo();
        break;
      case "end":
        this.endMatch();
        break;
      case "swap":
        buzz(12);
        this.swap();
        break;
      case "new":
      case "reset":
        if (isUntouched(this.score)) {
          this.reset();
        } else {
          this.confirmOpen = true;
          this.render();
          this.refs?.confirmCancel.focus();
        }
        break;
      case "confirm-cancel":
        this.confirmOpen = false;
        this.render();
        break;
      case "confirm-new":
        this.reset();
        break;
      case "share":
        void this.shareResult();
        break;
      case "fullscreen":
        void this.toggleFullscreen();
        break;
      case "settings":
        this.settingsOpen = !this.settingsOpen;
        this.render();
        break;
      case "log":
        this.logOpen = !this.logOpen;
        this.render();
        break;
      default:
        break;
    }
  };

  private renderClock(): void {
    const refs = this.refs;
    if (!refs) return;
    const remaining = this.remainingSeconds;
    const text = formatClock(remaining);
    if (refs.clockTime.textContent !== text) refs.clockTime.textContent = text;
    refs.clock.toggleAttribute("data-running", this.isRunning);
    refs.clock.dataset.low = remaining <= 10 && remaining > 0 && this.isRunning ? "true" : "false";
    refs.clock.dataset.done = remaining <= 0 ? "true" : "false";
    const label = this.isRunning ? "Pause" : remaining <= 0 ? "Restart" : remaining < this.duration ? "Resume" : "Start";
    if (refs.toggleClock.textContent !== label) refs.toggleClock.textContent = label;
  }

  private render(): void {
    const refs = this.refs;
    if (!refs) return;
    const score = this.history.present;
    const status = describeStatus(score);

    refs.base.dataset.ended = String(status.ended);
    refs.status.textContent = status.text;
    if (status.winner) refs.status.dataset.winner = status.winner;
    else delete refs.status.dataset.winner;

    // Clock
    refs.clock.hidden = !this.clockEnabled;
    const options = BELT_PRESETS.map((preset) => ({ value: preset.key, label: `${preset.label} · ${formatClock(preset.seconds)}` }));
    if (this.customSeconds != null) options.push({ value: "custom", label: `Custom · ${formatClock(this.customSeconds)}` });
    const signature = options.map((option) => option.value + option.label).join("|");
    if (refs.belt.dataset.signature !== signature) {
      refs.belt.replaceChildren(...options.map((option) => h("option", { value: option.value, text: option.label })));
      refs.belt.dataset.signature = signature;
    }
    refs.belt.value = this.customSeconds != null ? "custom" : this.beltKey;
    this.renderClock();

    // Panels
    for (const side of ["a", "b"] as const) {
      const panel = refs.panels[side];
      const athlete = score[side];
      const isWinner = status.ended && status.winner === side;
      const isLeading = !status.ended && status.live && status.winner === side;
      panel.root.dataset.winner = String(isWinner);
      panel.root.dataset.leading = String(isLeading);
      panel.root.setAttribute("aria-label", `${athlete.name}, ${sideLabel(side)}`);
      if (panel.name.value !== athlete.name && panel.name !== this.shadowRoot?.activeElement) {
        panel.name.value = athlete.name;
      }
      panel.badge.hidden = !isWinner && !isLeading;
      panel.badge.textContent = isWinner ? "Winner" : isLeading ? "Leading" : "";
      if (isLeading) panel.badge.dataset.kind = "lead";
      else delete panel.badge.dataset.kind;

      panel.pointsValue.textContent = String(athlete.points);
      if (athlete.points !== this.lastPoints[side]) {
        panel.points.removeAttribute("data-bump");
        void panel.points.offsetWidth; // restart the pop animation
        panel.points.dataset.bump = "true";
      }
      this.lastPoints[side] = athlete.points;
      panel.adv.textContent = String(athlete.advantages);
      panel.pen.textContent = String(athlete.penalties);

      SCORING_ACTIONS.forEach((scoring, index) => {
        panel.scoreButtons[index].setAttribute(
          "aria-label",
          `${scoring.label}, ${scoring.points} points for ${athlete.name}`,
        );
      });
      panel.advBtn.setAttribute("aria-label", `Advantage for ${athlete.name}`);
      panel.penBtn.setAttribute("aria-label", `Penalty for ${athlete.name}`);
      panel.subBtn.setAttribute("aria-label", `Submission win for ${athlete.name}`);
    }

    // Result and bar
    refs.result.hidden = !status.ended;
    refs.undo.disabled = !this.history.past.length;
    refs.redo.disabled = !this.history.future.length;
    refs.endMatch.hidden = status.ended;
    const needsDecision = status.ended && status.winner === null;
    refs.decision.hidden = !needsDecision;
    refs.decisionA.textContent = score.a.name;
    refs.decisionB.textContent = score.b.name;
    refs.decisionA.setAttribute("aria-label", `Referee decision for ${score.a.name}`);
    refs.decisionB.setAttribute("aria-label", `Referee decision for ${score.b.name}`);
    refs.newMatch.hidden = !status.ended || needsDecision;
    refs.confirm.hidden = !this.confirmOpen;

    const fullscreenActive = this.isFullscreen;
    refs.fullscreen.hidden = !this.fullscreenSupported;
    refs.fullscreen.replaceChildren(icon(fullscreenActive ? "shrink" : "expand"), fullscreenActive ? "Exit fullscreen" : "Fullscreen");

    refs.settings.hidden = !this.settingsOpen;
    refs.settingsBtn.setAttribute("aria-expanded", String(this.settingsOpen));
    refs.clockSwitch.checked = this.clockEnabled;
    refs.soundSwitch.checked = this.soundEnabled;

    // Log
    const log = score.log ?? [];
    refs.log.hidden = log.length === 0;
    refs.logToggle.replaceChildren(
      `Match log · ${log.length} ${log.length === 1 ? "entry" : "entries"} `,
      h("span", { "aria-hidden": "true", text: this.logOpen ? "\u2212" : "+" }),
    );
    refs.logToggle.setAttribute("aria-expanded", String(this.logOpen));
    refs.logList.hidden = !this.logOpen;
    if (this.logOpen) {
      refs.logList.replaceChildren(
        ...log.map((entry) =>
          h("li", { "data-side": entry.side }, [
            h("span", { class: "log-at", text: entry.at ?? "" }),
            h("span", { class: "log-who", text: score[entry.side].name }),
            h("span", { class: "log-what", text: `${entry.label}${entry.points ? ` +${entry.points}` : ""}` }),
          ]),
        ),
      );
    }

    refs.credit.hidden = this.hasAttribute("no-credit");
  }
}

/** Register <bjj-scoreboard> (or your own tag name). Safe to call twice. */
export const defineBjjScoreboard = (tagName: string = TAG_NAME): void => {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, tagName === TAG_NAME ? BjjScoreboardElement : class extends BjjScoreboardElement {});
  }
};

declare global {
  interface HTMLElementTagNameMap {
    "bjj-scoreboard": BjjScoreboardElement;
  }
}
