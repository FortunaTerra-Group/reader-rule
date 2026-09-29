# Reader Rule

**A control surface is only as split as its consumer.**

> Free standard, Apache-2.0. The rule, the audit obligation, and the corollary are in
> [`READER-RULE.md`](./READER-RULE.md); a real, runnable violation-and-fix pair is in
> [`example/fragment-fanout/`](./example/fragment-fanout/). Drop the rule into whatever file your
> coding agents read. The rest of this page is why it exists.

---

Three teams share one config file and keep colliding on it: two people edit it the same week,
one overwrites the other's line, and the postmortem says "merge conflict," which is true and also
not the interesting part. The interesting part is what happens next, because the fix that gets
proposed is almost always right about the wrong half of the problem.

The fix is: split the file into a fragment directory, one file per writer, composed at read time.
It works. Every collision disappears, because there is no longer a single file for two people to
edit at once. Every write-side check (did the fragment land, does it have the right shape, is
the writer's own log clean) goes green, because those checks were only ever asking about the
write. Nobody asked, before or after, what reads the fragments back. In the case this rule is
drawn from, the answer was: nothing. The code that resolves the setting at runtime had been
written against the old single file, months before the split, and nobody touched it during the
split because touching it wasn't part of "fix the collisions." It still is not part of "fix the
collisions," and that is exactly the trap. A collision is a write-side symptom; the reader is a
separate piece of code, and a fix scoped to the symptom has no reason to reach it.

So the fragments accumulate, correctly, forever. The write-side dashboard is green, correctly,
forever. And the live system behaves as if none of the writes ever happened, because the one
function that turns "files on disk" into "the value the program actually uses" was never told the
files moved.

## The rule

A control surface is only as split as its consumer. Fan-out on the write side requires fan-in on
the read side. If the live reader reads one file, writes must funnel through that file's
single owner. Full statement, the three-question audit obligation, and the corollary:
[`READER-RULE.md`](./READER-RULE.md).

## Why this is easy to miss

Splitting the write side produces a lot of legible, checkable progress: fewer merge conflicts,
a passing CI job, a metric that used to be red now reading green. Checking the reader produces
none of that on its own. It's a single `grep`, and if the answer is bad news, it's a `grep` that
makes the green dashboard a liability instead of an asset. Every incentive in a fast-moving change
points at finishing the visible half of the work and calling it done. The rule exists because the
invisible half is the one that decides whether any of it mattered.

## The example

[`example/fragment-fanout/`](./example/fragment-fanout/) is a small, runnable toy: three writer
modules that each own one fragment file, a write-side check that goes green, and a real bug where
the runtime reader never learned the fragments exist. `RUN-1-violation.md` shows the write-side
check passing while a test of the actual resolved value fails: the artifact is written, checked,
and decorative, all at once. `RUN-2-fixed.md` shows the same suite green after the reader is
wired to the fragments it was supposed to read all along. Both directories stay in the repository
side by side; either can be run on its own, any time.

## Provenance and license

This rule was first written down as a corollary inside
[CHOP](https://github.com/FortunaTerra-Group/chop), FortunaTerra's state-machine standard, after
a real incident matching the shape described above and in the example. It is broken out into its
own repository because it recurs outside state machines, wherever more than one thing writes a
shared config surface. Copyright 2026 FortunaTerra Technologies Inc. Written and maintained by
Vivek Iyer ([FortunaTerra-Group](https://github.com/FortunaTerra-Group)). Released under
[Apache-2.0](./LICENSE). Issues and pull requests are welcome; the bar for changing the rule is a
concrete case where a reader was checked and the rule still didn't catch the problem.
