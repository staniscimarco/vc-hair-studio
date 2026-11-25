import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", ".next", "coverage", "public"]);
const suspicious = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?eyJ[A-Za-z0-9_\-.]{20,}/,
  /VAPID_PRIVATE_KEY\s*=\s*['"]?[A-Za-z0-9_\-]{40,}/,
  /RESEND_API_KEY\s*=\s*['"]?re_[A-Za-z0-9]/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const files = await walk(root);
let failed = false;
for (const file of files) {
  if (file.endsWith(".env") || file.endsWith(".env.local")) {
    console.error(`File segreto non ammesso: ${path.relative(root, file)}`);
    failed = true;
    continue;
  }
  if (!/\.(ts|tsx|js|mjs|json|md|sql|yml|yaml|example)$/.test(file)) continue;
  if (file.endsWith(".env.example")) continue;
  const text = await readFile(file, "utf8");
  for (const pattern of suspicious) {
    if (pattern.test(text)) {
      console.error(`Possibile segreto in ${path.relative(root, file)}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log("Nessun segreto evidente nel codice.");
