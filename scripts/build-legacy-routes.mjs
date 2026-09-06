import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const routes = {
  "pages/listochki": ["/archive/#worksheets", "Листочки перенесены в материалы"],
  "pages/exams-1514": ["/archive/#exam-4-5", "Экзамены прошлых лет"],
  "pages/ekzamen-iz-4-v-5-klass": ["/archive/#exam-4-5", "Экзамены из 4 в 5 класс"],
  "pages/ekzamen-iz-5-v-6-klass": ["/archive/#exam-5-6", "Экзамены из 5 в 6 класс"],
  "pages/ekzamen-iz-6-v-7-klass": ["/archive/#exam-6-7", "Экзамены из 6 в 7 класс"],
  "pages/ekzamen-iz-7-v-8-klass": ["/archive/#exam-7-8", "Экзамены из 7 в 8 класс"],
  "pages/algebra-9-matklass": ["/grade9/", "Алгебра, 9 класс"],
  "pages/algebra-8-matklass-20252026": ["/archive/#algebra-8", "Алгебра, 8 класс"],
  "pages/kruzhok-5-klass-20252026": ["/archive/#worksheets", "Кружок по математике, 5 класс"],
  "pages/4-klass": ["/archive/#worksheets-3-6", "Материалы для 4 класса"],
  "pages/igry": ["/archive/#games", "Математические игры"],
  "pages/trainer": ["/archive/#trainers", "Старые тренажёры"],
  "pages/trenazhyor-4-klass": ["/archive/#trainers", "Тренажёр 4 класса"],
  "pages/trenazhyor-5-klass": ["/archive/#trainers", "Тренажёр 5 класса"],
  "pages/trenazhyor-6-klass": ["/archive/#trainers", "Тренажёр 6 класса"],
  "pages/leto-1514-modul-5": ["/archive/#worksheets", "Летние занятия 1514"],
  "courses/4-klass": ["/archive/#trainers", "Старый курс 4 класса"],
  "courses/5-klass": ["/archive/#trainers", "Старый курс 5 класса"],
  "courses/6-klass": ["/archive/#trainers", "Старый курс 6 класса"],
  "courses/7-klass": ["/archive/#trainers", "Старый курс 7 класса"],
  "obo-mne": ["/", "О сайте"],
  "ekspress-kursy-4-kl": ["/archive/#worksheets", "Экспресс-курсы 4 класса"],
  "trenirovochnyi-ekzamen-4-kl": ["/archive/#exam-4-5", "Тренировочный экзамен 4 класса"],
  "2024-2025-uch-god": ["/archive/#worksheets", "Материалы 2024–2025 учебного года"],
};

for (const [route, [target, title]] of Object.entries(routes)) {
  const directory = path.join(process.cwd(), route);
  await mkdir(directory, { recursive: true });
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"><title>${title} — Математика 1514</title><link rel="stylesheet" href="/assets/styles.css"></head><body><main class="page empty-state"><div><p class="eyebrow">Старая страница</p><h1>${title}</h1><p>Материалы перенесены. <a href="${target}">Открыть новый раздел →</a></p></div></main></body></html>`;
  await writeFile(path.join(directory, "index.html"), html, "utf8");
}

console.log(`Built ${Object.keys(routes).length} legacy routes.`);
