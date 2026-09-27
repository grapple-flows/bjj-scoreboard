// Shadow DOM styles for <bjj-scoreboard>. Every color, the fonts and the
// corner radius read a public --bjj-sb-* custom property first, so a page can
// theme the board without reaching inside it. See "Theming" in the README.

export const STYLES: string = /* css */ `
:host {
  display: block;
  container-type: inline-size;
  box-sizing: border-box;
}

:host([hidden]) {
  display: none;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.sb {
  --_bg: var(--bjj-sb-bg, #f5f3ef);
  --_bg-alt: var(--bjj-sb-bg-alt, #efebe3);
  --_panel: var(--bjj-sb-panel, #ffffff);
  --_ink: var(--bjj-sb-ink, #18181b);
  --_muted: var(--bjj-sb-muted, #5f5f68);
  --_faint: var(--bjj-sb-faint, #8a8a93);
  --_border: var(--bjj-sb-border, #e7e5e4);
  --_border-strong: var(--bjj-sb-border-strong, #d4d4d8);
  --_a: var(--bjj-sb-color-a, #1d4ed8);
  --_b: var(--bjj-sb-color-b, #dc2626);
  --_on-accent: var(--bjj-sb-on-accent, #ffffff);
  --_penalty: var(--bjj-sb-penalty, #b45309);
  --_finish: var(--bjj-sb-finish, #611f69);
  --_focus: var(--bjj-sb-focus, #2563eb);
  --_radius: var(--bjj-sb-radius, 18px);
  --_font: var(--bjj-sb-font, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif);
  --_mono: var(--bjj-sb-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);

  padding: 0 0 16px;
  color: var(--_ink);
  background: var(--_bg);
  font-family: var(--_font);
  line-height: 1.4;
  border-radius: var(--_radius);
  overflow: hidden;
}

:host([theme="dark"]) .sb {
  --_bg: var(--bjj-sb-bg, #0f0f12);
  --_bg-alt: var(--bjj-sb-bg-alt, #17171c);
  --_panel: var(--bjj-sb-panel, #1c1c22);
  --_ink: var(--bjj-sb-ink, #f4f4f5);
  --_muted: var(--bjj-sb-muted, #a1a1aa);
  --_faint: var(--bjj-sb-faint, #8b8b94);
  --_border: var(--bjj-sb-border, #2a2a31);
  --_border-strong: var(--bjj-sb-border-strong, #3a3a43);
  --_a: var(--bjj-sb-color-a, #60a5fa);
  --_b: var(--bjj-sb-color-b, #f87171);
  --_on-accent: var(--bjj-sb-on-accent, #0f0f12);
  --_penalty: var(--bjj-sb-penalty, #f59e0b);
  --_finish: var(--bjj-sb-finish, #c084fc);
  --_focus: var(--bjj-sb-focus, #93c5fd);
}

@media (prefers-color-scheme: dark) {
  :host([theme="auto"]) .sb {
    --_bg: var(--bjj-sb-bg, #0f0f12);
    --_bg-alt: var(--bjj-sb-bg-alt, #17171c);
    --_panel: var(--bjj-sb-panel, #1c1c22);
    --_ink: var(--bjj-sb-ink, #f4f4f5);
    --_muted: var(--bjj-sb-muted, #a1a1aa);
    --_faint: var(--bjj-sb-faint, #8b8b94);
    --_border: var(--bjj-sb-border, #2a2a31);
    --_border-strong: var(--bjj-sb-border-strong, #3a3a43);
    --_a: var(--bjj-sb-color-a, #60a5fa);
    --_b: var(--bjj-sb-color-b, #f87171);
    --_on-accent: var(--bjj-sb-on-accent, #0f0f12);
    --_penalty: var(--bjj-sb-penalty, #f59e0b);
    --_finish: var(--bjj-sb-finish, #c084fc);
    --_focus: var(--bjj-sb-focus, #93c5fd);
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--_focus);
  outline-offset: 2px;
}

[hidden] {
  display: none !important;
}

/* ---------- header ---------- */
.header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--_border);
  background: var(--_bg-alt);
}

.heading {
  margin: 0 0 4px;
  font-size: clamp(1.1rem, 4cqi, 1.6rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.status {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--_muted);
}

.status[data-winner="a"] {
  color: var(--_a);
}

.status[data-winner="b"] {
  color: var(--_b);
}

/* ---------- clock ---------- */
.clock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 20px;
  margin: 14px 16px 0;
  padding: 12px 16px;
  border: 1px solid var(--_border);
  border-radius: calc(var(--_radius) - 2px);
  background: var(--_panel);
}

.clock-time {
  font-family: var(--_mono);
  font-size: clamp(2.4rem, 11cqi, 4.5rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.clock[data-low="true"] .clock-time {
  color: var(--_b);
  animation: sb-flash 1s steps(2, jump-none) infinite;
}

.clock[data-done="true"] .clock-time {
  color: var(--_muted);
}

.clock-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.belt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--_mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--_muted);
}

.belt select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--_border-strong);
  border-radius: 999px;
  background: var(--_panel);
  color: var(--_ink);
  font-family: var(--_font);
  font-size: 14px;
  letter-spacing: normal;
  text-transform: none;
}

/* ---------- mat ---------- */
.mat {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 12px 16px 0;
}

.athlete {
  --accent: var(--_a);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 18px 16px 16px;
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  background: var(--_panel);
  overflow: hidden;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.athlete[data-side="b"] {
  --accent: var(--_b);
}

.athlete::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: var(--accent);
}

.athlete[data-leading="true"] {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.athlete[data-winner="true"] {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
  animation: sb-celebrate 0.5s ease;
}

.athlete-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: var(--_ink);
  font-size: clamp(1rem, 3cqi, 1.35rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.name:focus {
  border-color: var(--accent);
  background: var(--_panel);
}

.badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--_on-accent);
  font-family: var(--_mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.badge[data-kind="lead"] {
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
}

.points {
  display: block;
  margin: 0;
  text-align: center;
  font-size: clamp(3.4rem, 17cqi, 9rem);
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.points[data-bump="true"] {
  animation: sb-pop 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.tallies {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.tally {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--_border);
  border-radius: 999px;
  background: var(--_bg);
  font-family: var(--_mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--_muted);
}

.tally strong {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--_ink);
  font-variant-numeric: tabular-nums;
}

.tally[data-kind="pen"] strong {
  color: var(--_penalty);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.score-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 54px;
  padding: 0 12px;
  border: 1px solid var(--_border-strong);
  border-radius: 12px;
  background: var(--_panel);
  color: var(--_ink);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.08s ease, background 0.12s ease, border-color 0.12s ease;
}

.score-btn .pts {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 15px;
  font-weight: 900;
}

.score-btn:hover {
  border-color: var(--accent);
}

.score-btn:active,
.minor-btn:active,
.btn:active {
  transform: scale(0.96);
}

.minor {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.minor-btn {
  min-height: 46px;
  padding: 0 6px;
  border: 1px solid var(--_border-strong);
  border-radius: 10px;
  background: var(--_panel);
  color: var(--_ink);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.08s ease, background 0.12s ease;
}

.minor-btn[data-kind="pen"] {
  color: var(--_penalty);
  border-color: color-mix(in srgb, var(--_penalty) 45%, transparent);
}

.minor-btn[data-kind="sub"] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--_on-accent);
}

/* ---------- control bar ---------- */
.bar,
.result,
.confirm,
.settings,
.log {
  margin: 14px 16px 0;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.decision {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--_muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--_border-strong);
  border-radius: 999px;
  background: var(--_panel);
  color: var(--_ink);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.08s ease, opacity 0.12s ease;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn[data-kind="primary"] {
  min-width: 96px;
  justify-content: center;
  background: var(--_ink);
  border-color: var(--_ink);
  color: var(--_bg);
}

.btn[data-kind="finish"] {
  background: var(--_finish);
  border-color: var(--_finish);
  color: var(--_on-accent);
}

.btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ---------- result, confirm, settings ---------- */
.result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.toast {
  margin: 0;
  font-size: 14px;
  color: var(--_muted);
}

.confirm,
.settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 16px;
  border: 1px solid var(--_border);
  border-radius: calc(var(--_radius) - 4px);
  background: var(--_panel);
}

.confirm p {
  flex-basis: 100%;
  margin: 0;
  font-weight: 600;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
}

.switch input {
  width: 20px;
  height: 20px;
  accent-color: var(--_ink);
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: 13px;
  color: var(--_muted);
}

/* ---------- match log ---------- */
.log-toggle {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--_muted);
  font-family: var(--_mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.log-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--_border);
  border-radius: 12px;
  background: var(--_panel);
}

.log-list li {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: baseline;
  padding: 9px 14px;
  border-top: 1px solid var(--_border);
  font-size: 14px;
}

.log-list li:first-child {
  border-top: 0;
}

.log-at {
  font-family: var(--_mono);
  font-size: 12px;
  color: var(--_faint);
  font-variant-numeric: tabular-nums;
}

.log-who {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.log-list li[data-side="a"] .log-who {
  color: var(--_a);
}

.log-list li[data-side="b"] .log-who {
  color: var(--_b);
}

.log-what {
  color: var(--_muted);
}

/* ---------- credit (light DOM link, slotted) ---------- */
.credit {
  margin: 14px 16px 0;
  font-size: 13px;
  color: var(--_muted);
}

::slotted(a) {
  color: var(--_muted);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ---------- narrow: both corners stay on one screen ---------- */
@container (max-width: 639px) {
  .header,
  .clock,
  .mat,
  .bar,
  .result,
  .confirm,
  .settings,
  .log,
  .credit {
    margin-left: 10px;
    margin-right: 10px;
  }

  .mat {
    gap: 8px;
  }

  .athlete {
    gap: 10px;
    padding: 14px 8px 12px;
  }

  .name {
    font-size: 14px;
  }

  .athlete-head {
    flex-wrap: wrap;
  }

  .grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .score-btn {
    min-height: 44px;
    padding: 0 8px;
    font-size: 12.5px;
  }

  .score-btn .pts {
    min-width: 26px;
    height: 24px;
    font-size: 13px;
  }

  .minor {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .minor-btn {
    min-height: 44px;
    font-size: 12.5px;
  }

  .tally {
    padding: 4px 10px;
  }

  .tally strong {
    font-size: 16px;
  }
}

/* ---------- fullscreen: TV or projector ---------- */
:host(:fullscreen) {
  overflow-y: auto;
}

:host(:fullscreen) .sb {
  min-height: 100vh;
  border-radius: 0;
}

:host(:fullscreen) .status {
  font-size: clamp(18px, 3vh, 34px);
}

:host(:fullscreen) .clock-time {
  font-size: clamp(64px, 14vh, 190px);
}

:host(:fullscreen) .points {
  font-size: clamp(6rem, 26vh, 22rem);
}

:host(:fullscreen) .name {
  font-size: clamp(18px, 3.4vh, 42px);
}

:host(:fullscreen) .tally {
  font-size: clamp(14px, 2.2vh, 24px);
}

:host(:fullscreen) .tally strong {
  font-size: clamp(20px, 3.4vh, 40px);
}

:host(:fullscreen) .settings,
:host(:fullscreen) .log {
  display: none;
}

/* ---------- motion ---------- */
@keyframes sb-pop {
  0% {
    transform: scale(0.6);
    opacity: 0.45;
  }
  60% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes sb-celebrate {
  35% {
    transform: scale(1.02);
  }
}

@keyframes sb-flash {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .points[data-bump="true"],
  .athlete[data-winner="true"],
  .clock[data-low="true"] .clock-time {
    animation: none;
  }

  .athlete,
  .btn,
  .score-btn,
  .minor-btn {
    transition: none;
  }

  .score-btn:active,
  .minor-btn:active,
  .btn:active {
    transform: none;
  }
}
`;
