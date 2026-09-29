# Contributing

The rule is deliberately short. A proposed change needs one thing: a concrete case where a
reader was named, checked, and matched what was written, and the failure the rule is supposed to
catch happened anyway, stated as a scenario (the writers, the reader, what the audit found, what
still went wrong). Wording improvements that do not change what the rule catches are welcome as
plain PRs.

Do not add tooling, hooks, or enforcement scripts here. This repository is the rule; enforcement
is whatever your organization builds around it. The one exception is `example/`: a real, runnable
violation-and-fix pair that demonstrates the rule, with a `RUN-*.md` showing actual executed
output. An example illustrates the rule; it does not enforce it. It proves what the rule catches
without telling your organization how to catch it.
