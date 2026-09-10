import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { request } from "node:http";
import { startTestServer } from "/home/ubuntu/bb/fork/build/bb/apps/server/test/helpers/test-app.ts";
import { defaultTailnetIdentityBoundary } from "../fork/build/bb/packages/config/src/tailnet-default.ts";

const source = execFileSync("git", ["-C", "/home/ubuntu/bb/fork/build/bb", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const ownedHost = "bb.fixture.ts.net";
process.env.BB_TAILNET_IDENTITY_OWNED_HOST = ownedHost;
const server = await startTestServer({
  p6rIdentityBoundary: defaultTailnetIdentityBoundary(ownedHost),
  seedFirstPartyProviders: false,
});
server.pluginService.bindSdk({ baseUrl: server.baseUrl });
try {
  const installed = await server.pluginService.installPath("/home/ubuntu/bb/plugins/plugins/identity-boundaries");
  assert.equal(installed.status, "running", installed.statusDetail ?? undefined);
  const rpc = async (method: string, input: object, headers: Record<string, string> = {}) => {
    return new Promise<any>((resolve, reject) => {
      const req = request(`${server.baseUrl}/api/v1/plugins/identity-boundaries/rpc/${method}`, {
        method: "POST", headers: { "content-type": "application/json", ...headers },
      }, response => {
        let text = "";
        response.on("data", chunk => { text += chunk; });
        response.on("end", () => {
          try {
            const body = JSON.parse(text);
            assert.equal(response.statusCode, 200, JSON.stringify(body));
            resolve(body);
          } catch (error) { reject(error); }
        });
      });
      req.on("error", reject);
      req.end(JSON.stringify(input));
    });
  };
  let login = "";
  for (let attempt = 0; attempt < 40; attempt++) {
    const directory = await rpc("searchDirectoryRecipients", { query: "", limit: 10 });
    assert.equal(directory.ok, true);
    if (directory.result.recipients.length > 0) {
      login = directory.result.recipients[0].login;
      console.log(JSON.stringify({ directoryPeople: directory.result.recipients.length }));
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(login, "Directory must expose real Tailnet people");
  const identified = await rpc("bb-identity.v1.bootstrap", {}, { host: ownedHost, "tailscale-user-login": login });
  assert.equal(identified.result.value.actor.identity.kind, "person");
  assert.equal(identified.result.value.actor.evidence, "provider-verified");
  assert.equal(identified.result.value.capabilities.directory.search, true);
  const local = await rpc("bb-identity.v1.bootstrap", {});
  assert.equal(local.result.value.actor.identity.kind, "machine");
  const invalid = await rpc("bb-identity.v1.bootstrap", {}, { host: ownedHost, "tailscale-user-login": "missing@example.invalid" });
  assert.equal(invalid.result.value.actor.identity.kind, "machine");
  console.log(JSON.stringify({ source, result: "pass", scope: "canonical configuration change and host/plugin in fresh test state; controlled ingress headers, not browser identity proof" }));
} finally {
  await server.pluginService.stop();
  await server.close();
}
