# RUN 2: the fix, executed

Command:

```
npx vitest run fixed --reporter=verbose
```

Working directory shown below as `<repo-root>/example/fragment-fanout`; that prefix is the only
thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/fragment-fanout

 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > write-side KPI: every team's fragment landed, with zero collisions 3ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > FIXED: the live resolver now returns what the fragment actually says 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > a gate no fragment mentions still falls back to the legacy file, then the default 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > rejects an owner or gate that would escape the fragments directory or corrupt the file format 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > falls back to the default instead of trusting a corrupted or tampered fragment value 1ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  23:16:54
   Duration  234ms (transform 45ms, setup 0ms, collect 40ms, tests 8ms, environment 0ms, prepare 80ms)
```

[`fixed/src/gate-reader.ts`](./fixed/src/gate-reader.ts) is the only file that differs in its
*resolving* logic between `violation/` and `fixed/`. The writers, the fragment format, and the
write-side KPI check are the same code in both, because the write side was never where the bug
lived. The fixed resolver now checks `feature-gates.d/` (the form the writers actually produce)
before it ever looks at the legacy file, and only falls back to `feature-gates.env`, then to the
`off` default, for a gate no fragment mentions.

After an independent review of the first version of this example, `fragment-writer.ts` and
`types.ts` (shared by both `violation/` and `fixed/`, still byte-for-byte identical between the
two) gained input validation: `writeGateFragment` now rejects an `owner` or `gate` that would
turn into a path-traversal or a corrupted fragment line, and `gate-reader.ts` in both variants
now validates a parsed mode against `GateMode` instead of blindly casting the string. Neither
change affects the Reader Rule's own point (the write side already worked); both exist because
this repo's whole purpose is to be copied into other agents' context, and the original version's
lack of input validation would have been copied along with the lesson.

[`fixed/test/reader-rule.test.ts`](./fixed/test/reader-rule.test.ts) replays the identical scenario
from RUN 1, plus three more cases:

- The write-side KPI test still passes, unchanged, confirming the fix did not touch, and did not
  need to touch, the part that already worked.
- The resolver test now passes: `resolveGateMode` for `GATE_PAYMENTS_RETRY` returns `enforce`, the
  value the payments team actually wrote, instead of RUN 1's silent `off`.
- A third test confirms the fallback still works for a gate that was never migrated to a fragment
  at all: writing `GATE_LEGACY_ONLY_FLAG=enforce` straight into `feature-gates.env` (no fragment)
  still resolves to `enforce`, and a gate present in neither the fragments nor the legacy file
  still resolves to the `off` default. The fix is "check the fragments first," not "ignore the
  legacy file," and a partial migration keeps working exactly as before.
- A fourth test confirms `writeGateFragment` rejects an `owner` shaped like a path-traversal
  attempt (`../../etc/evil`) or a `gate` containing a newline that could inject a second, forged
  line into the fragment file, instead of writing either one.
- A fifth test confirms the resolver falls back to the default rather than trusting a fragment
  file whose value doesn't match `GateMode` (a manual edit, a different producer writing garbage
  after the `=`), instead of returning that garbage string as if it were a real mode.

Before writing this file, the fragment-lookup branch inside `resolveGateMode` was deliberately
disabled (`if (false && existsSync(fragmentsDir))`) and the suite rerun:

```
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > write-side KPI: every team's fragment landed, with zero collisions 3ms
 × fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > FIXED: the live resolver now returns what the fragment actually says 6ms
   → expected 'off' to be 'enforce' // Object.is equality
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > a gate no fragment mentions still falls back to the legacy file, then the default 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > rejects an owner or gate that would escape the fragments directory or corrupt the file format 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > falls back to the default instead of trusting a corrupted or tampered fragment value 1ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

Exactly one test goes red: the one that actually exercises the fragment path. The other four stay
green for the right reason, not because they missed the bug: the write-side KPI, the legacy-fallback
case, and the two new validation tests never touch `fragmentsDir` lookup at all, so disabling that
branch cannot affect them. The resolver test failed with the exact same `expected 'off' to be
'enforce'` RUN 1 shows, confirming that assertion is load-bearing and not a tautology: it can only
pass when the resolver genuinely reads the fragment. The branch was then restored and the full
suite (`npx vitest run`, both `violation/` and `fixed/`) rerun green before this file and
[`RUN-1-violation.md`](./RUN-1-violation.md) were finalized:

```
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > write-side KPI: every team's fragment landed, with zero collisions 3ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > FIXED: the live resolver now returns what the fragment actually says 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > a gate no fragment mentions still falls back to the legacy file, then the default 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > rejects an owner or gate that would escape the fragments directory or corrupt the file format 1ms
 ✓ fixed/test/reader-rule.test.ts > Reader Rule fixed: the live resolver now reads the fragments it was split into > falls back to the default instead of trusting a corrupted or tampered fragment value 1ms
 ✓ violation/test/reader-rule.test.ts > Reader Rule violation: fragments split off a legacy file the reader still consumes alone > write-side KPI: every team's fragment landed, with zero collisions 3ms
 × violation/test/reader-rule.test.ts > Reader Rule violation: fragments split off a legacy file the reader still consumes alone > BUG: the live resolver still returns the fallback default, ignoring every fragment 6ms
   → expected 'off' to be 'enforce' // Object.is equality

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 6 passed (7)
```

`violation/` still fails the same way it always did and `fixed/` is fully green, run side by side
in one invocation. The two states coexist in the repository on purpose, the same way they do in
`chop`'s own `example/multiple-masters/`.
