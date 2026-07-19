import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? process.cwd());

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target));
    else files.push(target);
  }
  return files;
}

const htmlFiles = (await collect(root)).filter((file) => file.endsWith(".html"));
if (htmlFiles.length !== 9) throw new Error(`Expected 9 HTML files including 404, found ${htmlFiles.length}`);

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (/<script\b|modulepreload|codex-preview|Your site is taking shape/i.test(html)) {
    throw new Error(`Non-static or starter markup found in ${file}`);
  }
  if (!/行路不难/.test(html) || !/\/manigarden\/assets\//.test(html)) {
    throw new Error(`Missing project content or prefixed assets in ${file}`);
  }
  const links = [...html.matchAll(/(?:href|src)="(\/manigarden\/[^"#?]*)/g)].map((match) => match[1]);
  for (const link of links) {
    const relative = link.slice("/manigarden/".length);
    const target = relative === "" || relative.endsWith("/")
      ? path.join(root, relative, "index.html")
      : path.join(root, relative);
    await access(target).catch(() => { throw new Error(`Broken local link ${link} in ${file}`); });
  }
}

console.log(`Validated ${htmlFiles.length} static HTML files and all /manigarden/ links.`);
