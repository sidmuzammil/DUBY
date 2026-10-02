// A real Gateway + trusted plugin + real Rust broker with a deterministic model fixture.
// The fixture is intentionally not advertised as live AI inference.
import { createServer } from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Runtime } from "../packages/runtime-bridge/index.mjs";
const root = await mkdtemp(join(tmpdir(), "duby-flow-")),
  socket = join(root, "broker.sock");
await writeFile(
  join(root, "meeting.txt"),
  "Duby review: ship a small scoped-file alpha. Maya was not used. Native Wayland validation remains open.",
);
const broker = spawn("target/debug/examples/socket_harness", [root, socket], {
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((res, rej) => {
  broker.stdout.once("data", res);
  broker.once("error", rej);
});
let calls = 0,
  toolsSeen = [],
  fragmentCount = 0;
const events = [];
const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: [] }));
    return;
  }
  let raw = "";
  for await (const c of req) raw += c;
  const body = JSON.parse(raw);
  calls++;
  toolsSeen = (body.tools || []).map((t) => t.function?.name || t.name);
  assert.deepEqual(toolsSeen.sort(), ["duby_find", "duby_read", "duby_save"]);
  const toolResults = (body.messages || []).filter((m) => m.role === "tool");
  let name, args;
  if (toolResults.length === 0) {
    name = "duby_read";
    args = JSON.stringify({ path: "meeting.txt" });
  } else if (!toolResults.some((m) => String(m.content).includes("sha256"))) {
    assert.ok(toolResults.some((m) => String(m.content).includes("Wayland")));
    name = "duby_save";
    args = JSON.stringify({
      path: "summary.md",
      content:
        "# Review summary\n\nShip the scoped-file alpha. Native Wayland validation remains open.\n",
    });
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (delta) =>
    res.write(
      "data: " +
        JSON.stringify({
          id: "fixture",
          object: "chat.completion.chunk",
          created: 1,
          model: "fixture",
          choices: [{ index: 0, delta, finish_reason: null }],
        }) +
        "\n\n",
    );
  if (name) {
    const callsInTurn = [{ name, args }];
    if (calls === 1)
      callsInTurn.push({
        name: "duby_find",
        args: JSON.stringify({ path: "." }),
      });
    send({
      role: "assistant",
      tool_calls: callsInTurn.map((call, index) => ({
        index,
        id: `call_${calls}_${index}`,
        type: "function",
        function: { name: call.name, arguments: "" },
      })),
    });
    for (
      let i = 0;
      i < Math.max(...callsInTurn.map((c) => c.args.length));
      i += 9
    ) {
      for (const [index, call] of callsInTurn.entries()) {
        if (i >= call.args.length) continue;
        send({
          tool_calls: [
            { index, function: { arguments: call.args.slice(i, i + 9) } },
          ],
        });
        fragmentCount++;
      }
    }
  } else
    send({
      role: "assistant",
      content: "Saved the verified summary to summary.md.",
    });
  res.write(
    "data: " +
      JSON.stringify({
        id: "fixture",
        object: "chat.completion.chunk",
        created: 1,
        model: "fixture",
        choices: [
          { index: 0, delta: {}, finish_reason: name ? "tool_calls" : "stop" },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }) +
      "\n\n",
  );
  res.end("data: [DONE]\n\n");
});
await new Promise((res) => server.listen(0, "127.0.0.1", res));
const port = server.address().port;
let doneResolve;
const done = new Promise((res) => (doneResolve = res));
const runtime = new Runtime((e) => {
  events.push(e);
  console.log(e.state, e.summary);
  if (["completed", "error", "cancelled"].includes(e.state)) doneResolve(e);
});
runtime.testCredential = "fixture-model-token";
try {
  await runtime.init({
    data: join(root, "runtime"),
    socket,
    token: "fixture-broker-token",
  });
  await runtime.connect({
    provider: "custom",
    model: "fixture",
    endpoint: `http://127.0.0.1:${port}/v1`,
  });
  await runtime.send({
    task: "agent:duby:duby:integration",
    prompt:
      "Read meeting.txt using duby_read, summarize it and create summary.md using duby_save.",
  });
  const final = await Promise.race([
    done,
    new Promise((_, rej) =>
      setTimeout(() => rej(Error("File flow timed out")), 60000).unref(),
    ),
  ]);
  assert.equal(final.state, "completed");
  assert.match(await readFile(join(root, "summary.md"), "utf8"), /Wayland/);
  assert.ok(calls >= 3);
  assert.ok(fragmentCount > 10);
  // Scan the actual Gateway state, generated model configuration and transcripts.
  // Fixture secrets are deliberately recognizable; never put real keys in tests.
  let scannedFiles = 0;
  async function scanSecrets(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scanSecrets(path);
      else if (entry.isFile()) {
        const content = await readFile(path);
        scannedFiles++;
        for (const secret of runtime.secretValues)
          assert.ok(
            !content.includes(Buffer.from(secret)),
            `Credential residue in ${entry.name}`,
          );
      }
    }
  }
  await scanSecrets(join(root, "runtime"));
  assert.ok(scannedFiles > 2);
  assert.equal(
    runtime.safeError(new Error("test " + runtime.testCredential)),
    "test [redacted]",
  );
  const request = (token, tool, path) =>
    new Promise((res, rej) => {
      const s = net.createConnection(socket);
      let b = "";
      s.on("connect", () =>
        s.write(
          JSON.stringify({
            token,
            request: {
              task: "agent:duby:duby:integration",
              id: tool + path,
              tool,
              path,
              content: "DENIED",
            },
          }) + "\n",
        ),
      );
      s.on("data", (c) => {
        b += c;
        if (b.includes("\n")) {
          s.end();
          res(JSON.parse(b));
        }
      });
      s.on("error", rej);
    });
  assert.ok((await request("wrong", "duby_read", "meeting.txt")).error);
  assert.ok((await request("fixture-broker-token", "exec", ".")).error);
  assert.ok(
    (await request("fixture-broker-token", "duby_save", "../outside")).error,
  );
  const evidence = {
    passed: true,
    model: "deterministic streaming fixture; no live provider call",
    gateway: "2026.9.7",
    client: "2026.8.1",
    modelRequests: calls,
    argumentFragments: fragmentCount,
    interleavedToolCalls: true,
    credentialResidueFilesScanned: scannedFiles,
    toolsAdvertised: toolsSeen,
    output: await readFile(join(root, "summary.md"), "utf8"),
    denials: [
      "bad broker authentication",
      "alternate exec tool",
      "out-of-scope write",
    ],
    events: events.map((e) => ({ state: e.state, summary: e.summary })),
  };
  await writeFile(
    "docs/evidence/runtime-file-flow.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "PASS: real Gateway → plugin → Rust broker read/save, fragmented calls and policy denials",
  );
} finally {
  await runtime.shutdown();
  server.close();
  broker.kill();
  await rm(root, { recursive: true, force: true });
}
