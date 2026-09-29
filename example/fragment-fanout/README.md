# Example: fragment fan-out with no reader (the Reader Rule)

A small, runnable feature-gate scenario showing what the Reader Rule catches, rather than just
describing it in prose.

> The code, the bug, and both test runs below are real and were actually executed.
> Model: Claude Sonnet 5. Date: 2026-09-28.

## The scenario

Three independent teams (payments, checkout, fulfillment) each own one feature gate that
controls whether a risky code path runs in `enforce` or stays `off`. All three gates used to live
in one shared file, `feature-gates.env`, and all three teams kept colliding on it: two people
editing the file in the same release window, one overwriting the other's line.

The fix that shipped: split the shared file into a fragment directory, `feature-gates.d/`, one
file per owning team, composed at read time. [`fragment-writer.ts`](./violation/src/fragment-writer.ts)
is that fix. Each team calls `writeGateFragment` and writes only its own file, so three teams
writing at once can never collide; the function also rejects an `owner` or `gate` shaped like a
path-traversal or file-injection attempt, since this repo exists specifically to be copied into
other agents' context and the check needs to travel with the pattern, not just the lesson.
[`write-side-kpi.ts`](./violation/src/write-side-kpi.ts) is the
write-side check that came with the fix: did every team's fragment land, with the right content,
and with zero collisions? That check goes green, correctly, because the write side really was
fixed.

[`violation/src/gate-reader.ts`](./violation/src/gate-reader.ts) is the live resolver the deploy
tool actually calls at runtime to decide whether a gate is on. It was written against the single
legacy file, before the fragment split existed, and nobody touched it when the split shipped.
Updating the reader was never part of "fix the write collisions." It still only reads
`feature-gates.env`. After the split, that file never gets written to again, so the resolver
always falls through to its `off` default, for every gate, forever, while the write-side KPI
keeps reporting a clean bill of health, because it was never asking about the reader at all.

[`fixed/src/gate-reader.ts`](./fixed/src/gate-reader.ts) is the same function with the missing
half: it checks `feature-gates.d/` first, the form the writers actually produce, and only falls
back to the legacy file for a gate no fragment has ever mentioned, so a team that never migrated
off the old file keeps working exactly as before.

This is an original toy scenario built to demonstrate the failure class the Reader Rule names:
fan-out on the write side with no fan-in on the read side, not a transcription of any one
company's incident.

## Which artifact this demonstrates

The [Reader Rule](../../READER-RULE.md): a control surface is only as split as its consumer.
`checkFragmentsWritten` proves the write side is healthy; it says nothing about whether anything
downstream is listening. `resolveGateMode` is the actual consumer, and until it is updated to
match the form being written, every fragment ever written is decorative. The write-side KPI has
no way to tell the difference between "the reader composes this" and "nothing reads this at all."

## Running it

```sh
cd example/fragment-fanout
npm install
npm run test:violation   # RUN 1: the bug, reproduced
npm run test:fixed       # RUN 2: the fix, verified
npm test                 # both suites together
```

## What each run shows

- [`RUN-1-violation.md`](./RUN-1-violation.md): the write-side KPI test passes (every fragment
  landed, zero collisions) in the same test file where a second test, reading the value the live
  resolver actually returns, fails. Source: [`violation/src/fragment-writer.ts`](./violation/src/fragment-writer.ts),
  [`violation/src/write-side-kpi.ts`](./violation/src/write-side-kpi.ts),
  [`violation/src/gate-reader.ts`](./violation/src/gate-reader.ts), test at
  [`violation/test/reader-rule.test.ts`](./violation/test/reader-rule.test.ts).
- [`RUN-2-fixed.md`](./RUN-2-fixed.md): the identical write-side KPI test still passes (the write
  side was never the problem) and the resolver test now passes too, because the reader was wired
  to the fragments. A third test confirms the legacy-file fallback still works for a gate that was
  never migrated; two more confirm `writeGateFragment` rejects an unsafe `owner`/`gate`, and that
  the resolver falls back to the default rather than trusting a corrupted fragment value. Source:
  [`fixed/src/gate-reader.ts`](./fixed/src/gate-reader.ts) (the only file that changed in the
  resolving logic between `violation/` and `fixed/`), test at
  [`fixed/test/reader-rule.test.ts`](./fixed/test/reader-rule.test.ts).

Both `violation/` and `fixed/` stay in the repository side by side, on purpose: either one can be
run on its own at any time, so the violation is not just a claim about code that used to exist, it
is code you can still run and watch fail the same way today.
