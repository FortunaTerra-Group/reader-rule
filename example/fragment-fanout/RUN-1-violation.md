# RUN 1: the violation, executed

Command:

```
npx vitest run violation
```

Working directory shown below as `<repo-root>/example/fragment-fanout`; that prefix is the only
thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/fragment-fanout

 ❯ violation/test/reader-rule.test.ts (2 tests | 1 failed) 10ms
   ✓ Reader Rule violation: fragments split off a legacy file the reader still consumes alone > write-side KPI: every team's fragment landed, with zero collisions 3ms
   × Reader Rule violation: fragments split off a legacy file the reader still consumes alone > BUG: the live resolver still returns the fallback default, ignoring every fragment 6ms
     → expected 'off' to be 'enforce' // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  violation/test/reader-rule.test.ts > Reader Rule violation: fragments split off a legacy file the reader still consumes alone > BUG: the live resolver still returns the fallback default, ignoring every fragment
AssertionError: expected 'off' to be 'enforce' // Object.is equality

Expected: "enforce"
Received: "off"

 ❯ violation/test/reader-rule.test.ts:55:18
     53|     const mode = resolveGateMode(legacyFilePath, 'GATE_PAYMENTS_RETRY'…
     54| 
     55|     expect(mode).toBe('enforce');
       |                  ^
     56|   });
     57| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  22:50:44
   Duration  242ms (transform 48ms, setup 0ms, collect 46ms, tests 10ms, environment 0ms, prepare 60ms)
```

Read the two results together, not separately:

- **The first test passes.** [`checkFragmentsWritten`](./violation/src/write-side-kpi.ts) confirms
  all three teams' fragments landed in `feature-gates.d/`, each with the right content, with zero
  collisions between owners. If this were the only check anyone ran (the write-side KPI in a CI
  job, say), the split would be reported a clean success.
- **The second test fails.** [`resolveGateMode`](./violation/src/gate-reader.ts) is the function
  the deploy tool actually calls to decide whether `GATE_PAYMENTS_RETRY` is on. The payments team
  wrote `enforce` to their fragment one test-setup step earlier, in the same `beforeEach` the first
  test also ran against. The resolver still returns `off`, because it only ever reads
  `feature-gates.env`, the single legacy file the fragments were split out of, and that file has
  never heard of `GATE_PAYMENTS_RETRY`.

Nothing here throws, logs a warning, or fails loudly on its own. Both facts are true at once: the
write succeeded exactly as designed, and the value a running system would actually use never
moved. That gap, a green write-side check next to a live value that silently never changes, is
what the Reader Rule is written to catch before it ships, not after.
