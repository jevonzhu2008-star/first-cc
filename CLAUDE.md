# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A pure frontend Pomodoro timer app with three files: `pomodoro.html`, `style.css`, `script.js`. No build step, no package manager, no test framework.

## Running the App

Open `pomodoro.html` directly in a browser, or serve via any static file server:

```bash
python -m http.server 8080
# or
npx serve .
```

Then visit `http://localhost:8080/pomodoro.html`.

## Architecture

### File Responsibilities

- **pomodoro.html**: Single-page layout with mode tabs, SVG circular progress ring, controls, settings panel, and history panel.
- **style.css**: Dark theme by default (`:root`); light theme via `data-theme="light"`. CSS custom properties for all colors.
- **script.js**: All application logic in a single module. Key sections (top to bottom):
  - Constants and state (`MODES`, `mode`, `remaining`, `intervalId`, etc.)
  - Data layer (`loadData`/`saveData` via `localStorage`, key `pomodoro_data_v1`)
  - Statistics (`updateStats`, `renderHistory`, `getWeekRecords`)
  - Audio (Web Audio API white noise + alarm beeps)
  - Timer lifecycle (`startTimer`, `tick`, `onTimerComplete`)
  - UI updates (`updateDisplay`, `updateTabs`, `updateTitle`)
  - Event handlers and DOM refs at the bottom

### Data Model

`localStorage` stores a single JSON object:

```json
{
  "records": { "2025-05-28": [{ "task": "...", "minutes": 25, "time": "..." }] },
  "settings": { "work": 25, "shortBreak": 5, "longBreak": 15, "autoBreak": true, "autoWork": false },
  "theme": "dark"
}
```

Records are grouped by ISO date string (`YYYY-MM-DD`).

### Timer Flow

1. User picks a mode (`work`/`shortBreak`/`longBreak`) — each has its own duration.
2. `startTimer()` begins a 1-second `setInterval`.
3. `tick()` decrements `remaining` and updates the SVG progress ring via `strokeDashoffset`.
4. When `remaining` reaches 0, `onTimerComplete()`:
   - Plays an alarm via Web Audio API
   - If `work` mode: saves a record to `localStorage`, then optionally auto-switches to break after 1.2s if `autoBreak` is enabled
   - If break mode: optionally auto-switches back to work after 1.2s if `autoWork` is enabled

### Keyboard Shortcuts

Handled in `script.js` keydown listener (ignored when an `<input>` is focused):

- `Space` — start/pause
- `S` — skip to next mode
- `R` — reset timer
- `H` — toggle history panel

## Common Changes

- **Adjust default durations**: edit `MODES` object at the top of `script.js`.
- **Add a new mode**: add entry to `MODES`, add a tab button in HTML, add handler in JS.
- **Change auto-switch rules**: modify `onTimerComplete()` — current logic uses every 4th work session as a long break trigger.

## Additional instruction

- 当需要对前端进行修改时，去参考[text](品牌视觉规范)这个文件里的内容