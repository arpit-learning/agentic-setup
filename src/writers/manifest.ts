import fs from 'fs';
import crypto from 'crypto';
import { AGENTIC_DIR, MANIFEST_FILE } from '../constants.js';

export interface ManifestEntry {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  checksum: string;
  timestamp: string;
}

export interface Manifest {
  version: 1;
  backupDir?: string;
  entries: ManifestEntry[];
  cli_version?: string;
  setup_profile?: string;
  last_setup_at?: string;
}

export function readManifest(): Manifest | null {
  try {
    if (!fs.existsSync(MANIFEST_FILE)) return null;
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeManifest(manifest: Manifest) {
  if (!fs.existsSync(AGENTIC_DIR)) {
    fs.mkdirSync(AGENTIC_DIR, { recursive: true });
  }
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

export function fileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function updateSetupMetadata(meta: { cli_version?: string; setup_profile?: string }): void {
  const manifest = readManifest() ?? { version: 1 as const, entries: [] };
  writeManifest({
    ...manifest,
    cli_version: meta.cli_version ?? manifest.cli_version,
    setup_profile: meta.setup_profile ?? manifest.setup_profile,
    last_setup_at: new Date().toISOString(),
  });
}
