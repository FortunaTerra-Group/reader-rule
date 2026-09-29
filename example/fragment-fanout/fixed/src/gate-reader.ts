import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_GATE_MODE, GateMode, isValidGateMode } from './types';

function readGateFromFile(filePath: string, gate: string): GateMode | undefined {
  const line = readFileSync(filePath, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${gate}=`));
  if (!line) return undefined;
  const value = line.split('=')[1]?.trim();
  return value !== undefined && isValidGateMode(value) ? value : undefined;
}

/**
 * FIXED (Reader Rule): this is the same live resolver the deploy tool
 * calls at runtime, now wired to the fragments it was supposed to read all
 * along. It checks fragmentsDir first (the form the writers actually
 * produce) and only falls back to the legacy single file for a gate no
 * fragment has ever mentioned, which keeps a bare `feature-gates.env` with
 * no split at all working exactly as before.
 */
export function resolveGateMode(legacyFilePath: string, fragmentsDir: string, gate: string): GateMode {
  if (existsSync(fragmentsDir)) {
    for (const fragment of readdirSync(fragmentsDir)) {
      const mode = readGateFromFile(join(fragmentsDir, fragment), gate);
      if (mode) {
        return mode;
      }
    }
  }

  if (existsSync(legacyFilePath)) {
    const mode = readGateFromFile(legacyFilePath, gate);
    if (mode) {
      return mode;
    }
  }

  return DEFAULT_GATE_MODE;
}
