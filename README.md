# bjj-scoreboard

A free IBJJF BJJ scoreboard web component with points, advantages, penalties, automatic tiebreaks, and a match clock.

Made by [Grapple Flows](https://grappleflows.com). Use it hosted at [grappleflows.com/bjj-scoreboard](https://grappleflows.com/bjj-scoreboard), or put it on your own site.

![bjj-scoreboard web component mid-match: points, advantages, and penalties for two competitors with a purple belt match clock](https://raw.githubusercontent.com/grapple-flows/bjj-scoreboard/main/docs/screenshot.png)

`<bjj-scoreboard>` is a standard custom element. It works in any page or framework (plain HTML, WordPress, Squarespace code blocks, React, Vue, Svelte, Astro) with one script tag, has no runtime dependencies, and ships TypeScript types. The scoring rules are also exported as plain functions, so you can use them without the UI.

## Quick start

```html
<script src="https://cdn.jsdelivr.net/npm/bjj-scoreboard@0/dist/bjj-scoreboard.min.js" defer></script>

<bjj-scoreboard></bjj-scoreboard>
```

That is a complete scoreboard: tap the name fields to set the corners, tap what each competitor scored, and press Start for the match clock.

With names, a belt-timed clock, and the credit link written into your own HTML:

```html
<bjj-scoreboard belt="purple" name-a="Ana Souza" name-b="Bea Lima">
  <a slot="credit" href="https://grappleflows.com/bjj-scoreboard">Free BJJ scoreboard by Grapple Flows</a>
</bjj-scoreboard>
```

The same file is on unpkg: `https://unpkg.com/bjj-scoreboard@0/dist/bjj-scoreboard.min.js`.

## Install from npm

```sh
npm install bjj-scoreboard
```

```js
import "bjj-scoreboard"; // registers <bjj-scoreboard>

const board = document.querySelector("bjj-scoreboard");
board.addEventListener("bjj-scoreboard:end", (event) => {
  console.log(event.detail.text); // "Ana Souza wins on advantages"
});
```

The package is ESM, has no runtime dependencies, and is safe to import during server rendering (the element registers only in a browser).

## No code? Use the embed

If your site builder does not allow script tags, or you would rather not host anything, copy the ready-made embed code from [grappleflows.com/tools](https://grappleflows.com/tools#embed) and paste it into your page.

## Features

- One-tap IBJJF points: takedown, sweep, and knee on belly (2), guard pass (3), mount and back control (4).
- Advantages and penalties, tallied per competitor.
- Automatic IBJJF tiebreaks when time runs out: points, then advantages, then fewest penalties, then a referee decision prompt.
- Match clock with IBJJF belt times (kids, white, blue, purple, brown, black) or any custom length. The clock counts from timestamps, so it stays right when a phone locks or the tab is in the background.
- Wood-knock warning at 10, 9, and 8 seconds left and a tone at the end of the match. The sounds are synthesized in the browser, so there are no audio files to host.
- Undo and redo for every call, including Cmd or Ctrl+Z.
- Match log with the clock time of each score.
- Share result: the outcome, final numbers, and match log as text, through the phone's share sheet or copied to the clipboard.
- Fullscreen for a TV or projector, with the numbers scaled to the screen.
- Survives an accidental refresh (saved in `localStorage`).
- Swap corners, rename competitors in place, and turn the clock off to keep score against a separate mat clock.
- Accessible: every button is labelled with the competitor it scores for, score changes are announced through a polite live region, focus is visible, and animations stop under `prefers-reduced-motion`.
- Mobile-first: on a narrow screen both corners stay side by side so a referee or coach can score either competitor without scrolling. The layout follows the element's width (container queries), not the window's.
- Light, dark, and automatic themes, all colors adjustable with CSS custom properties.

## Attributes

| Attribute | Default | What it does |
| --- | --- | --- |
| `belt` | `white` | Match length by belt: `kids` (4:00), `white` (5:00), `blue` (6:00), `purple` (7:00), `brown` (8:00), `black` (10:00). |
| `duration` | | Custom match length, as `m:ss` (`4:30`) or seconds (`270`). Overrides `belt`. |
| `name-a`, `name-b` | `Athlete 1`, `Athlete 2` | Competitor names. They can still be edited on the board. |
| `color-a`, `color-b` | blue, red | Corner colors, any CSS color. |
| `heading` | | Optional title shown above the status line. |
| `theme` | light | `dark`, or `auto` to follow the visitor's system setting. |
| `no-clock` | | Hide the match clock and keep score only. |
| `no-sound` | | Start with sound off. |
| `no-credit` | | Hide the "Free BJJ scoreboard by Grapple Flows" link. See [Credit link](#credit-link). |
| `no-persist` | | Do not save the match in `localStorage`. |
| `storage-key` | `bjj-scoreboard` or `bjj-scoreboard:<id>` | Storage key. Give each board on a page its own `id` (or key) so they do not share a save. |
| `global-keys` | | Keyboard shortcuts work anywhere on the page, not only when focus is inside the board. Use it on a page that is only a scoreboard. |
| `share-url` | | A link added to the end of the shared result text. |

Attributes win over a saved match: if the page sets `name-a`, that name is used after a refresh.

Keyboard shortcuts: Cmd or Ctrl+Z undo, Shift+Cmd+Z or Ctrl+Y redo, Space start or pause the clock, F fullscreen. Space and F apply while the board is fullscreen or with `global-keys`, and never override a focused button or field.

## JavaScript API

```js
const board = document.querySelector("bjj-scoreboard");

board.start();                    // start or resume the clock
board.pause();
board.resetClock();               // back to full time, scores untouched
board.reset();                    // new match: scores, log, and clock cleared, names kept

board.addPoints("a", "pass");     // scoring key: takedown, sweep, knee, pass, mount, back
board.addPoints("b", 2, "Sweep"); // or a number of points and an optional log label
board.addAdvantage("a");
board.addPenalty("b");
board.submission("a");            // ends the match
board.endMatch();                 // ends it now and applies the tiebreaks
board.decision("b");              // referee decision after a dead-even match
board.undo();
board.redo();
board.swap();                     // swap corners
board.setNames("Ana", "Bea");

board.getResult();
// { ended, type: "none" | "submission" | "time" | "decision", winner: "a" | "b" | null,
//   winnerName, text, a, b, log, summary }
```

| Member | Type | Notes |
| --- | --- | --- |
| `score` | `Score` | Current names, points, advantages, penalties, result, and log. |
| `remaining` | `number` | Seconds left on the clock. |
| `running` | `boolean` | Whether the clock is running. |
| `duration` | `number` | Full match length in seconds. |
| `canUndo`, `canRedo` | `boolean` | |
| `setScore(score)` | method | Load a saved `Score` (clears undo history). |
| `toggleClock()` | method | Start if paused, pause if running. |
| `toggleFullscreen()` | method | Must be called from a click or key press. |
| `dispatch(action)` | method | Apply any scoring `Action` directly. |

## Events

All events bubble and cross the shadow boundary.

| Event | `event.detail` | Fires when |
| --- | --- | --- |
| `bjj-scoreboard:score` | `{ action, score, status }` | Any scoring change: points, advantage, penalty, submission, end, decision, undo, redo, swap, or reset. |
| `bjj-scoreboard:end` | the same object as `getResult()` | The match ends (submission, time, or End match), and again if a referee decision settles a tied match. |
| `bjj-scoreboard:clock` | `{ running, remaining, duration }` | The clock starts, pauses, resets while running, reaches 0:00, or changes length. |

```js
board.addEventListener("bjj-scoreboard:score", (event) => {
  const { score, status } = event.detail;
  fetch("/api/mat-1", { method: "POST", body: JSON.stringify({ score, status: status.text }) });
});
```

## Theming

Set any of these on the element, or on a parent. Dark and auto themes use their own defaults for anything you do not set.

| Property | Default (light) | Used for |
| --- | --- | --- |
| `--bjj-sb-bg` | `#f5f3ef` | Board background |
| `--bjj-sb-bg-alt` | `#efebe3` | Status bar |
| `--bjj-sb-panel` | `#ffffff` | Cards and buttons |
| `--bjj-sb-ink` | `#18181b` | Text |
| `--bjj-sb-muted` | `#5f5f68` | Secondary text |
| `--bjj-sb-faint` | `#8a8a93` | Log times |
| `--bjj-sb-border` | `#e7e5e4` | Card borders |
| `--bjj-sb-border-strong` | `#d4d4d8` | Button borders |
| `--bjj-sb-color-a` | `#1d4ed8` | Corner 1 |
| `--bjj-sb-color-b` | `#dc2626` | Corner 2 |
| `--bjj-sb-on-accent` | `#ffffff` | Text on corner-colored buttons |
| `--bjj-sb-penalty` | `#b45309` | Penalty counts |
| `--bjj-sb-finish` | `#611f69` | End match and New match |
| `--bjj-sb-focus` | `#2563eb` | Focus ring |
| `--bjj-sb-radius` | `18px` | Card corners |
| `--bjj-sb-font` | system sans | Text font |
| `--bjj-sb-mono` | system mono | Clock and labels |

```css
bjj-scoreboard {
  --bjj-sb-color-a: #15803d; /* green corner */
  --bjj-sb-color-b: #ca8a04; /* yellow corner */
  --bjj-sb-font: "Inter", sans-serif;
  max-width: 1100px;
  margin: 0 auto;
}
```

For deeper changes, these parts are styleable with `::part()`: `base`, `header`, `heading`, `status`, `clock`, `clock-time`, `mat`, `athlete`, `athlete-a`, `athlete-b`, `name`, `points`, `controls`, `result`, `settings`, `log`, `credit`.

## Scoring logic without the UI

The rules are pure functions with no DOM. Import them from `bjj-scoreboard/scoring` (no side effects, nothing registered):

```js
import { initialScore, reducer, describeStatus, formatResultText } from "bjj-scoreboard/scoring";

let state = { past: [], present: initialScore(), future: [] };
state = reducer(state, { kind: "setName", side: "a", name: "Ana" });
state = reducer(state, { kind: "setName", side: "b", name: "Bea" });
state = reducer(state, { kind: "score", side: "a", points: 2, label: "Sweep", at: "1:10" });
state = reducer(state, { kind: "advantage", side: "b" });
state = reducer(state, { kind: "endByTime" });

describeStatus(state.present).text; // "Ana wins on points"
formatResultText(state.present);
// Ana wins on points
// Ana: 2 pts, 0 adv, 0 pen
// Bea: 0 pts, 1 adv, 0 pen
//
// Match log:
// 1:10 Ana: Sweep +2
// Bea: Advantage
```

| Export | What it is |
| --- | --- |
| `SCORING_ACTIONS` | The six scoring positions with their keys, labels, and points. |
| `BELT_PRESETS`, `beltSeconds(key)` | Belt match lengths. |
| `initialScore()`, `blankAthlete(name)` | A fresh score. |
| `mutate(score, action)` | Apply one action to a score. |
| `reducer(history, action)` | The same, with undo and redo. Works as a React `useReducer` reducer. |
| `compareSides(a, b)` | IBJJF tiebreak: `"a"`, `"b"`, or `"tie"`. |
| `describeStatus(score)` | Status line, leader or winner, and whether the match has ended. |
| `isUntouched(score)` | True for a fresh board. |
| `formatClock(seconds)`, `warningBeat(remaining, total)` | Clock helpers. |
| `formatResultText(score)` | Plain-text scoresheet. |
| `IBJJF_POINTS`, `TIEBREAK_ORDER`, `MATCH_TIMES`, `RULE_SOURCES` | The reference tables below, as data. |

Actions: `score`, `advantage`, `penalty`, `submission`, `decision`, `endByTime`, `swap`, `resetScores`, `setName`, `hydrate`, `undo`, `redo`.

## IBJJF points

Under the unified IBJJF rules, gi and no-gi share the same point values, and points are awarded for control. The position has to be held for 3 seconds to score.

| Position | Points | What it takes |
| --- | --- | --- |
| Takedown | 2 | Put your opponent down and establish on top for 3 seconds. |
| Sweep | 2 | Reverse from bottom guard to a dominant top position. |
| Knee on belly | 2 | Knee across the torso, posted upright, foot off the mat. |
| Guard pass | 3 | Clear the legs and stabilize control past the guard. |
| Mount | 4 | Sit on the chest with both knees on the mat. |
| Back control | 4 | Both hooks in (or a body triangle) behind the opponent. |

An advantage rewards a near-score, like almost finishing a sweep, pass, or submission. A penalty is given for fouls or stalling. On this scoreboard neither changes the points total; they only break a tie at the end of the match. The IBJJF rulebook also attaches consequences to repeated penalties (including disqualification); the scoreboard does not apply those for you, so add any points or advantages the referee awards with the normal buttons.

## How IBJJF breaks a tie

When the clock runs out with no submission, IBJJF resolves the match in this order:

1. Most points wins.
2. If points are tied, most advantages wins.
3. If advantages are tied, the fewest penalties wins.
4. If everything is level, it goes to a referee decision.

The scoreboard applies this for you. Press End match (or let the clock run out) and it shows the winner and why, or asks for the referee's decision if the match is dead even.

## IBJJF match times by belt

| Belt | Adult | Master 1 |
| --- | --- | --- |
| White | 5:00 | 5:00 |
| Blue | 6:00 | 6:00 |
| Purple | 7:00 | 6:00 |
| Brown | 8:00 | 6:00 |
| Black | 10:00 | 6:00 |

Juvenile runs 5:00. Master 2 and older divisions, and kids divisions, are shorter, and exact times can vary by event. Pick the belt with the `belt` attribute or the Belt menu, set any length with `duration`, or turn the clock off and keep score against the mat clock.

Sources: [IBJJF Rules Book v6.1 (June 2024)](https://ibjjf.com/books-videos). Rules change, and events sometimes publish their own variations, so always check the current IBJJF rulebook and the event page before running an event. This project is not affiliated with or endorsed by the IBJJF.

## Running an in-house tournament on a TV

1. Open a page with the scoreboard on a laptop connected to the TV or projector. A page with only the board and `global-keys` works well.
2. Set the belt for the division, or a custom `duration` for your format.
3. Press Fullscreen (or F). The clock and scores scale to the screen, and the scoring buttons stay so the table can keep running the match from the laptop.
4. Score with the buttons. Space starts and pauses the clock, and Cmd or Ctrl+Z takes back a wrong call.
5. At the end, Share result copies the scoresheet for your bracket or group chat. New match clears the board and keeps it ready for the next pair.

For several mats, open one page per mat and give each board its own `id` so their saved matches stay separate. Listen for `bjj-scoreboard:end` if you want to send results to your own bracket or results page.

If you need brackets as well, [grappleflows.com/brackets](https://grappleflows.com/brackets) has a free bracket generator.

## Credit link

By default the board shows a small "Free BJJ scoreboard by Grapple Flows" link under the controls. It is a normal `<a slot="credit">` in the page's own HTML (the light DOM), not inside the shadow root, so it reads like any other link on your page. If you write your own `<a slot="credit">` inside the element, as in the quick start, that one is used instead.

The license is MIT, so you are free to remove it: add `no-credit`. Keeping it is appreciated, since it is how people find the free tool.

## Development

```sh
npm install
npm run typecheck
npm test        # rules, the ported app tests, and element smoke tests (happy-dom)
npm run build   # dist/bjj-scoreboard.js (ESM), dist/bjj-scoreboard.min.js (script tag), dist/scoring.js, types
```

Then open `demo/index.html` in a browser.

The scoring logic in `src/scoreboard.ts` is ported from the Grapple Flows app, where it powers [grappleflows.com/bjj-scoreboard](https://grappleflows.com/bjj-scoreboard). Function names are kept the same so fixes can move between the two.

## Related

- [bjj-timer](https://github.com/grapple-flows/bjj-timer): BJJ round timer web component.
- [bjj-bracket](https://github.com/grapple-flows/bjj-bracket): tournament bracket generator.
- [bjj-data](https://github.com/grapple-flows/bjj-data): IBJJF and ADCC weight classes, legal techniques, belt requirements, and a position vocabulary as JSON and TypeScript.

## About Grapple Flows

Grapple Flows is a free BJJ flowchart app that turns voice notes and videos into visual maps of jiu-jitsu techniques, positions, and transitions you can study, edit, and share.

- [grappleflows.com](https://grappleflows.com)
- [Free BJJ tools](https://grappleflows.com/tools)

## License

[MIT](LICENSE). Copyright Grapple Flows.
