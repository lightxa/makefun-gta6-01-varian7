// main.ts — Solmar Bay entrypoint for make.fun gta6-01.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. It never deletes anything: the output directory
// is only created (mkdir -p style), so a previous run's files can never be
// wiped by this program. Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : '/output';

const MAX_SCREENSHOTS = 4;
const MIN_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 256 * 1024;

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

function listFilesSorted(dir: string): string[] {
  return readdirSync(dir).sort();
}

function copyTree(srcDir: string, dstDir: string): void {
  mkdirSync(dstDir, { recursive: true });
  for (const name of listFilesSorted(srcDir)) {
    const src = join(srcDir, name);
    const dst = join(dstDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      copyTree(src, dst);
    } else if (st.isFile()) {
      copyFileSync(src, dst);
    }
  }
}

function checkScreenshots(shotsDir: string): void {
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail('screenshots/ is missing: the entry needs 3 or 4 screenshots');
  }
  const names = listFilesSorted(shotsDir).filter((n) => !n.startsWith('.'));
  if (names.length < MIN_SCREENSHOTS || names.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${names.length} images, need ${MIN_SCREENSHOTS} to ${MAX_SCREENSHOTS}`);
  }
  for (const name of names) {
    const p = join(shotsDir, name);
    const st = statSync(p);
    if (!st.isFile()) fail(`screenshots/${name} is not a regular file`);
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) {
      fail(`screenshots/${name}: bad screenshot file name`);
    }
    if (st.size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${st.size} bytes, over the 256 KiB limit`);
    }
  }
}

function main(): void {
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail('game/ is missing: the playable game must live under game/');
  }
  checkScreenshots(shotsDir);

  // Create the output directory, never delete it or anything inside it.
  mkdirSync(OUT_DIR, { recursive: true });
  copyTree(gameDir, join(OUT_DIR, 'game'));
  copyTree(shotsDir, join(OUT_DIR, 'screenshots'));

  const dossier = buildDossier(OUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);
  console.log(`Solmar Bay entry written to ${OUT_DIR} (dossier.json ${dossier.length} bytes)`);
}

main();
