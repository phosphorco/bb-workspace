# BB React performance program

This directory records the August 2026 multi-agent investigation into BB's
React rendering performance and the reviewed execution program derived from
it.

Start with [react-performance-program.md](react-performance-program.md). It
contains the consolidated findings, evidence limitations, work tracks,
dependency order, reactivity decision gate, budgets, and final integration
checks.

Supporting investigations:

- [Thread Progress sidebar and temporal reactivity](react-performance-contrib-sidebar.md)
- [Populated-thread navigation and overlay architecture](react-performance-contrib-thread.md)
- [Measurement, verification, and integration](react-performance-contrib-integration.md)
- [Adversarial review and corrected verdict](react-performance-review.md)

The reusable implementation and review guidance lives in the project skill at
[`.agents/skills/bb-performant-react/SKILL.md`](../../.agents/skills/bb-performant-react/SKILL.md).

The historical React Scan numbers prioritize reproduction; they are not an
auditable baseline because the original raw exports and manifests were not
retained. Product implementation remains gated on E0 evidence reproduction and
the isolated A0 TanStack Store versus effect-atom ADR described by the program.
