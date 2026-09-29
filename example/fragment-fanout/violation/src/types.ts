export type GateMode = 'off' | 'enforce';

export const DEFAULT_GATE_MODE: GateMode = 'off';

export function isValidGateMode(value: string): value is GateMode {
  return value === 'off' || value === 'enforce';
}

const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;

/**
 * This toy always calls writeGateFragment with hardcoded literals
 * ('payments'/'checkout'/'fulfillment', 'GATE_PAYMENTS_RETRY'), so nothing
 * here is exploitable as written. But `owner` becomes a path segment and
 * `gate` becomes an unescaped line in a written file, so a real system that
 * let either originate from anything less trusted (a tenant name, a plugin
 * id) would have a path-traversal / config-injection bug if it copied this
 * function without this check.
 */
export function assertSafeIdentifier(value: string, what: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`${what} must match ${SAFE_IDENTIFIER}, got: ${JSON.stringify(value)}`);
  }
}

export interface GateWrite {
  /** The team/workstream that owns this gate and writes its fragment. */
  owner: string;
  /** The gate name, e.g. GATE_PAYMENTS_RETRY. */
  gate: string;
  mode: GateMode;
}

export interface GateWriteResult extends GateWrite {
  fragmentPath: string;
}

export interface WriteSideCheckResult {
  allWritten: boolean;
  collisions: string[];
  missing: string[];
}
