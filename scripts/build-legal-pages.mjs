import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulesRoot = process.env.CODEX_NODE_MODULES;
if (!modulesRoot) throw new Error("CODEX_NODE_MODULES is required");
const { marked } = await import(pathToFileURL(path.join(modulesRoot, "marked", "lib", "marked.esm.js")));

const pages = {
  "publichnaya-oferta": "Публичная оферта",
  "pravila-dostupa": "Пользовательское соглашение",
  "soglasie-na-obrabotku-personalnyh-dannyh-i-soglasi": "Согласие на обработку персональных данных",
  "politika-konfedencialnosti": "Политика обработки персональных данных",
};

const root = process.cwd();

for (const [slug, title] of Object.entries(pages)) {
  const directory = path.join(root, "pages", slug);
  const markdown = await readFile(path.join(directory, "content.md"), "utf8");
  const body = marked.parse(markdown, { gfm: true });
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${title} — Математика 1514.">
  <title>${title} — Математика 1514</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script src="/assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#content">К содержанию</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="/">Математика 1514</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Меню</button><nav class="site-nav" id="site-nav" aria-label="Основная навигация"><a href="/">Главная</a><a href="/grade9/">9 класс</a><a href="/pages/courses26-27/">Курсы 2026–27</a><a href="/pages/mathtrainer/">Тренажёр</a><a href="/archive/">Архив</a></nav></div></header>
  <main class="page" id="content"><article class="content-shell legal-content"><p class="eyebrow">Документы</p><h1>${title}</h1>${body}</article></main>
  <footer class="site-footer"><div class="footer-inner"><span>Математика 1514 · Ольга Морозова</span><div class="footer-links"><a href="/pages/publichnaya-oferta/">Публичная оферта</a><a href="/pages/pravila-dostupa/">Пользовательское соглашение</a><a href="/pages/soglasie-na-obrabotku-personalnyh-dannyh-i-soglasi/">Согласие</a><a href="/pages/politika-konfedencialnosti/">Конфиденциальность</a></div></div></footer>
</body>
</html>`;
  await writeFile(path.join(directory, "index.html"), html, "utf8");
  console.log(`Built /pages/${slug}/`);
}
