import fs from 'fs';
import path from 'path';
import { BACKUPS_DIR } from '../constants.js';

export function createBackup(files: string[]): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUPS_DIR, timestamp);

  for (const file of files) {
    if (!fs.existsSync(file)) continue;

    const dest = path.join(backupDir, file);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(file, dest);
  }

  return backupDir;
}

export function restoreBackup(backupDir: string, file: string): boolean {
  const backupFile = path.join(backupDir, file);
  if (!fs.existsSync(backupFile)) return false;

  const destDir = path.dirname(file);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(backupFile, file);
  return true;
}
