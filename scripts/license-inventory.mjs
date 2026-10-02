import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const entries = [];
for (const [location, meta] of Object.entries(lock.packages)) {
  if (!location) continue;
  const p = path.join(location, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    pkg = meta;
  }
  let license =
    pkg.license ||
    pkg.licenses?.map((x) => x.type).join(" OR ") ||
    meta.license;
  let licenseEvidence;
  if (!license) {
    const notice = path.join(location, "LICENSE");
    if (
      fs.existsSync(notice) &&
      /Apache License\s+Version 2\.0/.test(fs.readFileSync(notice, "utf8"))
    ) {
      license = "Apache-2.0";
      licenseEvidence = notice;
    }
  }
  entries.push({
    name: pkg.name || location.split("node_modules/").at(-1),
    version: meta.version,
    license: license || "Review upstream notice",
    ...(licenseEvidence ? { licenseEvidence } : {}),
    developmentOnly: !!meta.dev,
  });
}
fs.writeFileSync(
  "docs/dependency-licenses.json",
  JSON.stringify(
    entries.sort((a, b) => a.name.localeCompare(b.name)),
    null,
    2,
  ) + "\n",
);
console.log("Recorded", entries.length, "package license entries");
