export const meta = {
  name: "cross-references-adversarial-closeout",
  description: "Adversarially review, repair, and verify the Cross References proving spine",
  phases: [
    {
      title: "Review implementation",
      detail: "Independent reviewers inspect correctness, UX, performance, and integration risks",
    },
    {
      title: "Repair findings",
      detail: "One owner verifies findings and makes narrow evidence-backed corrections",
    },
    {
      title: "Verify closeout",
      detail: "An independent final owner runs all gates and reports residual work",
    },
  ],
};

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings", "checks", "confidenceLimits"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "title", "evidence", "recommendation", "mustFix"],
        properties: {
          severity: { enum: ["critical", "high", "medium", "low"] },
          title: { type: "string" },
          evidence: { type: "string" },
          recommendation: { type: "string" },
          mustFix: { type: "boolean" },
        },
      },
    },
    checks: { type: "array", items: { type: "string" } },
    confidenceLimits: { type: "array", items: { type: "string" } },
  },
};

const repairSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "fixed", "rejected", "filesChanged", "checks", "blocker"],
  properties: {
    summary: { type: "string" },
    fixed: { type: "array", items: { type: "string" } },
    rejected: { type: "array", items: { type: "string" } },
    filesChanged: { type: "array", items: { type: "string" } },
    checks: { type: "array", items: { type: "string" } },
    blocker: { type: ["string", "null"] },
  },
};

const verifySchema = {
  type: "object",
  additionalProperties: false,
  required: ["ready", "summary", "residualFindings", "filesChanged", "checks", "blocker"],
  properties: {
    ready: { type: "boolean" },
    summary: { type: "string" },
    residualFindings: { type: "array", items: { type: "string" } },
    filesChanged: { type: "array", items: { type: "string" } },
    checks: { type: "array", items: { type: "string" } },
    blocker: { type: ["string", "null"] },
  },
};

const context = `
Work in /home/ubuntu/bb on the current direct workspace. Read the root and
community-plugins AGENTS.md files and run ./bin/status. Preserve all existing
dirty work. In particular, Machine Monitor contains authored disk-breakdown
and directory-monitoring changes alongside the new reference work. Never
stash, reset, clean, switch branches, commit, advance gitlinks, overwrite an
overlapping change wholesale, or commit generated dist output.

Review the completed proving spine in:
- community-plugins/plugins/cross-references
- community-plugins/plugins/machine-monitor/{attachment-contract.ts,attachment-delivery.ts,attachments.tsx,server.ts,store.ts,rpc-contract.ts,app.tsx,app.css,test/}
- the related package-lock, community catalog, README, and release wiring

Read ARCHITECTURE.md and IMPLEMENTATION.md first. The product north star is
"link once, recover context everywhere": a source reference is discoverable
from its target with the source context intact, and the canonical resource
model must remain additive toward authority-free providers and multipart-key
containment. V1 intentionally exposes only deployment-local exact BB thread
references through Machine Monitor. Do not request or implement deferred
containment APIs, defineCrossLinks, generic URL codecs/components, GitHub,
Sticky Notes, federation, provider registries, or automatic deletion cleanup.

Use current installed SDK declarations and the actual live plugin contracts,
not memory. Evaluate source ownership, durable local-first behavior, CAS and
rollback recovery, bounded queries, error classification, lifecycle aborts,
idle work, exact invalidation, reconnects, native navigation, split panes,
keyboard/focus/a11y, package installability, and tests. A passing test is not
proof when it fails to exercise the claimed interleaving. Distinguish findings
from optional polish and cite file/line or a reproducible command in evidence.
Do not touch Sticky Notes or unrelated plugins.
`;

phase("Review implementation");
const reviews = await parallel([
  () =>
    agent(
      `${context}

Perform a read-only adversarial backend/reliability review. Try to refute the
implementation's convergence and integrity claims. Trace canonicalization and
digest parity across both plugins; every projection outcome; local and remote
rollback/rebase; coalesced pending plus immutable in-flight rows; stale
acknowledgements; lease expiry; abort/reload; terminal versus transient error
classification; empty versus tombstone state; SQLite transactions, FKs,
indexes, migrations, and keyset pagination. Inspect tests for missing
interleavings and run focused diagnostics when useful. Do not edit files.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "reliability-review",
        phase: "Review implementation",
        schema: reviewSchema,
      },
    ),
  () =>
    agent(
      `${context}

Perform a read-only adversarial product/UI/performance review using the BB UI
and bb-performant-react contracts. Verify that the user can link once from
Machine Monitor and understand/navigate every resulting backlink. Inspect the
thread picker, optimistic/local-first states, failure language, one-control
header footprint, portal behavior, focus restoration, keyboard/screen-reader
semantics, modifier-click navigation, compact viewport and split-pane
isolation, stale request guards, reconnect refetch, subscription granularity,
render stability, and absence of polling or multiplied overlay work. Run
focused harness checks where useful. Do not edit files.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "ui-performance-review",
        phase: "Review implementation",
        schema: reviewSchema,
      },
    ),
  () =>
    agent(
      `${context}

Perform a read-only adversarial integration/release review. Verify independent
community-package installation, dependencies and files lists, npm lockfile
shape, RPC schema compatibility, app/server bundle boundaries, public versus
private API claims, current SDK types, fake-host fidelity limits, migration
posture, live plugin reload/status, community release/catalog wiring, and the
full required test/typecheck/build/staging checks. Look for accidental
coupling that would make Machine Monitor fail when Cross References is absent,
or v1 choices that foreclose the authority-free multipart-key vision. Do not
edit files or mutate the operator's persistent reference data.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "integration-release-review",
        phase: "Review implementation",
        schema: reviewSchema,
      },
    ),
]);

const usableReviews = reviews.filter(Boolean);
if (usableReviews.length === 0) {
  throw new Error("No adversarial reviewer returned a usable result");
}

phase("Repair findings");
const repair = await agent(
  `${context}

Independent review reports:
${JSON.stringify(usableReviews)}

Act as the sole repair owner. Verify every reported finding against the
current code and contracts before changing anything; reject false positives
with concrete evidence. Fix all verified critical/high findings and verified
medium issues that affect correctness, durability, accessibility, boundedness,
installability, or the link-once product outcome. Low-severity polish should
change only when it is safe and clearly improves the owned surface. Add or
strengthen regression tests for each repaired behavior. Keep v1 exact-only and
do not broaden scope. Preserve the unrelated Machine Monitor changes.

Use apply_patch. Edit only the two owned plugin directories and their necessary
community package/catalog/release metadata. Run focused tests and typechecks
after each repair cluster, then both package builds, community npm run test,
npm run typecheck, npm run build, git diff --check, plugin types --check, and
./bin/check --role staging. Reload the two local plugins if source changed and
inspect their status. Do not mutate the operator's persistent reference data.
Return what was fixed and what was rejected; set blocker only for remaining
work that prevents a truthful closeout.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "adversarial-repair",
    phase: "Repair findings",
    schema: repairSchema,
  },
);

if (!repair || repair.blocker) {
  throw new Error(`Adversarial repair blocked: ${repair?.blocker ?? "worker failed"}`);
}

phase("Verify closeout");
const verification = await agent(
  `${context}

Review reports and repair handoff:
${JSON.stringify({ reviews: usableReviews, repair })}

Act as an independent final closeout owner. Re-read the actual post-repair
diff; do not trust summaries. Reproduce each accepted fix and spot-check each
rejected finding. Run all focused tests for both plugins, their typechecks and
production builds, full community test/typecheck/build, git diff --check,
plugin types --check, query-plan assertions, and ./bin/check --role staging.
Reload both installed path plugins and confirm running status, zero new handler
errors, expected service state, and bounded read RPCs. Do not mutate persistent
reference data.

Look once more for untested races, broken absence behavior, hot idle work,
unbounded reads, incorrect navigation/a11y, generated tracked artifacts,
package omissions, or a v1 implementation that blocks the long-term
provider/key model. You may make only narrow, undeniable corrections within
the two owned plugins and add their regression tests; rerun affected gates
afterward. Report ready=true only when no required implementation or review
work remains before human product review. Distinguish optional future vision
from residual v1 defects.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "closeout-verifier",
    phase: "Verify closeout",
    schema: verifySchema,
  },
);

if (!verification) {
  throw new Error("Closeout verifier failed");
}

return {
  reviewerCount: usableReviews.length,
  reviews: usableReviews,
  repair,
  verification,
};
