import { cp, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const sourceDist = path.resolve(process.argv[2] ?? "");
const outputRoot = path.resolve(process.argv[3] ?? process.cwd());
const repositoryName = "manigarden";
const publicOrigin = "https://edwardchina2023-max.github.io";
const publicBase = `/${repositoryName}`;

if (!sourceDist || !process.argv[2]) {
  throw new Error("Usage: node scripts/export-static.mjs <vinext-dist> [output-root]");
}

const routes = [
  { path: "/", directory: "" },
  { path: "/huang-hai", directory: "huang-hai" },
  { path: "/field", directory: "field" },
  { path: "/library", directory: "library" },
  { path: "/topics", directory: "topics" },
  { path: "/evidence", directory: "evidence" },
  { path: "/letters", directory: "letters" },
  { path: "/about", directory: "about" },
  { path: "/stories/why-yak", directory: "stories/why-yak" },
];

const workerUrl = pathToFileURL(path.join(sourceDist, "server/index.js"));
workerUrl.searchParams.set("static-export", Date.now().toString());
const { default: worker } = await import(workerUrl.href);

function makeStatic(html, routePath) {
  let result = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, "")
    .replace(/\sdata-rsc-css-href=["'][^"']*["']/gi, "")
    .replaceAll(`${publicOrigin}/og.png`, `${publicOrigin}${publicBase}/og.png`)
    .replaceAll("联系入口：筹备中【待填】", "联系入口将在资料征集开放时公布")
    .replaceAll("统一勘误入口：筹备中【待填】", "统一勘误入口将在首发前开放")
    .replaceAll('href="/assets/', `href="${publicBase}/assets/`)
    .replaceAll('src="/assets/', `src="${publicBase}/assets/`)
    .replaceAll('href="/og.png"', `href="${publicBase}/og.png"`)
    .replaceAll('src="/og.png"', `src="${publicBase}/og.png"`)
    .replaceAll('href="/media/', `href="${publicBase}/media/`)
    .replaceAll('src="/media/', `src="${publicBase}/media/`)
    .replaceAll('poster="/media/', `poster="${publicBase}/media/`);

  const linkedRoutes = routes.filter((item) => item.path !== "/").sort((a, b) => b.path.length - a.path.length);
  for (const linked of linkedRoutes) {
    result = result
      .replaceAll(`href="${linked.path}#`, `href="${publicBase}${linked.path}/#`)
      .replaceAll(`href="${linked.path}"`, `href="${publicBase}${linked.path}/"`);
  }
  result = result.replaceAll('href="/"', `href="${publicBase}/"`);

  const canonicalPath = routePath === "/" ? "/" : `${routePath}/`;
  result = result.replace(
    "</head>",
    `<link rel="canonical" href="${publicOrigin}${publicBase}${canonicalPath}"/></head>`,
  );

  return result;
}

async function renderRoute(route) {
  const response = await worker.fetch(
    new Request(`${publicOrigin}${route.path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  if (!response.ok) throw new Error(`Failed to render ${route.path}: ${response.status}`);
  const html = makeStatic(await response.text(), route.path);
  const routeDirectory = path.join(outputRoot, route.directory);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, "index.html"), html, "utf8");
  return html;
}

await mkdir(outputRoot, { recursive: true });
const rendered = [];
for (const route of routes) rendered.push(await renderRoute(route));

await cp(path.join(sourceDist, "client/assets"), path.join(outputRoot, "assets"), { recursive: true });
await cp(path.join(sourceDist, "client/media"), path.join(outputRoot, "media"), { recursive: true });
await cp(path.join(sourceDist, "client/og.png"), path.join(outputRoot, "og.png"));
await writeFile(path.join(outputRoot, ".nojekyll"), "", "utf8");
await writeFile(path.join(outputRoot, "404.html"), rendered[0], "utf8");

console.log(`Exported ${routes.length} routes for ${publicOrigin}${publicBase}/`);
