# Merge-train mode graphs

Start with one small discovery definition, rule the mode, then revise the same
Pkl file while retaining its sibling ledger. Workbench records a Selector
ruling but does not choose a conditional Pkl branch. Do not keep both modes in a
static graph and informally skip the inconvenient nodes. For a short train with
an explicit mode and one operator, keep this graph compact rather than expanding
each GitHub command into a node.

## Discovery definition

Replace the inventory path and oracle with the repository's real contract.

```pkl
amends "workbench:plan"

meta {
  title = "Prepare a stacked merge train"
  goal = "Choose the train's release posture and establish its current composition."
}

local inventory = new Action {
  id = "train-inventory"
  owner = "merge-orchestrator"
  outcome = "Record PR order, bases, heads, merge method, repository rules, and composition boundaries."
  grant { "plans/train/inventory.json" }
  oracle = module.mechanical("jq -e '.status == \"pass\"' plans/train/inventory.json")
}

local operatingMode = new Selector {
  id = "operating-mode"
  owner = "release-owner"
  outcome = "Choose the evidence and exception posture for this train."
  question = "Should this train land now with bounded follow-ups, or land correctly with complete in-scope closure?"
  options {
    "Land now: unblock main while holding only unsafe composition, exercised regressions, invalid generated or lock state, enforced policy, and missing authority."
    "Land correctly: close every in-scope concern and complete the agreed composition and runtime evidence before publication."
  }
}

nodes { inventory; operatingMode }
```

If the request already unambiguously selects a mode, record that ruling as soon
as the inventory proves which train it applies to. Do not complete unrelated
review cleanup before ruling the mode.

## Land-now rolling graph

Separate artifact availability from acceptance. The builder may use a produced
predecessor while its verification runs in another lane. Only landing consumes
verified evidence.

```text
inventory + mode ─┬→ remote-policy/capability probe ─────┐
                  ├→ landing-procedure dry run ──────────┤
                  ├→ layer 1 produced → layer 2 → … ─────┤
                  │       └→ verify 1  └→ verify 2 …      ├→ usable-prefix witness
                  └→ exception disposition / follow-up ──┘          │
                                                  exact authority ──┤
                                                                    ▼
                                                          land usable prefix
                                                                    │
suffix construction and verification ─→ next usable witness ───────┘
```

The essential dependency difference is:

```pkl
local layer2 = new Action {
  id = "candidate-layer-2"
  owner = "stack-builder"
  outcome = "Produce layer 2 from the produced layer-1 candidate."
  grant { "refs/train/candidate/2"; "plans/train/certificates/layer-2.json" }
  needs { module.ruled(operatingMode); module.produced(layer1) }
  oracle = module.mechanical("bash plans/train/check-transition.sh 2")
}

local authorityScope = new Guard {
  id = "publication-authority-prefix-0-3"
  owner = "release-owner"
  outcome = "Confirm the owner's exact, current publication grant for prefix 0-3."
  observes { "plans/train/authority-0-3.json" }
  needs { module.verified(prefixWitness) }
  oracle = module.adjudicated("The owner instruction and scope manifest agree on repository, target, PR range, heads, actor, squash method, permitted rewrites, bypass prohibition, and single-use or expiry bound.", "release-owner")
}

local landPrefix = new Action {
  id = "land-prefix-0-3"
  owner = "merge-operator"
  outcome = "Publish and merge the verified safe prefix through layer 3."
  grant { "github/org/repo/main/prefix-0-3"; "plans/train/landing-journal.json" }
  needs {
    module.ruled(operatingMode)
    module.produced(layer1); module.verified(layer1)
    module.produced(layer2); module.verified(layer2)
    module.produced(layer3); module.verified(layer3)
    module.verified(prefixWitness)
    module.verified(authorityScope)
  }
  oracle = module.mechanical("jq -e '.segments[\"0-3\"].status == \"complete\" and all(.segments[\"0-3\"].pullRequests[]; .treeVerified == true)' plans/train/landing-journal.json")
}
```

Use one landing Action for a prefix when the same operator, exact authorization,
and stop policy govern all of its PRs. The journal records each PR's remote-truth
checkpoint; the Pkl graph need not expand one guarded command into
ready/retarget/merge nodes. Within the journal, keep `prepared`, `published`,
`merge-requested`, `remotely-merged`, and `tree-verified` distinct so restart
recovery can reconcile remote truth before retrying. `adjudicate --by` records
attribution but does not authenticate or obtain the owner's instruction.

Every separately merged tree in the prefix must be usable. If layer 4 breaks an
exercised behavior restored by layer 7, land 0–3 while the suffix finishes, then
either repair layers 4–6, consolidate 4–7 into one owner-authorized merge unit,
or keep that interval unmerged. Grouping sequential PR merges inside one Action
or running them quickly does not make their intermediate `main` trees atomic.

Each transition certificate binds candidate commit and tree, intended
predecessor, original reviewed PR head, reviewed-delta preservation, and the
fingerprint of the evidence used for intermediate usability. A later layer may
depend on `produced` while verification runs, but any changed certificate input
invalidates that layer's evidence and its suffix. The prefix witness aggregates
the certificates instead of rerunning unchanged expensive checks.

## Land-correctly graph

Correctness mode can use the same rolling construction edges, parallel probes,
and landing-procedure preparation. It changes publication, not the ability to
prepare work concurrently:

```text
inventory + mode
       ├→ rolling candidate construction and layer verification ─┐
       ├→ review closure / contract probes / final touches ──────┤
       └→ remote-policy and landing-procedure proof ─────────────┤
                                                                  ▼
                                                    complete stack witness
                                                    + runtime/release evidence
                                                    + final owner review
                                                                  │
                                                                  ▼
                                                        land complete train
```

No prefix lands until every in-scope obligation and final oracle is complete.
A follow-up is allowed only after the owner removes that work from the promised
outcome; it is not an informal waiver.

## Mode revision

If the owner changes posture, preserve the first ruling and add a new Selector
such as `operating-mode-revision`. Make unfinished mode-sensitive nodes depend
on the new ruling, revise their oracles, and re-run only evidence whose meaning
changed. Do not erase old failures or rebuild completed work whose contract did
not change.

```text
observed need for change → mode-revision ruling → revised unfinished graph
                                               └→ refreshed affected evidence
```

A mode revision never grants publication or merge authority.
