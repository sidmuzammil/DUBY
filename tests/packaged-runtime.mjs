// Check the actual bundled Node and normal dependency tree without paid inference.
// Usage: node tests/packaged-runtime.mjs <extracted-runtime-directory>
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const child = process.argv[2] === "--child";
const root = resolve(process.argv[child ? 3 : 2] || ".artifacts/runtime");
if (!child) {
  const result = spawnSync(
    join(root, "bin/node"),
    [fileURLToPath(import.meta.url), "--child", root],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const { Runtime } = await import(
  pathToFileURL(join(root, "packages/runtime-bridge/index.mjs"))
);
const data = await mkdtemp("/tmp/duby-packaged-runtime-");
const runtime = new Runtime();
try {
  await runtime.init({
    data,
    socket: join(data, "unused.sock"),
    token: "fixture-only",
  });
  const result = await runtime.connect({
    provider: "ollama",
    model: "qwen3:8b",
  });
  if (!result.ready || result.protocol !== 4)
    throw Error("Bundled runtime did not authenticate");
  const report = {
    passed: true,
    ...result,
    bundledNode: process.version,
    liveInference: false,
    environment: "Bundled runtime executed on the host outside PRoot",
  };
  await writeFile(
    "docs/evidence/packaged-runtime.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "PASS bundled Node + OpenClaw Gateway authentication; no inference",
  );
} finally {
  await runtime.shutdown();
  await rm(data, { recursive: true, force: true });
}
