// Bundle an ordinary installation, retaining exports, package metadata and licenses.
import { mkdir, cp, writeFile, readFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
const root = resolve(".artifacts/runtime");
await mkdir(root, { recursive: true });
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const dependencies = Object.fromEntries(
  [
    "openclaw",
    "@openclaw/gateway-client",
    "@openclaw/gateway-protocol",
    "zod",
  ].map((n) => [n, pkg.dependencies[n]]),
);
// Use the root lockfile to preserve the exact resolution; npm prunes the unused packages.
await cp("package-lock.json", root + "/package-lock.json");
await cp("package.json", root + "/package.json");
await cp("vendor", root + "/vendor", { recursive: true });
let r = spawnSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: root,
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status || 1);
for (const dir of ["runtime-bridge", "duby-tools"])
  await cp("packages/" + dir, root + "/packages/" + dir, { recursive: true });
await mkdir(root + "/bin", { recursive: true });
await cp(process.execPath, root + "/bin/node");
await chmod(root + "/bin/node", 0o755);
await cp("packaging/NODE-LICENSE.txt", root + "/NODE-LICENSE.txt");
await cp("THIRD_PARTY_NOTICES.md", root + "/THIRD_PARTY_NOTICES.md");
await writeFile(
  root + "/RUNTIME.json",
  JSON.stringify(
    {
      node: process.version,
      openclaw: dependencies.openclaw,
      client: dependencies["@openclaw/gateway-client"],
      protocol: 4,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log("Staged complete Node + OpenClaw installation at", root);
// Preserve the normal installation as one resource. RPM otherwise spends many
// minutes processing tens of thousands of individual package entries.
const archive = resolve(".artifacts/runtime.tar.zst");
r = spawnSync(
  "tar",
  [
    "--zstd",
    "--sort=name",
    "--mtime=@0",
    "--owner=0",
    "--group=0",
    "-cf",
    archive,
    "-C",
    root,
    ".",
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status || 1);
const digest = createHash("sha256");
for await (const chunk of createReadStream(archive)) digest.update(chunk);
await writeFile(
  resolve(".artifacts/runtime-manifest.json"),
  JSON.stringify(
    {
      format: 1,
      sha256: digest.digest("hex"),
      node: process.version,
      openclaw: dependencies.openclaw,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Archived complete runtime for local, checksum-verified extraction",
);
