[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lightxa/makefun-gta6-01-varian7/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lightxa/makefun-gta6-01-varian7/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — an open-world crime game

Solmar Bay is a top-down 2D open-world crime game that runs entirely in the browser from static files. You play Rico Vega, a driver back in his hometown with empty pockets and a fast reputation. Fixer Marisol Reyes has five jobs that pay real money, the Solmar Bay Police Department has five stars of patience, and every car on Palm Ave is a ride waiting to be borrowed.

## What you do

- **Explore a living city on foot and by car.** Five districts — Marina, Old Town, Downtown, Harbor and the Hills — connected by a road grid with traffic, pedestrians, parks, a beach and a plaza.
- **Steal cars and drive.** Walk up to any car, press E, and it is yours. Arcade driving with a handbrake, skid marks and collisions. Stealing a car raises your wanted level.
- **Run five story jobs.** First Wheels, Bayfront Pickup, Getaway Driver, Harbor Heist (a 90-second timed delivery) and King of the Bay (a final run under a full police chase). Each job pays cash and unlocks the next.
- **Outrun the police.** Wanted stars from 1 to 5 bring patrol cars and officers who chase, ram and try to arrest you. Lay low and the heat fades; get caught and you pay a fine at the hospital.
- **Fight, collect and earn on the side.** Punch with F, collect 20 hidden Bay coins, and take taxi fares from passengers waiting at Solmar Plaza.
- **Save and continue.** Progress (cash, jobs done, coins, taxi fares, position) saves to local storage automatically and can be continued from the start screen.

## Systems

- Wanted level with police pursuit, spawning and decay
- Traffic cars that follow lanes and turn at intersections, plus pedestrians who flee from trouble
- Mission engine with goto, steal, timed, lose-the-cops and survive steps
- HUD with cash, health, clock, wanted stars, speedometer and a live minimap showing the player, police and the job marker
- Synthesized sound: engine hum, two-tone sirens, effects and a bass loop, all made with WebAudio at runtime, no audio files
- Deterministic city generation from a fixed seed, so the same city builds every time

## Screenshots

The four images in `screenshots/` are real renders of this game running in desktop Chrome. Each was taken from a staged opening moment of the same game, selected with a `?shot=` URL parameter (`cover`, `street`, `mission`, `chase`): a downtown chase with two wanted stars and a job in progress, Rico on foot at the marina, the timed Harbor Heist delivery, and a four-star pursuit on Palm Ave.

## Controls

| Keys | Action |
| --- | --- |
| W A S D / arrows | Walk or drive |
| E | Steal / enter car, exit car, interact |
| Space | Handbrake |
| Shift | Sprint on foot |
| F | Punch |
| M | Mute sound |
| Esc / P | Pause |

## Run it

Serve the `game/` folder with any static file server and open `index.html` in desktop Chrome:

```sh
cd game
python3 -m http.server 8080
```

Then open http://localhost:8080 in the browser. No build step and no network requests: every script, style and sound is a file under `game/` or synthesized at runtime.

To build the entry output (copies `game/` and `screenshots/` and writes `dossier.json`), run the entrypoint from the repository root:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22 or later is required. The game itself needs only a modern desktop browser.

## Layout

- `game/index.html` — page, menus and HUD shell
- `game/src/main.js` — game loop, states and screenshot scene presets
- `game/src/world.js` — deterministic city generation
- `game/src/player.js` — on-foot movement and arcade driving
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted level, patrol cars and officers
- `game/src/missions.js` — the five story jobs and taxi fares
- `game/src/render.js` — city, entities, HUD and minimap drawing
- `game/src/audio.js` — synthesized WebAudio sound and music
- `game/src/input.js`, `game/src/save.js`, `game/src/random.js`, `game/src/config.js` — input, persistence, seeded randomness and tuning
- `main.ts` — entrypoint that assembles the submission output
- `screenshots/` — four real renders of the game running in a browser

## Originality

Solmar Bay, Rico Vega, Marisol Reyes, the SBPD and every district, vehicle, name and story beat are invented for this game. Nothing is taken from any commercial game.
