// Velvet Vault packager: validates the static game bundle, stages it
// into the output folder in a stable order, and emits its dossier.

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const LIMIT_TEXT = 163840;
const LIMIT_SHOT_COUNT = 4;
const LIMIT_SHOT_BYTES = 262144;
const LIMIT_GAME_ENTRIES = 993;
const LIMIT_GAME_BYTES = 50331648;
const LIMIT_GAME_PATH = 1000;

type FoundFile = { rel: string; abs: string; size: number };
type Inventory = { files: FoundFile[]; folders: string[]; bytes: number; entries: number };

function abort(reason: string): never {
  throw new Error(`[velvet-vault] ${reason}`);
}

function utf8Size(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function scanTree(root: string, label: string): Inventory {
  if (!existsSync(root)) abort(`${label}: folder is missing at ${root}`);
  if (!lstatSync(root).isDirectory()) abort(`${label}: expected a directory at ${root}`);

  const files: FoundFile[] = [];
  const folders: string[] = [];

  const visit = (absDir: string, relDir: string): void => {
    const names = readdirSync(absDir, { withFileTypes: true })
      .slice()
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const item of names) {
      const rel = relDir === '' ? item.name : `${relDir}/${item.name}`;
      const abs = join(absDir, item.name);
      if (utf8Size(rel) > LIMIT_GAME_PATH && label === 'game') {
        abort(`game/${rel}: path needs ${utf8Size(rel)} bytes, limit is ${LIMIT_GAME_PATH}`);
      }
      const info = lstatSync(abs);
      if (info.isDirectory()) {
        folders.push(rel);
        visit(abs, rel);
      } else if (info.isFile()) {
        files.push({ rel, abs, size: info.size });
      } else {
        abort(`${label}/${rel}: links and special files are not allowed in the bundle`);
      }
    }
  };

  visit(root, '');
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  folders.sort();
  const bytes = files.reduce((sum, entry) => sum + entry.size, 0);
  return { files, folders, bytes, entries: files.length + folders.length };
}

function checkGame(inventory: Inventory, gameRoot: string): void {
  const entryPage = join(gameRoot, 'index.html');
  if (!existsSync(entryPage) || !lstatSync(entryPage).isFile()) {
    abort('game/index.html: required entry page was not found');
  }
  if (inventory.entries > LIMIT_GAME_ENTRIES) {
    abort(`game: ${inventory.entries} entries exceeds the ${LIMIT_GAME_ENTRIES} entry limit`);
  }
  if (inventory.bytes > LIMIT_GAME_BYTES) {
    abort(`game: ${inventory.bytes} bytes exceeds the ${LIMIT_GAME_BYTES} byte limit`);
  }
}

function checkShots(shotsRoot: string): FoundFile[] {
  if (!existsSync(shotsRoot)) return [];
  if (!lstatSync(shotsRoot).isDirectory()) abort(`screenshots: expected a directory at ${shotsRoot}`);
  const names = readdirSync(shotsRoot, { withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .sort();
  if (names.length > LIMIT_SHOT_COUNT) {
    abort(`screenshots: ${names.length} files exceeds the ${LIMIT_SHOT_COUNT} screenshot limit`);
  }
  const shots: FoundFile[] = [];
  for (const name of names) {
    const abs = join(shotsRoot, name);
    const size = lstatSync(abs).size;
    if (size > LIMIT_SHOT_BYTES) {
      abort(`screenshots/${name}: ${size} bytes exceeds the ${LIMIT_SHOT_BYTES} byte per-image limit`);
    }
    shots.push({ rel: name, abs, size });
  }
  return shots;
}

function stageTree(inventory: Inventory, destRoot: string): { count: number; bytes: number } {
  mkdirSync(destRoot, { recursive: true });
  for (const folder of inventory.folders) {
    mkdirSync(join(destRoot, ...folder.split('/')), { recursive: true });
  }
  let count = 0;
  let bytes = 0;
  for (const file of inventory.files) {
    const target = join(destRoot, ...file.rel.split('/'));
    mkdirSync(join(target, '..'), { recursive: true });
    copyFileSync(file.abs, target);
    count += 1;
    bytes += file.size;
  }
  return { count, bytes };
}

function stageShots(shots: FoundFile[], destRoot: string): { count: number; bytes: number } {
  mkdirSync(destRoot, { recursive: true });
  let count = 0;
  let bytes = 0;
  for (const shot of shots) {
    copyFileSync(shot.abs, join(destRoot, shot.rel));
    count += 1;
    bytes += shot.size;
  }
  return { count, bytes };
}

const baseDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSource = join(baseDir, 'game');
const shotsSource = join(baseDir, 'screenshots');

const gameInventory = scanTree(gameSource, 'game');
checkGame(gameInventory, gameSource);
const shotFiles = checkShots(shotsSource);

mkdirSync(outputDir, { recursive: true });
const gameStaged = stageTree(gameInventory, join(outputDir, 'game'));
const shotsStaged = stageShots(shotFiles, join(outputDir, 'screenshots'));

const dossierTarget = join(outputDir, 'dossier.json');
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(dossierTarget, dossierBytes);

const totalFiles = gameStaged.count + shotsStaged.count;
const totalBytes = gameStaged.bytes + shotsStaged.bytes;
console.log(`velvet-vault: copied ${totalFiles} files (${totalBytes} bytes) -> ${outputDir}; dossier at ${dossierTarget}`);
