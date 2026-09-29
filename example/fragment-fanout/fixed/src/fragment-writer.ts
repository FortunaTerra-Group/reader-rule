import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertSafeIdentifier, GateWrite, GateWriteResult } from './types';

/**
 * The textbook fix for writer collisions: one fragment file per owning team,
 * composed at read time (in theory). Three teams can each call this at the
 * same time and never touch the same file, so the write side has zero
 * collisions by construction.
 */
export function writeGateFragment(fragmentsDir: string, write: GateWrite): GateWriteResult {
  assertSafeIdentifier(write.owner, 'owner');
  assertSafeIdentifier(write.gate, 'gate');
  mkdirSync(fragmentsDir, { recursive: true });
  const fragmentPath = join(fragmentsDir, `${write.owner}.env`);
  writeFileSync(fragmentPath, `${write.gate}=${write.mode}\n`);
  return { ...write, fragmentPath };
}
