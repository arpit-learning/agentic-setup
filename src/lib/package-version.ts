import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PACKAGE_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'package.json',
);

let cachedVersion: string | undefined;

export function getPackageVersion(): string {
  if (!cachedVersion) {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as { version: string };
    cachedVersion = pkg.version;
  }
  return cachedVersion;
}
