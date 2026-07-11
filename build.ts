const DIST = import.meta.dirname + "/dist";

try { await Deno.mkdir(DIST, { recursive: true }); } catch { /* exists */ }

// Copy static assets
const staticFiles = [
  "styles.css",
  "main.js",
];

for (const f of staticFiles) {
  await Deno.copyFile(`${import.meta.dirname}/${f}`, `${DIST}/${f}`);
}

// Copy HTML pages
for (const name of [
  "index", "how-it-works", "docs", "get-started", "marketplace",
  "trust", "security", "workload-identity", "gateway", "about", "request-compute"
]) {
  const src = `${import.meta.dirname}/${name}.html`;
  const dst = `${DIST}/${name}.html`;
  try { await Deno.copyFile(src, dst); } catch (e) { console.warn(`skip ${name}.html: ${e.message}`); }
}

// Copy components directory (recursive)
async function copyDir(src, dst) {
  await Deno.mkdir(dst, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const srcPath = `${src}/${entry.name}`;
    const dstPath = `${dst}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDir(srcPath, dstPath);
    } else if (entry.isFile) {
      await Deno.copyFile(srcPath, dstPath);
    }
  }
}
await copyDir(`${import.meta.dirname}/components`, `${DIST}/components`);

console.log("Build complete → dist/");
