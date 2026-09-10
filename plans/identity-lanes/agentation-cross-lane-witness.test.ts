/*
 * Cross-lane identity witness.
 *
 * Run this file by copying it to
 * apps/server/test/services/p6r/agentation-cross-lane.witness.test.ts in the
 * disposable native replay, then run the focused apps/server Vitest project.
 * The absolute community-plugin import is intentional: this witness executes
 * the real Agentation producer, while the relative imports resolve against the
 * exact fork replay under test.
 *
 * This is a proof fixture, not a fork patch and not a replacement for the
 * community plugin's own tests. The plugin-facing fake host records calls, but
 * its thread methods delegate to createNodeBbSdk and a controlled fetch that
 * reaches the real Hono HTTP routes below. The real tracked Agentation server
 * build is loaded with Node createRequire so replay's source-only condition
 * cannot select an unshipped SDK source entry. The controlled SDK opts into the
 * producer rendering hint explicitly; it does not recreate envelopes or native
 * assembly. The native plugin-runtime worker owns the complementary proof of
 * automatic hinting and retained SDK isolation.
 */

import { Hono } from "hono";
import { expect, it } from "vitest";
import {
  getLatestThreadSequence,
  listEvents,
  listQueuedThreadMessages,
} from "@bb/db";
import { createNodeBbSdk } from "@bb/sdk";
import type { HostDaemonRpcCommand } from "@bb/host-daemon-contract";
import {
  turnRequestEventDataSchema,
  type PromptInput,
} from "@bb/domain";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { ApiError } from "../../../src/errors.js";
import { registerThreadBaseRoutes } from "../../../src/routes/threads/base.js";
import { registerThreadActionRoutes } from "../../../src/routes/threads/actions.js";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import {
  createP6rProviderAdmission,
  type P6rAdmissionRequestFacts,
} from "../../../src/services/p6r/provider-admission.js";
import { installP6rNativeRequestRoutes } from "../../../src/services/p6r/native-request.js";
import { applyLoggedThreadLifecycleEvent } from "../../../src/services/threads/lifecycle-outcome.js";
import {
  waitForQueuedCommand,
  waitForQueuedCommandAfter,
} from "../../helpers/commands.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
} from "../../helpers/seed.js";
import { createTestAppHarness } from "../../helpers/test-app.js";

const AGENTATION_SERVER_DIST_PATH =
  "/home/ubuntu/bb/community-plugins/plugins/agentation-mentions/dist/server.js";
const AGENTATION_STORE_PATH =
  "/home/ubuntu/bb/community-plugins/plugins/agentation-mentions/lib/store.ts";
const CODEX_SESSION_PARAMS_PATH = new URL(
  "../../../../../plugins/provider-codex/src/session-params.ts",
  import.meta.url,
).href;

type AgentationDatabase = ReturnType<
  ReturnType<typeof createFakePluginHost>["bb"]["storage"]["database"]
>;
type AgentationStore = {
  appendThreadMessage: (...args: unknown[]) => unknown;
  openSession: (...args: unknown[]) => { id: string };
  upsertAnnotation: (...args: unknown[]) => unknown;
};
type AgentationPlugin = (
  bb: ReturnType<typeof createFakePluginHost>["bb"],
) => void | Promise<void>;
type NativeModuleResolveContext = {
  conditions: readonly string[];
  parentURL?: string;
};
type NativeModuleLoader = {
  createRequire: (filename: string | URL) => (specifier: string) => unknown;
  registerHooks: (hooks: {
    resolve: (
      specifier: string,
      context: NativeModuleResolveContext,
      nextResolve: (
        specifier: string,
        context: NativeModuleResolveContext,
      ) => unknown,
    ) => unknown;
  }) => { deregister: () => void };
};
const nativeModule = process.getBuiltinModule(
  "module",
) as unknown as NativeModuleLoader;
const requireCommunity = nativeModule.createRequire(import.meta.url);

function loadAgentationPlugin(): AgentationPlugin {
  const hooks = nativeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        specifier.startsWith("@get-bb/plugin-sdk") &&
        context.parentURL?.startsWith(
          "file:///home/ubuntu/bb/community-plugins/",
        )
      ) {
        return nextResolve(specifier, {
          ...context,
          conditions: context.conditions.filter(
            (condition) => condition !== "source",
          ),
        });
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    return (
      requireCommunity(AGENTATION_SERVER_DIST_PATH) as {
        default: AgentationPlugin;
      }
    ).default;
  } finally {
    hooks.deregister();
  }
}

async function makeNativeFixture() {
  const harness = await createTestAppHarness();
  let person = "alice";
  const registry = createP6rProviderRegistry({ now: Date.now });
  const configuration = {
    version: 1 as const,
    boundaryId: "native-proof",
    pluginId: "people",
    ingressIds: ["browser"],
    credentials: [],
    resolver: { timeoutMs: 100 },
  };
  const prepared = await registry.prepare({
    configuration,
    generation: "people-1",
    deadlineAt: Date.now() + 1000,
    provider: {
      issuers: ["test:people"],
      resolve: async () => ({
        status: "resolved" as const,
        issuer: "test:people",
        subject: person,
        presentation: {
          displayName: person.toUpperCase(),
          handle: person,
          avatarUrl: null,
        },
      }),
    },
  });
  if (!prepared.ok) throw new Error("provider preparation failed");
  expect(registry.publish(prepared.value).ok).toBe(true);

  // This is the same admission middleware and native route composition as
  // native-message-authorship.test.ts. The witness must exercise the actual
  // HTTP boundary, not call native send helpers directly.
  const requestFacts = new WeakMap<object, P6rAdmissionRequestFacts>();
  const admission = createP6rProviderAdmission({
    now: Date.now,
    instanceId: "native-proof",
    machineName: "test-server",
    providerRegistry: registry,
    selectedConfiguration: () => configuration,
    ingressFacts: () => ({
      id: "browser",
      kind: "owned-proxy" as const,
      authenticatedPeer: "test-peer",
    }),
    requestFacts: (request) => {
      if (request === null || typeof request !== "object") {
        throw new Error("expected HTTP context");
      }
      const facts = requestFacts.get(request);
      if (!facts) throw new Error("expected captured request facts");
      return facts;
    },
  });
  const api = new Hono();
  api.use("*", async (context, next) => {
    requestFacts.set(context, {
      authority: "fixture.test",
      method: context.req.method,
      pathname: context.req.path,
      receivedAt: Date.now(),
      transport: "http",
      cookie: () => null,
      header: (name) => context.req.header(name) ?? null,
    });
    await next();
  });
  api.onError((error, context) =>
    error instanceof ApiError
      ? error.toResponse()
      : context.json({ error: String(error) }, 500),
  );
  installP6rNativeRequestRoutes(api, admission, "people");
  registerThreadBaseRoutes(api, harness.deps);
  registerThreadActionRoutes(api, harness.deps);
  const app = new Hono().route("/api/v1", api);

  const { host } = seedHostSession(harness.deps);
  const { project } = seedProjectWithSource(harness.deps, {
    hostId: host.id,
    path: "/tmp/agentation-cross-lane",
  });
  const environment = seedEnvironment(harness.deps, {
    hostId: host.id,
    projectId: project.id,
    path: "/tmp/agentation-cross-lane",
    status: "ready",
  });

  function newThread() {
    const thread = seedThread(harness.deps, {
      projectId: project.id,
      environmentId: environment.id,
      status: "idle",
    });
    seedThreadRuntimeState(harness.deps, {
      environmentId: environment.id,
      providerThreadId: `provider-${thread.id}`,
      threadId: thread.id,
    });
    return thread;
  }

  const requestAfter = (threadId: string, sequence: number) => {
    const rows = listEvents(harness.db, { threadId }).filter(
      (row) => row.type === "client/turn/requested" && row.sequence > sequence,
    );
    expect(rows).toHaveLength(1);
    return turnRequestEventDataSchema.parse(JSON.parse(rows[0]!.data));
  };

  return { app, environment, harness, newThread, project, requestAfter };
}

function capturedAuthor(handle: string) {
  return {
    kind: "captured" as const,
    identity: {
      kind: "person" as const,
      key: `tailnet:${handle}`,
      issuer: "tailnet",
      subject: handle,
    },
    presentation: {
      displayName: handle === "alice" ? "Alice Example" : "Bob Example",
      handle,
      avatarUrl: null,
    },
    evidence: "provider-verified" as const,
    capturedAt: "2026-09-10T00:00:00.000Z",
  };
}

function seedProducerBatch(
  db: AgentationDatabase,
  sessionId: string,
  threadId: string,
  projectId: string,
  prefix: string,
  store: AgentationStore,
): [string, string] {
  const aliceId = `ann_${prefix}_alice`;
  const bobId = `ann_${prefix}_bob`;
  const bb = {
    route: `/threads/${threadId}`,
    pluginId: "cross-lane-fixture",
    surface: "threadPanel",
    threadId,
    projectId,
    routeLabel: "Cross-lane fixture",
  };

  store.upsertAnnotation(db, {
    sessionId,
    annotation: {
      id: aliceId,
      comment: `${prefix} Alice feedback stays byte-for-byte in the producer input`,
      elementPath: "main > button[data-owner=alice]",
      timestamp: 1_757_462_400_000,
      x: 10,
      y: 20,
      element: "button",
      status: "pending",
      kind: "feedback",
    },
    bb,
    author: capturedAuthor("alice"),
  });
  store.appendThreadMessage(db, aliceId, {
    role: "human",
    content: `${prefix} Bob reply has a different captured author`,
    author: capturedAuthor("bob"),
  });

  store.upsertAnnotation(db, {
    sessionId,
    annotation: {
      id: bobId,
      comment: `${prefix} Bob feedback is the second mixed-author item`,
      elementPath: "main > button[data-owner=bob]",
      timestamp: 1_757_462_401_000,
      x: 30,
      y: 40,
      element: "button",
      status: "pending",
      kind: "feedback",
    },
    bb,
    author: capturedAuthor("bob"),
  });
  store.appendThreadMessage(db, bobId, {
    role: "human",
    content: `${prefix} Alice reply demonstrates the reverse author pairing`,
    author: capturedAuthor("alice"),
  });

  return [aliceId, bobId];
}

function textParts(input: PromptInput[]): string[] {
  return input.flatMap((part) => (part.type === "text" ? [part.text] : []));
}

function assertOneProducerEnvelopePerAnnotation(
  input: PromptInput[],
  prefix: string,
): void {
  const text = textParts(input).join("");
  expect(text).toContain(
    `${prefix} Alice feedback stays byte-for-byte in the producer input`,
  );
  expect(text).toContain(`${prefix} Bob feedback is the second mixed-author item`);
  expect(text).toContain(`${prefix} Bob reply has a different captured author`);
  expect(text).toContain(
    `${prefix} Alice reply demonstrates the reverse author pairing`,
  );
  expect((text.match(/\[sender=alice\]/gu) ?? []).length).toBe(1);
  expect((text.match(/\[\/sender=alice\]/gu) ?? []).length).toBe(1);
  expect((text.match(/\[sender=bob\]/gu) ?? []).length).toBe(1);
  expect((text.match(/\[\/sender=bob\]/gu) ?? []).length).toBe(1);
  expect((text.match(/<attached>/gu) ?? []).length).toBe(2);
  expect((text.match(/<\/attached>/gu) ?? []).length).toBe(2);
  expect(text).not.toContain("[sender=machine:");
}

type TurnSubmitCommand = Extract<
  HostDaemonRpcCommand,
  { type: "turn.submit" }
>;

function assertNativeSubmission(
  command: { command: unknown },
  expected: PromptInput[],
): TurnSubmitCommand {
  if (
    typeof command.command !== "object" ||
    command.command === null ||
    !("type" in command.command) ||
    command.command.type !== "turn.submit"
  ) {
    throw new Error("Expected an intercepted turn.submit command");
  }
  const turnSubmit = command.command as TurnSubmitCommand;
  expect(turnSubmit).toMatchObject({ type: "turn.submit", input: expected });
  expect(JSON.stringify(turnSubmit)).not.toContain("[sender=machine:");
  return turnSubmit;
}

it("proves actual Agentation mixed authors/replies survive native send, queue, drain, and Codex conversion", async () => {
  const native = await makeNativeFixture();
  const immediateThread = native.newThread();
  const queuedThread = native.newThread();
  const sdkRequests: Array<{ path: string; producer: boolean }> = [];
  const immediateInputs: PromptInput[][] = [];
  const queuedInputs: PromptInput[][] = [];
  const queuedIds: string[] = [];

  const producerFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const pathname = new URL(request.url).pathname;
    const producer =
      request.method === "POST" &&
      /\/api\/v1\/threads\/[^/]+\/(?:send|queued-messages)$/u.test(pathname);
    const headers = new Headers(request.headers);
    if (producer) headers.set("x-bb-p6r-message-rendering", "producer");
    sdkRequests.push({ path: pathname, producer });
    return native.app.fetch(new Request(request, { headers }));
  };
  const sdk = createNodeBbSdk({ baseUrl: "http://bb.test", fetch: producerFetch });

  const producer = createFakePluginHost({
    pluginId: "agentation-mentions",
    sdk: {
      threads: {
        async send(args) {
          immediateInputs.push(args.input as PromptInput[]);
          return sdk.threads.send(args);
        },
        queuedMessages: {
          async create(args) {
            queuedInputs.push(args.input as PromptInput[]);
            const result = await sdk.threads.queuedMessages.create(args);
            queuedIds.push(result.id);
            return result;
          },
        },
      },
    },
  });

  try {
    const agentationStore = (await import(
      /* @vite-ignore */
      AGENTATION_STORE_PATH
    )) as AgentationStore;
    const { toCodexUserInput } = (await import(
      /* @vite-ignore */
      CODEX_SESSION_PARAMS_PATH
    )) as {
      toCodexUserInput: (input: PromptInput[]) => unknown[];
    };
    const agentationPlugin = loadAgentationPlugin();
    await agentationPlugin(producer.bb);
    expect(producer.harness.registrations.mentionProviders.map((p) => p.id)).toContain(
      "feedback-batch",
    );

    const db = producer.bb.storage.database();
    const session = agentationStore.openSession(db, {
      url: "http://bb.test/threads/cross-lane",
      route: `/threads/${immediateThread.id}`,
      title: "Cross-lane witness",
      threadId: immediateThread.id,
      projectId: native.project.id,
    });
    const immediateIds = seedProducerBatch(
      db,
      session.id,
      immediateThread.id,
      native.project.id,
      "immediate",
      agentationStore,
    );
    const queuedBatchIds = seedProducerBatch(
      db,
      session.id,
      queuedThread.id,
      native.project.id,
      "queued",
      agentationStore,
    );

    const immediateBefore = getLatestThreadSequence(native.harness.db, {
      threadId: immediateThread.id,
    });
    const immediateResult = await producer.harness.behavior.callRpc(
      "sendStagedAnnotations",
      {
        annotationIds: immediateIds,
        threadId: immediateThread.id,
        delivery: "send",
      },
    );
    expect(immediateResult).toMatchObject({ outcome: "sent", assignedIds: immediateIds });
    expect(immediateInputs).toHaveLength(1);
    expect(producer.harness.sdk.callsTo("threads.send")).toHaveLength(1);
    const immediateInput = immediateInputs[0]!;
    assertOneProducerEnvelopePerAnnotation(immediateInput, "immediate");

    const immediateRequest = native.requestAfter(
      immediateThread.id,
      immediateBefore,
    );
    expect(immediateRequest.p6rAuthors).toBeUndefined();
    expect(immediateRequest.input).toEqual(immediateInput);
    const immediateCommand = await waitForQueuedCommand(
      native.harness,
      ({ command }) =>
        command.type === "turn.submit" && command.threadId === immediateThread.id,
    );
    const immediateSubmission = assertNativeSubmission(
      immediateCommand,
      immediateInput,
    );
    const immediateCodexInput = toCodexUserInput(
      immediateSubmission.input,
    );
    expect(textParts(immediateCodexInput as PromptInput[])).toEqual(
      textParts(immediateInput),
    );
    expect(immediateCodexInput).toHaveLength(immediateInput.length);

    // Complete the first native turn before the reply RPC. This keeps the
    // mode:auto reply on the immediate route rather than making the witness
    // depend on an unrelated active-turn queue policy.
    applyLoggedThreadLifecycleEvent(native.harness.deps, {
      threadId: immediateThread.id,
      event: { type: "run.succeeded" },
    });
    const replyMessage =
      "Fresh reply from the portable actor is a new captured author";
    const replyBefore = getLatestThreadSequence(native.harness.db, {
      threadId: immediateThread.id,
    });
    const replyResult = await producer.harness.behavior.callRpc(
      "replyToAnnotation",
      { annotationId: immediateIds[0], message: replyMessage },
    );
    expect(producer.harness.sdk.callsTo("threads.send")).toHaveLength(2);
    expect(immediateInputs).toHaveLength(2);
    const replyInput = immediateInputs[1]!;
    const replyText = textParts(replyInput).join("");
    expect(replyText).toContain(replyMessage);
    expect(replyText).toContain(
      "immediate Alice feedback stays byte-for-byte in the producer input",
    );
    expect(replyText).toContain("immediate Bob reply has a different captured author");
    const replySenderLabels = replyText
      .split("[sender=")
      .slice(1)
      .map((part) => part.split("]")[0]);
    expect(replySenderLabels).toHaveLength(1);
    expect(replySenderLabels[0]).not.toBe("alice");
    expect(replySenderLabels[0]).not.toBe("bob");
    expect(replyText.split("<attached>").length - 1).toBe(1);
    const replyAnnotation = (
      replyResult as {
        annotation: {
          thread: Array<{
            author?: {
              kind: string;
              identity?: { key?: string };
            };
            content: string;
          }>;
        } | null;
      }
    ).annotation;
    const latestReply = replyAnnotation?.thread.at(-1);
    expect(latestReply).toMatchObject({
      content: replyMessage,
      author: { kind: "captured" },
    });
    expect(latestReply?.author?.identity?.key).not.toBe("tailnet:alice");
    const replyRequest = native.requestAfter(
      immediateThread.id,
      replyBefore,
    );
    expect(replyRequest.p6rAuthors).toBeUndefined();
    expect(replyRequest.input).toEqual(replyInput);
    const replyCommand = await waitForQueuedCommandAfter(
      native.harness,
      immediateCommand.row.cursor,
      ({ command }) =>
        command.type === "turn.submit" && command.threadId === immediateThread.id,
    );
    const replySubmission = assertNativeSubmission(replyCommand, replyInput);
    const replyCodexInput = toCodexUserInput(
      replySubmission.input,
    );
    expect(textParts(replyCodexInput as PromptInput[])).toEqual(
      textParts(replyInput),
    );
    expect(replyCodexInput).toHaveLength(replyInput.length);

    const queuedResult = await producer.harness.behavior.callRpc(
      "sendStagedAnnotations",
      {
        annotationIds: queuedBatchIds,
        threadId: queuedThread.id,
        delivery: "queue",
      },
    );
    expect(queuedResult).toMatchObject({ outcome: "queued", assignedIds: queuedBatchIds });
    expect(queuedInputs).toHaveLength(1);
    expect(queuedIds).toHaveLength(1);
    expect(producer.harness.sdk.callsTo("threads.queuedMessages.create")).toHaveLength(1);
    const queuedInput = queuedInputs[0]!;
    assertOneProducerEnvelopePerAnnotation(queuedInput, "queued");

    const persisted = listQueuedThreadMessages(native.harness.db, queuedThread.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.content).toBe(JSON.stringify(queuedInput));
    expect(persisted[0]!.p6rAuthors).toBeNull();

    const queuedBeforeDrain = getLatestThreadSequence(native.harness.db, {
      threadId: queuedThread.id,
    });
    await sdk.threads.queuedMessages.send({
      threadId: queuedThread.id,
      queuedMessageId: queuedIds[0]!,
      mode: "auto",
    });
    const queuedRequest = native.requestAfter(queuedThread.id, queuedBeforeDrain);
    expect(queuedRequest.p6rAuthors).toBeUndefined();
    expect(queuedRequest.input).toEqual(queuedInput);
    const queuedCommand = await waitForQueuedCommand(
      native.harness,
      ({ command }) =>
        command.type === "turn.submit" && command.threadId === queuedThread.id,
    );
    const queuedSubmission = assertNativeSubmission(queuedCommand, queuedInput);
    const queuedCodexInput = toCodexUserInput(
      queuedSubmission.input,
    );
    expect(textParts(queuedCodexInput as PromptInput[])).toEqual(
      textParts(queuedInput),
    );
    expect(queuedCodexInput).toHaveLength(queuedInput.length);

    expect(sdkRequests).toEqual([
      {
        path: `/api/v1/threads/${immediateThread.id}/send`,
        producer: true,
      },
      {
        path: "/api/v1/threads/" + immediateThread.id + "/send",
        producer: true,
      },
      {
        path: `/api/v1/threads/${queuedThread.id}/queued-messages`,
        producer: true,
      },
      {
        path: `/api/v1/threads/${queuedThread.id}/queued-messages/${queuedIds[0]}/send`,
        producer: false,
      },
    ]);
  } finally {
    await producer.harness.lifecycle.dispose();
    await native.harness.cleanup();
  }
});
