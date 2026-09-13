# Plan merge-train decisions

Use one graph spine for the train. Treat land-now and land-correctly as
revisable decision postures, not branches that activate different procedures.
The graph should expose work, consequential decisions, and invariant witnesses;
it should not certify adherence to a posture.

For a short train with one operator, keep the graph compact rather than
expanding every GitHub command into a node. Retain its sibling ledger when
revising the definition.

## Record posture at the right level

Normally record the current posture and rationale in the train journal or the
segment assessment. Do not make every candidate, verifier, or probe depend on a
`mode` ruling.

Use a Workbench `Selector` only when the release owner must make a real choice,
such as:

- changing the promised outcome or train scope;
- accepting a newly introduced issue for follow-up;
- consolidating coupled layers into a different publication unit;
- granting publication, rewrite, or bypass authority; or
- making a particular release posture part of the commitment.

If the request already answers the question, record the instruction and avoid a
ceremonial Selector. If a later owner choice changes the graph, preserve the
earlier ruling and revise the same definition; a ruled Selector does not
activate a conditional Pkl branch by itself.

## Start with cheap discovery

Replace the inventory path and oracle with the repository's real contract.

```pkl
amends "workbench:plan"

meta {
  title = "Prepare a stacked merge train"
  goal = "Land useful, usable stack segments with evidence proportional to their risk and recovery cost."
}

local inventory = new Action {
  id = "train-inventory"
  owner = "merge-orchestrator"
  outcome = "Record PR order, bases, heads, merge method, repository rules, composition boundaries, and dirty paths."
  grant { "plans/train/inventory.json" }
  oracle = module.mechanical("jq -e '.status == \"pass\"' plans/train/inventory.json")
}

nodes { inventory }
```

Discovery may run beside reversible candidate construction when the write
footprints are known and disjoint. Do not make broad review cleanup precede
facts needed for an actual publication decision.

## Use one rolling graph

Separate artifact availability from acceptance. A builder may consume a
produced predecessor while verification and remote-policy discovery proceed in
parallel. Landing consumes both the segment judgment and the invariant
witnesses.

```text
inventory ─┬→ remote-policy/capability probe ────────────┐
           ├→ landing-procedure dry run ─────────────────┤
           ├→ layer 1 produced → layer 2 → … ────────────┤
           │       └→ verify 1  └→ verify 2 …             ├→ segment assessment
           └→ bounded probes / proposed follow-ups ──────┘          │
                                         usability witness ─────────┤
                                           invariant gates ─────────┤
                                            exact authority ────────┤
                                                                    ▼
                                                        land guarded segment
                                                                    │
suffix construction and verification ─→ next assessment ───────────┘
```

The essential dependencies look like this. The excerpt assumes §layer1§,
§layer3§, and §prefixWitness§ are defined elsewhere in the plan.

```pkl
local layer2 = new Action {
  id = "candidate-layer-2"
  owner = "stack-builder"
  outcome = "Produce layer 2 from the produced layer-1 candidate."
  grant { "refs/train/candidate/2"; "plans/train/certificates/layer-2.json" }
  needs { module.produced(layer1) }
  oracle = module.mechanical("bash plans/train/check-transition.sh 2")
}

local segmentAssessment = new Guard {
  id = "assess-prefix-0-3"
  owner = "merge-operator"
  outcome = "Decide whether publishing prefix 0-3 is preferable to waiting for more evidence or scope closure."
  observes { "plans/train/assessment-0-3.json" }
  needs {
    module.verified(layer1)
    module.verified(layer2)
    module.verified(layer3)
    module.verified(prefixWitness)
  }
  oracle = module.adjudicated("The assessment names any downstream consumer and delay avoided, bounds residual uncertainty, records coupling and intermediate usability, evaluates blast radius and recovery difficulty, identifies deferrals, and says what would trigger reassessment.", "merge-operator")
}

local authorityScope = new Guard {
  id = "publication-authority-prefix-0-3"
  owner = "release-owner"
  outcome = "Confirm the owner's exact, current publication grant for prefix 0-3."
  observes { "plans/train/authority-0-3.json" }
  needs { module.verified(segmentAssessment) }
  oracle = module.adjudicated("The owner instruction and scope manifest agree on repository, target, PR range, heads, actor, merge method, permitted rewrites, bypass scope, and single-use or expiry bound.", "release-owner")
}

local landSegment = new Action {
  id = "land-prefix-0-3"
  owner = "merge-operator"
  outcome = "Publish and merge the assessed, usable prefix through layer 3."
  grant { "github/org/repo/main/prefix-0-3"; "plans/train/landing-journal.json" }
  needs {
    module.produced(layer1); module.verified(layer1)
    module.produced(layer2); module.verified(layer2)
    module.produced(layer3); module.verified(layer3)
    module.verified(prefixWitness)
    module.verified(segmentAssessment)
    module.verified(authorityScope)
  }
  oracle = module.mechanical("jq -e '.segments[\"0-3\"].status == \"complete\" and all(.segments[\"0-3\"].pullRequests[]; .treeVerified == true)' plans/train/landing-journal.json")
}
```

Use mechanical oracles for invariant facts and an adjudicated Guard for the
operator's tradeoff judgment. The assessment is deliberately short: it should
contain only facts capable of changing whether the segment lands. Do not add a
numeric score, mandatory essay, or duplicated status model.

Use one landing Action when the same operator, exact authorization, and stop
policy govern the segment. The journal records each PR's remote-truth
checkpoint; the Pkl graph need not expand one guarded operation into
ready/retarget/merge nodes. Keep `prepared`, `published`, `merge-requested`,
`remotely-merged`, and `tree-verified` distinct so recovery reconciles remote
truth before retrying.

`adjudicate --by` records attribution but does not authenticate or obtain the
owner's publication instruction.

## Apply posture locally

Posture changes the presumption in a segment assessment, not the safety gates:

- An unblock-weighted assessment favors landing when the segment is
  independently useful, delay has a named cost, remaining uncertainty is
  bounded, and further evidence is expensive or slow.
- A closure-weighted assessment favors waiting when an inexpensive near-term
  probe can materially reduce uncertainty, the promised outcome includes the
  open concern, or recovery and coordination costs are high.

These judgments can coexist in one train. For example, land layers 0–3 when
they safely unblock a named consumer, while holding layers 4–7 for stronger
closure because they are tightly coupled. A correctness-weighted train may
still land a safe, high-value prefix; an urgency-weighted train may still hold a
high-blast-radius segment.

Every separately merged tree must remain usable. If layer 4 breaks exercised
behavior restored by layer 7, either repair layers 4–6, consolidate 4–7 into one
owner-authorized merge unit, or hold that interval. Grouping sequential PR
merges inside one Action or executing them quickly does not make their
intermediate `main` trees atomic.

Each transition certificate binds candidate commit and tree, intended
predecessor, original reviewed PR head, reviewed-delta preservation, and the
fingerprint of the evidence used for intermediate usability. A later layer may
depend on `produced` while verification runs, but a changed certificate input
invalidates that layer's evidence and suffix. The segment witness aggregates
current certificates instead of rerunning unchanged expensive checks.

## Revise judgment without rewriting history

When evidence, coupling, unblock value, or recovery cost changes, append a new
segment assessment that names the change and supersedes the old decision. Keep
the earlier evidence visible. Re-run only the checks whose inputs or meaning
changed.

Add a Selector only if the release owner must revise a promised outcome, scope,
exception, consolidation, or authority. A posture revision never grants
publication or merge authority.
