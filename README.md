# The Velvet Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Kiowayyy2109/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Kiowayyy2109/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A quiet heist in three rooms. You are the thief in the velvet mask: cross
**The Velvet Gallery**, **The Vault Floor** and **The Rooftop Escape**, lift
every piece of loot, and reach the exit before the alarm hits 100%.

Guards patrol with raycast vision cones that walls cut off; security
cameras sweep the rooms; shadow patches hide you and brass vents give you
routes the guards are too big to follow. Getting seen is not instant death:
a guard grows suspicious first ("?"), investigates, and only then gives
chase ("!") while the alarm climbs — break line of sight and the meter
falls back. Spend coins to toss a distraction, drop smoke to vanish, and
hold E to crack the locked safes. The exit only opens once a room is empty
of loot, so the getaway has to be earned.

## How to run it

No build step, no network. Serve `game/` with any static server and open
`game/index.html` in desktop Chrome, for example:

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

or `python3 -m http.server` from inside `game/`. All art is drawn on the
canvas and all sound is synthesized with WebAudio — the game plays fully
offline.

## Controls

- **WASD / Arrow keys** — move (or click anywhere to walk there)
- **Shift** — sneak (slower, harder to spot)
- **Space** — run (faster, louder — guards hear you)
- **E** — grab loot (hold E to crack a locked safe)
- **Q** — toss a coin: the nearest guards go investigate the clink
- **F** — smoke bomb: blocks every cone for a few seconds
- **P / Esc** — pause · **R** — restart the room · **M** — mute

## Screenshots

The three screenshots in `screenshots/` are real renders of the game,
staged deterministically with `?shot=cover|action|getaway&seed=1` — the
autopilot in `game/src/shots.js` plays the real rules forward, so the same
seed always gives the same frame.

<sub>Entered on [make.fun](https://make.fun/?ref=CHRW-KCFF&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
