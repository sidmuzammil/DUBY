// Exercise the exact stdio boundary used by Rust, not just Runtime class calls.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(process.argv[2] || ".artifacts/runtime");
const data = await mkdtemp("/tmp/duby-stdio-");
const child = spawn(
  join(root, "bin/node"),
  [join(root, "packages/runtime-bridge/index.mjs")],
  { stdio: ["pipe", "pipe", "inherit"] },
);
const pending = new Map();
createInterface({ input: child.stdout }).on("line", (line) => {
  const message = JSON.parse(line),
    callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    callback(message);
  }
});
const request = (method, args) =>
  new Promise((res, rej) => {
    const id = method;
    const timeout = setTimeout(() => {
      pending.delete(id);
      rej(Error("Stdio request timed out: " + method));
    }, 90000);
    pending.set(id, (message) => {
      clearTimeout(timeout);
      message.error ? rej(Error(message.error)) : res(message.result);
    });
    child.stdin.write(JSON.stringify({ id, method, args }) + "\n");
  });
try {
  await request("init", {
    data,
    socket: join(data, "unused.sock"),
    token: "fixture-only",
  });
  const result = await request("connect", {
    provider: "ollama",
    model: "qwen3:8b",
  });
  assert.equal(result.ready, true);
  assert.equal(result.protocol, 4);
  await request("shutdown", {});
  await writeFile(
    "docs/evidence/runtime-stdio.json",
    JSON.stringify(
      {
        passed: true,
        protocol: 4,
        boundary: "Bundled Node stdio init/connect/shutdown, as used by Rust",
        liveInference: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS native-style stdio lifecycle with bundled Node and real Gateway",
  );
} finally {
  child.stdin.end();
  child.kill("SIGTERM");
  await rm(data, { recursive: true, force: true });
}
