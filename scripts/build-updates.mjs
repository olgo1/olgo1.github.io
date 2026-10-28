import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const homePath = new URL("index.html", root);
const entries = JSON.parse(await readFile(new URL("data/updates.json", root), "utf8"));
const homeLimit = 3;

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

for (const entry of entries) {
  const date = new Date(`${entry.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date) {
    throw new Error(`Invalid update date: ${entry.date}`);
  }
  if (!Array.isArray(entry.segments) || entry.segments.length === 0) throw new Error("An update needs text");
  for (const segment of entry.segments) {
    if (typeof segment.text !== "string") throw new Error("An update segment needs text");
    if (segment.href !== undefined && (typeof segment.href !== "string" || !segment.href.startsWith("/") || segment.href.startsWith("//"))) {
      throw new Error("Update links must point to this site");
    }
  }
}

// ISO dates sort newest first; entries with the same date keep their source order.
entries.sort((a, b) => b.date.localeCompare(a.date));
const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function renderEntry(entry) {
  const [year, month, day] = entry.date.split("-").map(Number);
  const dateLabel = `${day} ${months[month - 1]} ${year}`;
  const content = entry.segments.map(segment => segment.href
    ? `<a href="${escapeHtml(segment.href)}">${escapeHtml(segment.text)}</a>`
    : escapeHtml(segment.text)).join("");
  return `        <article class="news-item">\n          <p><time datetime="${entry.date}">${dateLabel}</time> — ${content}</p>\n        </article>`;
}

const home = await readFile(homePath, "utf8");
const sectionPattern = /    <section class="section" aria-labelledby="updates-title">[\s\S]*?<\/section>/;
if (!sectionPattern.test(home)) throw new Error("Home page updates section not found");
const latestSection = `    <section class="section" aria-labelledby="updates-title">
      <!-- Generated from data/updates.json by scripts/build-updates.mjs; latest ${homeLimit} only. -->
      <div class="section-heading"><h2 id="updates-title">Обновления</h2></div>
      <div class="news-list">
${entries.slice(0, homeLimit).map(renderEntry).join("\n")}
      </div>
      <p><a href="/updates/">Все обновления</a></p>
    </section>`;

const header = home.match(/  <header class="site-header">[\s\S]*?<\/header>/)?.[0].replace('href="/" aria-current="page"', 'href="/"');
const footer = home.match(/  <footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
if (!header || !footer) throw new Error("Home page layout not found");
const archive = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Все обновления сайта «Математика 1514»: новые листочки, задания и учебные материалы.">
  <title>Все обновления — Математика 1514</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script src="/assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#content">К содержанию</a>
${header}
  <main class="page" id="content">
    <!-- Generated from data/updates.json by scripts/build-updates.mjs; full history. -->
    <div class="section-heading"><h1>Все обновления</h1></div>
    <div class="news-list">
${entries.map(renderEntry).join("\n")}
    </div>
    <p><a href="/">На главную</a></p>
  </main>
${footer}
</body>
</html>
`;

await mkdir(new URL("updates/", root), { recursive: true });
await writeFile(new URL("updates/index.html", root), archive, "utf8");
await writeFile(homePath, home.replace(sectionPattern, latestSection), "utf8");
console.log(`Updates built: ${Math.min(homeLimit, entries.length)} on home, ${entries.length} in ${fileURLToPath(new URL("updates/index.html", root))}`);
