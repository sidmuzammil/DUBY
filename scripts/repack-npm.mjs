// Reproducible dependency-only security patch of npm's upstream bundled archive.
// OpenClaw source is unchanged. npm is still inaccessible to the model.
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const dir = await mkdtemp("/tmp/duby-npm-patch-");
const run = (cmd, args, cwd = dir) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw Error(r.stderr || `${cmd} failed`);
  return r.stdout;
};
const packages = [
  ["npm", "11.20.0"],
  ["brace-expansion", "5.0.12"],
  ["ip-address", "10.7.2"],
  ["undici", "6.28.1"],
];
const provenance = [];
try {
  for (const [name, version] of packages) {
    const [meta] = JSON.parse(
      run("npm", ["pack", `${name}@${version}`, "--ignore-scripts", "--json"]),
    );
    const archive = await readFile(`${dir}/${meta.filename}`);
    const integrity =
      "sha512-" + createHash("sha512").update(archive).digest("base64");
    if (integrity !== meta.integrity)
      throw Error(`Integrity mismatch for ${name}`);
    const target =
      name === "npm" ? `${dir}/package` : `${dir}/package/node_modules/${name}`;
    if (name !== "npm") await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    run("tar", [
      "-xzf",
      `${dir}/${meta.filename}`,
      "--strip-components=1",
      "-C",
      target,
    ]);
    provenance.push({ name, version, integrity });
  }
  const manifest = JSON.parse(
    await readFile(`${dir}/package/package.json`, "utf8"),
  );
  manifest.version = "11.20.0-duby.1";
  await writeFile(
    `${dir}/package/package.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const vendor = resolve("vendor");
  await mkdir(vendor, { recursive: true });
  const archive = vendor + "/npm-11.20.0-duby.1.tgz";
  run("tar", [
    "--sort=name",
    "--mtime=@0",
    "--owner=0",
    "--group=0",
    "-czf",
    archive,
    "package",
  ]);
  await writeFile(
    vendor + "/npm-patch.json",
    JSON.stringify(
      {
        version: manifest.version,
        changes:
          "Replaced only three bundled dependency directories with patched upstream packages; updated package version. No npm executable source changes.",
        packages: provenance,
        sha256: createHash("sha256")
          .update(await readFile(archive))
          .digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Created", archive);
} finally {
  await rm(dir, { recursive: true, force: true });
}
