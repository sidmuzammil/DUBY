import { Runtime } from "../packages/runtime-bridge/index.mjs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const data = await mkdtemp(join(tmpdir(), "duby-runtime-"));
const runtime = new Runtime((e) => console.log("event", e.state, e.summary));
try {
  await runtime.init({
    data,
    socket: join(data, "broker.sock"),
    token: "test-only-not-a-credential",
  });
  const result = await runtime.connect({
    provider: "ollama",
    model: "qwen3:8b",
  });
  console.log(JSON.stringify(result));
  await writeFile(
    "docs/evidence/runtime-handshake.json",
    JSON.stringify(
      {
        ...result,
        node: process.version,
        client: "2026.8.1",
        gateway: "2026.9.7",
        liveInference: "not run",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await runtime.shutdown();
  await rm(data, { recursive: true, force: true });
}
