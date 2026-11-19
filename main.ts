// Solmar Bay entry program for the make.fun gta6-01 bounty (Node 22, stdlib only).
// It hands the game in: it copies game/ and screenshots/ from beside this file into
// the output directory and writes /output/dossier.json with the vendored make.fun
// library. It never deletes anything: it only creates the output directory (or
// reuses the one that is already there) and overwrites the files it hands in.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory if it is missing; never remove it or its contents.
mkdirSync(out, { recursive: true });

// Copy the whole game directory into the output directory. Fail early with a
// clear message when the game page is missing instead of handing in a dossier
// the scorer would refuse.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html: no such file: the game is a directory of static files, its index.html at its root');
}
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// Copy the screenshots the maker took of the game running in a browser.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Refuse to hand in an entry with the wrong number of screenshots: the gate
// wants 3 or 4, each at most 256 KiB, and a missing or oversized shot would be
// refused later instead of failing loudly here.
const shots = readdirSync(join(out, 'screenshots'))
  .filter((name) => !name.startsWith('.'))
  .sort();
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots: expected 3 or 4 images, found ${shots.length}`);
}
for (const name of shots) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > 262144) throw new Error(`screenshots/${name}: ${size} bytes, over the 256 KiB cap`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
