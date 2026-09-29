import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GateWrite, WriteSideCheckResult } from './types';

/**
 * The write-side KPI: did every team's fragment land, with the right
 * content, and with no two teams colliding on the same file? This is the
 * check that goes green in the failure class this toy generalizes, and it
 * is answering a real question. It is just not the question that decides
 * what the running system does.
 */
export function checkFragmentsWritten(fragmentsDir: string, expected: GateWrite[]): WriteSideCheckResult {
  const missing: string[] = [];
  const seenPaths = new Map<string, string>();
  const collisions: string[] = [];

  for (const write of expected) {
    const fragmentPath = join(fragmentsDir, `${write.owner}.env`);
    if (!existsSync(fragmentPath)) {
      missing.push(fragmentPath);
      continue;
    }
    const contents = readFileSync(fragmentPath, 'utf8');
    if (!contents.includes(`${write.gate}=${write.mode}`)) {
      missing.push(fragmentPath);
      continue;
    }
    const priorOwner = seenPaths.get(fragmentPath);
    if (priorOwner && priorOwner !== write.owner) {
      collisions.push(fragmentPath);
    }
    seenPaths.set(fragmentPath, write.owner);
  }

  return { allWritten: missing.length === 0, collisions, missing };
}
