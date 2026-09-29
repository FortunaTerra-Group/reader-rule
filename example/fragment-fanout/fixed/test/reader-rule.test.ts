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

describe('Reader Rule fixed: the live resolver now reads the fragments it was split into', () => {
  let root: string;
  let fragmentsDir: string;
  let legacyFilePath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'reader-rule-fixed-'));
    fragmentsDir = join(root, 'feature-gates.d');
    legacyFilePath = join(root, 'feature-gates.env');
    // Same legacy file as the violation scenario: it predates the split and
    // still knows nothing about any of the three gates below.
    writeFileSync(legacyFilePath, '# feature gates: legacy single file\n');

    for (const write of WRITES) {
      writeGateFragment(fragmentsDir, write);
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('write-side KPI: every team\'s fragment landed, with zero collisions', () => {
    // Identical write side to the violation scenario: the split itself
    // was never the problem.
    const result = checkFragmentsWritten(fragmentsDir, WRITES);

    expect(result.allWritten).toBe(true);
    expect(result.collisions).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('FIXED: the live resolver now returns what the fragment actually says', () => {
    const mode = resolveGateMode(legacyFilePath, fragmentsDir, 'GATE_PAYMENTS_RETRY');

    expect(mode).toBe('enforce');
  });

  it('a gate no fragment mentions still falls back to the legacy file, then the default', () => {
    // Reader Rule fixes are not "always trust the fragments": they are
    // "read the form that was actually written." A team that never
    // migrated off the legacy file for some gate should keep working
    // exactly as before.
    writeFileSync(legacyFilePath, 'GATE_LEGACY_ONLY_FLAG=enforce\n');

    expect(resolveGateMode(legacyFilePath, fragmentsDir, 'GATE_LEGACY_ONLY_FLAG')).toBe('enforce');
    expect(resolveGateMode(legacyFilePath, fragmentsDir, 'GATE_NEVER_CONFIGURED')).toBe('off');
  });

  it('rejects an owner or gate that would escape the fragments directory or corrupt the file format', () => {
    // This toy always calls writeGateFragment with hardcoded literals, so the
    // real bug this catches is in a system that let 'owner' originate from
    // anything less trusted: a tenant name, a plugin id.
    expect(() => writeGateFragment(fragmentsDir, { owner: '../../etc/evil', gate: 'GATE_X', mode: 'enforce' }))
      .toThrow(/owner must match/);
    expect(() => writeGateFragment(fragmentsDir, { owner: 'payments', gate: 'GATE_X\nGATE_INJECTED=enforce', mode: 'enforce' }))
      .toThrow(/gate must match/);
  });

  it('falls back to the default instead of trusting a corrupted or tampered fragment value', () => {
    // A fragment written by something other than writeGateFragment (a manual
    // edit, a different producer) could contain anything after the '='. The
    // resolver must not blindly cast that string to GateMode.
    writeGateFragment(fragmentsDir, { owner: 'payments', gate: 'GATE_PAYMENTS_RETRY', mode: 'enforce' });
    writeFileSync(join(fragmentsDir, 'payments.env'), 'GATE_PAYMENTS_RETRY=maybe\n');

    expect(resolveGateMode(legacyFilePath, fragmentsDir, 'GATE_PAYMENTS_RETRY')).toBe('off');
  });
});
