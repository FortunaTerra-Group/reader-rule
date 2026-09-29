# The Reader Rule

**Version 1.0 · Apache-2.0 · Copyright 2026 FortunaTerra Technologies Inc.**

A control surface is only as split as its consumer. Fan-out on the write side requires fan-in
on the read side. If the live reader reads one file, writes must funnel through that
file's single owner.

This rule applies to any registry, allowlist, manifest, feature-flag store, gate-mode file,
schema index, or other config surface written by more than one producer.

## The failure

Several independent writers collide on one shared file. The fix looks obvious: split the file
into a fragment directory, one fragment per writer, composed at read time. Every write-side
collision vanishes. Every write-side check goes green.

Then someone reads the code that actually consumes the file at runtime, and it still joins the
single legacy file the fragments were split from, falling back to a default when that file is
absent or silent on the field in question. The fragments have zero readers. A writer can set the
real value in its own fragment, the write-side log will count the change, the write-side metric
will go green, and the live consumer will resolve the fallback forever, silently, because
nothing anywhere throws, logs a mismatch, or fails a check. The bug is not that the write failed;
the write succeeded exactly as designed. The bug is that nothing was ever listening on that side.

## The audit obligation

Before splitting a shared config surface, not after the write-side gate goes green, answer
three questions, and record the command that answered each one:

1. **Who reads it?** Name the consumer file and line. Grep the code that actually runs at
   runtime. "The validator composes it" is a claim; a `grep` result pointing at the composing
   call site is evidence.
2. **Does the reader read the form you write?** A consumer that opens `x.env` does not read
   `x.d/*.env`, and a consumer that globs `x.d/*.env` does not read a lone `x.env`. The two
   forms are not interchangeable just because a human would recognize both as "the config."
3. **No reader means the artifact is decorative.** If nothing reads what you're about to write,
   any KPI or test asserting that the write happened is a proxy with no predicate: it can only
   ever tell you the write occurred, never that it mattered. Ship the consumer change in the same
   unit of work as the split, with a declared writer, or don't do the split.
4. **Is there a test that fails if the reader and the writer's form drift apart again?** The
   first three questions are a point-in-time check. Answering them once and moving on leaves the
   door open for a later refactor of the reader, or a format change on the writer side, to
   silently reopen the exact gap the audit just closed. A test that asserts the *resolved runtime
   value*, not just that a write happened, is what keeps question 1 through 3's answer true after
   the PR that asked them merges.

## The corollary

Where the reader is single-file, the writer must be single-owner, unless the writes themselves are
safely concurrent by construction (an append under `O_APPEND`, an advisory lock, a transactional
row in a database) rather than merely uncoordinated. Outside that carve-out, no architecture
removes the constraint; splitting the write surface only relocates the contention into a file
nobody opens. Either one owner holds the file and everyone else requests through it, or you ship
the consumer change alongside the split, with that consumer named and covered by a test that
fails if the two drift apart.

## How to adopt it

1. Before proposing "split file X into fragments" as a fix for writer contention, find and name
   X's actual reader first. If you cannot point at the line that consumes X, you cannot yet claim
   the split is safe.
2. Write the consumer-reads-the-new-form test before the fragment-writer tests. A green
   write-side suite with no such test is not evidence the split works.
3. When the reader is genuinely one file with one intended writer, keep it that way. A registry
   with one true reader is a correctly-scoped registry, not an anti-pattern waiting to be split.
4. In review, treat "we split the writers" and "we verified the reader" as two separate claims.
   The first is easy to demonstrate and does not imply the second.

## What this is not

The Reader Rule does not forbid fragment directories, composed configs, or multi-writer surfaces
in general. Plenty of well-designed systems compose config from many small files on purpose. It
forbids shipping that split without checking, and updating if necessary, the one thing that makes
the split meaningful: the code path an already-running system actually reads from.

This rule was first written down as a corollary inside
[CHOP](https://github.com/FortunaTerra-Group/chop)'s state-machine rules (it shares CHOP's
concerns about single ownership and no multiple masters). It gets its own repository here because
the failure it names is common enough, and expensive enough, to need its own worked example: see
[`example/fragment-fanout/`](./example/fragment-fanout/).
