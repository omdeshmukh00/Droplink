import path from 'path';

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Sanitizes uploaded filename to prevent path traversal, null byte injections,
 * Windows device collisions, and control character exploits.
 */
export function sanitizeFilename(inputFilename: string): string {
  if (!inputFilename || typeof inputFilename !== 'string') {
    return 'unnamed_file';
  }

  // 1. Strip null bytes and control characters
  let clean = inputFilename.replace(/[\x00-\x1F\x7F]/g, '');

  // 2. Strip directory path separators and traversal indicators
  clean = path.basename(clean).replace(/\.\.[\/\\]/g, '');

  // 3. Remove leading/trailing dots and spaces
  clean = clean.trim().replace(/^\.+/, '').replace(/\.+$|\s+$/g, '');

  if (!clean) {
    return 'unnamed_file';
  }

  // 4. Handle Windows reserved device names (e.g., CON.txt -> safe_CON.txt)
  if (WINDOWS_RESERVED_NAMES.test(clean)) {
    clean = `safe_${clean}`;
  }

  // 5. Truncate long filenames to 255 chars preserving extension
  if (clean.length > 255) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext).slice(0, 250 - ext.length);
    clean = `${base}${ext}`;
  }

  return clean;
}
