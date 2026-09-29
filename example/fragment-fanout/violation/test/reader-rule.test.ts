import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkFragmentsWritten } from '../src/write-side-kpi';
import { resolveGateMode } from '../src/gate-reader';
import { writeGateFragment } from '../src/fragment-writer';
import { GateWrite } from '../src/types';

const WRITES: GateWrite[] = [
  { owner: 'payments', gate: 'GATE_PAYMENTS_RETRY', mode: 'enforce' },
  { owner: 'checkout', gate: 'GATE_CHECKOUT_STOCK_HOLD', mode: 'enforce' },
  { owner: 'fulfillment', gate: 'GATE_FULFILLMENT_LABEL_V2', mode: 'enforce' },
];

describe('Reader Rule violation: fragments split off a legacy file the reader still consumes alone', () => {
  let root: string;
  let fragmentsDir: string;
  let legacyFilePath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'reader-rule-violation-'));
    fragmentsDir = join(root, 'feature-gates.d');
    legacyFilePath = join(root, 'feature-gates.env');
    // The legacy file predates the fragment split. Nobody deleted it, and
    // nothing ever wrote the new gates into it: that was the whole point
    // of splitting them out into fragments instead.
    writeFileSync(legacyFilePath, '# feature gates: legacy single file\n');

    for (const write of WRITES) {
      writeGateFragment(fragmentsDir, write);
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('write-side KPI: every team\'s fragment landed, with zero collisions', () => {
    const result = checkFragmentsWritten(fragmentsDir, WRITES);

    expect(result.allWritten).toBe(true);
    expect(result.collisions).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('BUG: the live resolver still returns the fallback default, ignoring every fragment', () => {
    // The payments team wrote 'enforce' to their own fragment above, and the
    // KPI test right above this one is green about it. But resolveGateMode
    // is the function the deploy tool actually calls at runtime, and it
    // only ever reads legacyFilePath: it has no fragmentsDir parameter at
    // all. So the value it resolves is silently wrong, forever.
    const mode = resolveGateMode(legacyFilePath, 'GATE_PAYMENTS_RETRY');

    expect(mode).toBe('enforce');
  });
});
