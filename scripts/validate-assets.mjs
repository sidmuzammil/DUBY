import fs from "node:fs";
import { validateBytes } from "gltf-validator";
const bytes = fs.readFileSync("assets/duby/duby.glb");
const report = await validateBytes(bytes, { uri: "duby.glb" });
const length = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
const names = gltf.animations?.map((a) => a.name) || [];
if (
  report.issues.numErrors ||
  names.length !== 12 ||
  !gltf.skins?.length ||
  bytes.length > 5000000
)
  throw Error(
    JSON.stringify({
      issues: report.issues,
      names,
      skins: gltf.skins?.length,
      bytes: bytes.length,
    }),
  );
const evidence = {
  validator: report.validatorVersion,
  errors: report.issues.numErrors,
  warnings: report.issues.numWarnings,
  bytes: bytes.length,
  animations: names,
  skins: gltf.skins.length,
  meshes: gltf.meshes.length,
  triangles: gltf.meshes
    .flatMap((m) => m.primitives)
    .reduce(
      (n, p) =>
        n +
        (p.indices === undefined
          ? gltf.accessors[p.attributes.POSITION].count
          : gltf.accessors[p.indices].count) /
          3,
      0,
    ),
};
fs.mkdirSync("docs/evidence", { recursive: true });
fs.writeFileSync(
  "docs/evidence/gltf-validation.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(evidence);
