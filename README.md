[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lightxa/makefun-gta6-01-varian7/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lightxa/makefun-gta6-01-varian7/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay

An original open-world crime game in the spirit of GTA 6, built for the make.fun gta6-01 bounty. You play Marisol "Mari" Vega, a driver for hire in Solmar Bay, a sun-soaked coastal city of pastel rooftops, palm courts, a marina, a beach and a harbor. The city, its people, its story and its music are all invented for this game.

## What you do

Explore the city on foot or by car, steal cars off the street, outrun the Solmar Bay Police Department, and work through a three-chapter story: steal a clean car for Rico's Garage, race the Bay Run checkpoints against the clock, and run a package through the Harbor Depot while shaking a two-star police tail. Between missions the city stays alive: traffic cruises the avenues, pedestrians stroll the sidewalks and run from trouble, and the police answer every crime with a pursuit.

## Systems

- Open world: a seeded city of avenues, streets, districts, a park, a beach and a marina, the same every run
- Driving: arcade handling with acceleration, steering, handbrake drifts and building bumps
- Car theft: step up to any parked or traffic car and take it, at the cost of wanted stars
- Wanted level: five stars, police cruisers that chase and ram, heat that cools when you lay low
- Missions and story: three chapters with map markers, objectives, timers and cash payouts
- Combat: punches up close and a pistol aimed with the mouse
- HUD: cash, health, ammo, wanted stars, mission objective, timer, speed and a live minimap
- Save: progress autosaves after every completed mission and can be saved from the pause menu
- Sound: engine hum, sirens, gunshots and chimes synthesized live with Web Audio, no audio files
- Screens: title screen, pause menu, busted and wasted screens, and a restart
- Deterministic: the city, the traffic and the pedestrians are built from one seed, so the same seed always builds the same Solmar Bay

## Controls

| Key | Action |
| --- | --- |
| W A S D / Arrows | Move on foot, drive in a car |
| Shift | Sprint |
| E | Enter or exit a car |
| F | Punch |
| Mouse + Click | Aim and shoot |
| Space | Handbrake |
| N | Start the next mission |
| M | Show the current objective |
| P / Esc | Pause |
| R | Restart after busted or wasted |

## Run it

Serve the `game/` folder with any static file server and open `game/index.html` in desktop Chrome. The game is plain static files and makes no network requests.

```sh
npx serve game
```

Or with Python:

```sh
python3 -m http.server 8080 --directory game
```

Then open http://localhost:8080 in your browser and press Enter to play.

## Hand in

The entrypoint `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page that loads the game
- `game/src/main.js` — the game loop, screens and screenshot scenes
- `game/src/config.js` — tuning, palette and controls
- `game/src/random.js` — seeded random numbers
- `game/src/world.js` — city generation and collision
- `game/src/player.js` — Mari on foot and behind the wheel
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted level and pursuit
- `game/src/missions.js` — the three-chapter story
- `game/src/render.js` — the city, the cars, the HUD and the minimap
- `game/src/audio.js` — synthesized sound
- `game/src/input.js` — keyboard and mouse
- `game/src/save.js` — localStorage saves
- `main.ts` — the entry program that hands the game in
- `screenshots/` — real renders of the game running in a browser
