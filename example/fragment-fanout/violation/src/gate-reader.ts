import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_GATE_MODE, GateMode, isValidGateMode } from './types';

/**
 * VIOLATION (Reader Rule): this is the live resolver the deploy tool
 * actually calls at runtime. It was written against the single legacy file
 * the fragments in fragment-writer.ts were split FROM, and nobody updated
 * it when the split shipped. It has no idea the fragments directory exists.
 *
 * Nothing here throws or logs an error. It faithfully returns the
 * fallback default every time the legacy file is silent on the gate, which
 * after the split is always, for every gate every team writes.
 */
export function resolveGateMode(legacyFilePath: string, gate: string): GateMode {
  if (!existsSync(legacyFilePath)) {
    return DEFAULT_GATE_MODE;
  }
  const line = readFileSync(legacyFilePath, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${gate}=`));
  if (!line) {
    return DEFAULT_GATE_MODE;
  }
  const value = line.split('=')[1]?.trim();
  return value !== undefined && isValidGateMode(value) ? value : DEFAULT_GATE_MODE;
}
