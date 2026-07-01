// Synchronizes version numbers from the root package.json into the platform
// build configs (Android build.gradle + Electron package.json).
//
// Runs automatically via the `prebuild` npm hook before every `npm run build`,
// so versions can never drift from the single source of truth.
//
//   versionName  -> package.json version (e.g. "0.8.0")
//   versionCode  -> major * 10000 + minor * 100 + patch  (e.g. 0.8.0 -> 800)
//
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = rootPkg.version;

// Strip any pre-release suffix (e.g. "0.8.0-beta" -> "0.8.0")
const [major, minor, patch] = version.split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

// 1. Electron — update version in electron/package.json
const electronPkgPath = join(root, 'electron', 'package.json');
const electronPkg = JSON.parse(readFileSync(electronPkgPath, 'utf8'));
if (electronPkg.version !== version) {
  electronPkg.version = version;
  writeFileSync(electronPkgPath, JSON.stringify(electronPkg, null, 2) + '\n');
  console.log(`[sync-versions] electron/package.json -> ${version}`);
}

// 2. Android — update versionCode + versionName in build.gradle
const gradlePath = join(root, 'android', 'app', 'build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
const before = gradle;
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${version}"`);
if (gradle !== before) {
  writeFileSync(gradlePath, gradle);
  console.log(`[sync-versions] android build.gradle -> versionName "${version}", versionCode ${versionCode}`);
}

// Silent on no-op so a clean `npm run build` stays quiet.
