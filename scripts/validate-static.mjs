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
if (htmlFiles.length !== 17) throw new Error(`Expected 17 HTML files including 404, found ${htmlFiles.length}`);

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (/<script\b|modulepreload|codex-preview|Your site is taking shape/i.test(html)) {
    throw new Error(`Non-static or starter markup found in ${file}`);
  }
  if (!/麦尼海塘/.test(html) || !/\/manigarden\/assets\//.test(html)) {
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

const homepage = await readFile(path.join(root, "index.html"), "utf8");
if (!/\/manigarden\/media\/video\/herd-home\.mp4/.test(homepage)) {
  throw new Error("Homepage is missing the prefixed documentary hero video");
}
await access(path.join(root, "field", "index.html"));
await access(path.join(root, "diary", "index.html"));
await access(path.join(root, "archive", "index.html"));
await access(path.join(root, "series", "index.html"));
await access(path.join(root, "stories", "cordyceps", "index.html"));
await access(path.join(root, "stories", "qingming", "index.html"));
await access(path.join(root, "reports", "life-is-wilderness", "index.html"));
await access(path.join(root, "reports", "ideatopia-interview", "index.html"));
await access(path.join(root, "media", "audio", "why-matsutake-excerpt.m4a"));
await access(path.join(root, "media", "brand", "mani-garden-wordmark.png"));
for (const video of ["snow-road", "wildflower", "search-cordyceps", "calf-steps", "calf-portrait", "herd-home", "yak-portrait"]) {
  await access(path.join(root, "media", "video", `${video}.mp4`));
}
await access(path.join(root, "media", "archive", "video", "snow-pasture.mp4"));

if (!/\/manigarden\/media\/archive\/video\/snow-pasture\.mp4/.test(homepage)) {
  throw new Error("Homepage is missing the featured Snowy Pasture film");
}

const library = await readFile(path.join(root, "library", "index.html"), "utf8");
if (!/第三方报道/.test(library) || !/\/manigarden\/reports\/life-is-wilderness\//.test(library)) {
  throw new Error("Library is missing designed third-party report pages");
}
if (/\.pdf|\/media\/reports\//i.test(library)) {
  throw new Error("Library must not expose PDF files");
}

console.log(`Validated ${htmlFiles.length} static HTML files and all /manigarden/ links.`);
