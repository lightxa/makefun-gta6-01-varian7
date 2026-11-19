// SOLMAR BAY — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to the output directory and writes
// dossier.json with the vendored make.fun library.
//
// The output directory is /output by default, or MAKEFUN_OUTPUT_DIR
// outside the grader. This program never deletes the output directory:
// it only creates it (recursively) and copies files into it, so a file
// that was already there survives the run untouched.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory if it is missing. Never remove anything
// that is already inside it.
mkdirSync(out, { recursive: true });

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(gameDir)) throw new Error('missing game/ directory beside main.ts');
if (!existsSync(shotsDir)) throw new Error('missing screenshots/ directory beside main.ts');

// Copy the whole game in. cpSync into an existing directory merges
// without deleting other entries, which keeps the run deterministic
// and safe for the grader's pre-seeded output directory.
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// Refuse an entry the scorer would refuse, before writing the dossier:
// at most 4 screenshots, each at most 256 KiB, and a game/ within its
// file and byte caps. These are hard checks, not warnings.
const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const name of shots) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > 262144) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
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

console.log(`Solmar Bay handed in: ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
