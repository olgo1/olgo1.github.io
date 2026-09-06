import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.name.toLowerCase().endsWith(".pdf")) files.push(full);
  }
  return files;
}

const groups = [
  { id: "exam-4-5", title: "Из 4 в 5 класс", section: "exams" },
  { id: "exam-5-6", title: "Из 5 в 6 класс", section: "exams" },
  { id: "exam-6-7", title: "Из 6 в 7 класс", section: "exams" },
  { id: "exam-7-8", title: "Из 7 в 8 класс", section: "exams" },
  { id: "exam-8-9", title: "Из 8 в 9 класс", section: "exams" },
  { id: "worksheets-3-6", title: "3–6 классы", section: "worksheets" },
  { id: "algebra-7", title: "7 класс · алгебра", section: "worksheets" },
  { id: "geometry-7", title: "7 класс · геометрия", section: "worksheets" },
  { id: "algebra-8", title: "8 класс · алгебра", section: "worksheets" },
  { id: "algebra-9", title: "9 класс · алгебра", section: "worksheets" },
  { id: "games-files", title: "Математические игры", section: "games" },
  { id: "other", title: "Другие сохранённые материалы", section: "worksheets" },
];

function groupFor(file) {
  const f = file.replaceAll("\\", "/");
  if (f.includes("archive/files/exams-4-to-5/")) return "exam-4-5";
  if (f.includes("archive/files/exams-5-to-6/") || f.includes("grigri/")) return "exam-5-6";
  if (f.includes("archive/files/exams-6-to-7/")) return "exam-6-7";
  if (f.includes("/exams/") || /7_trenexam/.test(f) || f.endsWith("/print.pdf")) return "exam-7-8";
  if (/8_trenexam/.test(f)) return "exam-8-9";
  if (f.includes("archive/files/games/")) return "games-files";
  if (f.includes("/4grade/") || f.endsWith("/4_6_Comba_book.pdf")) return "worksheets-3-6";
  if (f.includes("/7grade/geom_course_2025-26/")) return "geometry-7";
  if (f.includes("/7grade/courses2025-26/")) return "algebra-7";
  if (f.includes("/8grade/")) return "algebra-8";
  if (f.includes("/9grade/")) return "algebra-9";
  return "other";
}

function examTitle(name) {
  const lower = name.toLowerCase();
  const year = name.match(/(?:19|20)\d{2}/)?.[0];
  const variant = name.match(/(?:_v|_var|_)([1234])(?:_|\.|$)/i)?.[1];
  let kind = "Экзаменационная работа";
  if (lower.includes("trenexam")) kind = "Тренировочный экзамен";
  if (lower.includes("olymp")) kind = "Олимпиада";
  if (lower.includes("semestr")) kind = "Семестровая контрольная работа";

  const details = [];
  if (year) details.push(year);
  if (variant) details.push(`вариант ${variant}`);
  if (lower.includes("baza")) details.push("базовый уровень");
  if (lower.includes("hard")) details.push("углублённый уровень");
  if (lower.includes("_ans") || lower.includes("_sol")) details.push("ответы и решения");
  else details.push("задания");
  if (name === "print.pdf") details.push("версия для печати");
  return `${kind} — ${details.join(" · ")}`;
}

function worksheetTitle(file) {
  const name = path.basename(file);
  const lower = name.toLowerCase();
  if (name === "4_6_Comba_book.pdf") return "Комбинаторика. Перебор и подсчёт — теория и 50 задач с ответами";
  if (lower.includes("3_4_ariph_problems_methods_ans")) return "Арифметические задачи: методы решения — с ответами";
  if (lower.includes("3_4_ariph_problems_methods")) return "Арифметические задачи: методы решения — задания";
  if (lower.includes("4_olymp_2010_2020")) return "Олимпиада школы 1514, 2010–2020 — задания и решения";
  if (lower.includes("irrat_numbers_problems")) return "Иррациональные числа — задачи";
  if (lower.includes("irrat_numbers")) return "Иррациональные числа — теория";
  if (lower.includes("alg_001_002")) return "Функции и графики — листки 1–2";

  const lesson = name.match(/(?:alg|geom)_(\d+)/i)?.[1];
  if (lesson) {
    const subject = lower.startsWith("geom") ? "Геометрия" : "Алгебра";
    let type = "задания";
    if (lower.includes("hw_sol")) type = "решения домашней работы";
    else if (lower.includes("_sol")) type = "решения";
    return `${subject}, урок ${Number(lesson)} — ${type}`;
  }
  return examTitle(name);
}

function titleFor(file, group) {
  if (group.startsWith("exam-")) return examTitle(path.basename(file));
  if (group === "games-files") {
    return file.includes("pathfinder") ? "Игра «Следопыт» — правила и раздаточный материал" : "Геометрические разрезания — правила игры";
  }
  return worksheetTitle(file);
}

function hrefFor(file) {
  return "/" + file.split("/").map(encodeURIComponent).join("/");
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const files = (await walk(root)).map(file => path.relative(root, file).replaceAll("\\", "/"));
const records = await Promise.all(files.map(async file => {
  const size = (await stat(path.join(root, file))).size;
  const group = groupFor(file);
  return { file, size, group, title: titleFor(file, group) };
}));

records.sort((a, b) => {
  const ya = Number(a.file.match(/(?:19|20)\d{2}/)?.[0] || 0);
  const yb = Number(b.file.match(/(?:19|20)\d{2}/)?.[0] || 0);
  return yb - ya || a.title.localeCompare(b.title, "ru", { numeric: true });
});

const linkedRecords = records.filter(record => !record.group.startsWith("exam-"));

function renderGroup(group) {
  const items = records.filter(record => record.group === group.id);
  if (!items.length) return "";
  const fileWord = items.length % 10 === 1 && items.length % 100 !== 11
    ? "файл"
    : [2, 3, 4].includes(items.length % 10) && ![12, 13, 14].includes(items.length % 100)
      ? "файла"
      : "файлов";
  const rows = items.map(item => {
    const size = item.size >= 1024 * 1024 ? `${(item.size / 1024 / 1024).toFixed(1)} МБ` : `${Math.round(item.size / 1024)} КБ`;
    return `<li><a href="${hrefFor(item.file)}">${escapeHtml(item.title)}</a><span>PDF · ${size}</span></li>`;
  }).join("\n");
  return `<article class="archive-group" id="${group.id}"><h3>${group.title}<small>${items.length} ${fileWord}</small></h3><ul class="material-list">${rows}</ul></article>`;
}

function renderSection(id, title, description) {
  const content = groups.filter(group => group.section === id).map(renderGroup).join("\n");
  return `<section class="archive-section" id="${id}"><p class="eyebrow">Материалы</p><h2>${title}</h2><p>${description}</p>${content}</section>`;
}

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Учебные материалы по математике школы 1514.">
  <title>Материалы — Математика 1514</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script src="/assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#content">К содержанию</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="/">Математика 1514</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Меню</button><nav class="site-nav" id="site-nav" aria-label="Основная навигация"><a href="/">Главная</a><a href="/pages/grade9/">9 класс</a><a href="/pages/courses26-27/">Курсы 2026–27</a><a href="/pages/mathtrainer/">Тренажёр</a><a href="/archive/" aria-current="page">Материалы</a><a href="/contacts/">Контакты</a></nav></div></header>
  <main class="page" id="content">
    <div class="section-heading"><h1>Материалы</h1><p class="lead">Листочки, решения, игры и материалы курсов.</p></div>
    <nav class="toc" aria-label="Оглавление материалов"><strong>Оглавление</strong><ul><li><a href="#worksheets">Листочки и курсы</a></li><li><a href="#games">Игры</a></li><li><a href="#trainers">Тренажёры</a></li></ul></nav>
    ${renderSection("worksheets", "Листочки и материалы курсов", "Материалы сгруппированы по классу и предмету.")}
    ${renderSection("games", "Математические игры", "Правила и готовые материалы для занятий.")}
    <section class="archive-section" id="trainers"><p class="eyebrow">Практика</p><h2>Тренажёры</h2><article class="archive-group"><ul class="material-list"><li><a href="/train.html">Геометрия — интерактивный тренажёр</a><span>на сайте</span></li><li><a href="https://stepik.org/a/257463/">4 класс: счёт, уравнения, величины и время</a><span>Stepik</span></li></ul></article></section>
  </main>
  <footer class="site-footer"><div class="footer-inner"><span>Математика 1514 · Ольга Морозова</span><div class="footer-links"><a href="/pages/publichnaya-oferta/">Публичная оферта</a><a href="/pages/soglasie-na-obrabotku-personalnyh-dannyh-i-soglasi/">Согласие</a><a href="/pages/politika-konfedencialnosti/">Конфиденциальность</a></div></div></footer>
</body>
</html>`;

await writeFile(path.join(root, "archive", "index.html"), html, "utf8");
console.log(`Materials built: ${linkedRecords.length} linked PDFs; ${records.length} PDFs kept in storage.`);
