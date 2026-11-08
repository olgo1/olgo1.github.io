"""Build the grade 6 series plan in the style of the grade 7 programme."""

from __future__ import annotations

import calendar
import html
import json
import re
from datetime import date, timedelta
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/mathtrainer/6program.md"
OUTPUT = ROOT / "archive/files/mathtrainer/6program.pdf"
QA = ROOT / "tmp/pdfs/grade6-program"
START = date(2026, 11, 3)
END = date(2027, 5, 20)
BREAK_START = date(2026, 12, 31)
BREAK_END = date(2027, 1, 10)
TINTS = ["#E4EFFA", "#DDF2ED", "#EEE7FA", "#FFF0D8", "#FBE3EB", "#E7EEF2"]
MONTHS = [
    "",
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
]


def lesson_word(number):
    if 11 <= number % 100 <= 14:
        return "уроков"
    return "урок" if number % 10 == 1 else "урока" if number % 10 in (2, 3, 4) else "уроков"


def load_program():
    source = SOURCE.read_text(encoding="utf-8")
    sections = re.findall(r"^## Модуль (\d+)\. ([^\n]+)\n(.*?)(?=^## |\Z)", source, re.M | re.S)
    modules = []
    cursor = START
    for (number, title, body), tint in zip(sections, TINTS, strict=True):
        topics = [
            (title, int(count))
            for title, count in re.findall(r"^\| \d+ \| (.+) \| (\d+) \|$", body, re.M)
        ]
        lesson_titles = {
            int(n): title for n, title in re.findall(r"^- (\d+)\. (.+)$", body, re.M)
        }
        dates = []
        while len(dates) < sum(count for _, count in topics):
            if cursor.weekday() < 5 and not BREAK_START <= cursor <= BREAK_END:
                dates.append(cursor)
            cursor += timedelta(days=1)
        modules.append(
            dict(
                number=int(number),
                title=title,
                topics=topics,
                lesson_titles=lesson_titles,
                tint=tint,
                dates=dates,
                count=len(dates),
                first=dates[0],
                last=dates[-1],
            )
        )
    assert [m["number"] for m in modules] == list(range(2, 8))
    assert list(modules[0]["lesson_titles"]) == [6, 7, 8, 9]
    assert sum(m["count"] for m in modules[:-1]) == 120
    assert sum(len(m["topics"]) for m in modules[:-1]) == 24
    assert modules[-2]["topics"] == [("Координатная плоскость", 6)]
    assert modules[-1]["count"] == 16
    assert modules[-1]["first"] == date(2027, 4, 29)
    assert modules[-1]["last"] == END
    assert sum(m["count"] for m in modules) == 136
    return modules


def topic_rows(module):
    if module["number"] != 2:
        return [
            (n, f"{topic} - {count} {lesson_word(count)}")
            for n, (topic, count) in enumerate(module["topics"], 1)
        ]
    rows = []
    lesson_number = 1
    for topic, count in module["topics"]:
        if lesson_number in module["lesson_titles"]:
            rows.extend(
                (n, module["lesson_titles"][n])
                for n in range(lesson_number, lesson_number + count)
            )
        else:
            rows.append((lesson_number, f"{topic} - {count} {lesson_word(count)}"))
        lesson_number += count
    assert [n for n, _ in rows] == [1, 6, 7, 8, 9, 10, 15, 18, 22]
    return rows


def main():
    modules = load_program()
    for name, filename in [("Plain", "arial.ttf"), ("Plain-Bold", "arialbd.ttf")]:
        pdfmetrics.registerFont(TTFont(name, str(Path("C:/Windows/Fonts") / filename)))
    pdfmetrics.registerFontFamily(
        "Plain", normal="Plain", bold="Plain-Bold", italic="Plain", boldItalic="Plain-Bold"
    )
    title_style = ParagraphStyle(
        "Title", fontName="Plain-Bold", fontSize=17, leading=21, spaceAfter=9
    )
    heading_style = ParagraphStyle("Module", fontName="Plain-Bold", fontSize=12.5, leading=16)
    topic_style = ParagraphStyle(
        "Topic",
        fontName="Plain",
        fontSize=10.8,
        leading=14.5,
        leftIndent=21,
        bulletIndent=0,
        bulletFontName="Plain",
        bulletFontSize=10.8,
        spaceAfter=4.5,
    )

    class SimpleCalendar(Flowable):
        def wrap(self, available_width, available_height):
            self.width, self.height = available_width, 281
            return self.width, self.height

        def draw(self):
            c = self.canv
            gap = 12
            block_w = (self.width - 3 * gap) / 4
            block_h = 133
            months = [(2026, 11), (2026, 12), (2027, 1), (2027, 2), (2027, 3), (2027, 4), (2027, 5)]
            for index, (year, month) in enumerate(months):
                x = index % 4 * (block_w + gap)
                top = self.height - index // 4 * (block_h + 14)
                c.setFillColor(colors.black)
                c.setFont("Plain-Bold", 9.2)
                c.drawString(x, top - 11, f"{MONTHS[month]} {year}")
                cell_w, row_h = block_w / 7, 15.5
                for col, label in enumerate(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]):
                    c.setFont("Plain", 6.8)
                    c.setFillColor(colors.HexColor("#505050"))
                    c.drawCentredString(x + (col + 0.5) * cell_w, top - 29, label)
                first, count = calendar.monthrange(year, month)
                for day in range(1, count + 1):
                    d = date(year, month, day)
                    row, col = divmod(first + day - 1, 7)
                    xx, yy = x + col * cell_w, top - 36 - row * row_h
                    active = next((m for m in modules if m["first"] <= d <= m["last"]), None)
                    holiday = BREAK_START <= d <= BREAK_END
                    tint = "#E8E8E8" if holiday else active["tint"] if active else None
                    if tint:
                        c.setFillColor(colors.HexColor(tint))
                        c.rect(
                            xx + 0.25, yy - row_h + 0.5, cell_w - 0.5, row_h - 0.8, fill=1, stroke=0
                        )
                    c.setFillColor(
                        colors.HexColor("#606060") if col >= 5 or holiday else colors.black
                    )
                    c.setFont("Plain", 8.1)
                    c.drawCentredString(xx + cell_w / 2, yy - 10.7, str(day))

    class ModuleHeading(Flowable):
        def __init__(self, title, tint):
            super().__init__()
            self.tint = tint
            self.keepWithNext = True
            self.spaceBefore, self.spaceAfter = 12, 6
            self.paragraph = Paragraph(html.escape(title), heading_style)

        def wrap(self, available_width, available_height):
            self.width = available_width
            _, height = self.paragraph.wrap(available_width - 16, available_height)
            self.height = height + 13
            return self.width, self.height

        def draw(self):
            self.canv.setFillColor(colors.HexColor(self.tint))
            self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)
            self.paragraph.drawOn(self.canv, 8, 6.5)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=43,
        leftMargin=43,
        topMargin=39,
        bottomMargin=39,
        title="Программа тренажёра для 6 класса",
        author="",
        pageCompression=1,
    )
    story = [
        Paragraph("Программа тренажёра для 6 класса", title_style),
        SimpleCalendar(),
        Spacer(1, 1),
    ]
    story.append(ModuleHeading("Модуль 1. Повторение материала 5 класса", "#F8E3D6"))
    for index, m in enumerate(modules):
        if index == 2:
            story.append(PageBreak())
        story.append(ModuleHeading(f"Модуль {m['number']}. {m['title']}", m["tint"]))
        for n, topic in topic_rows(m):
            story.append(
                Paragraph(
                    html.escape(topic),
                    topic_style,
                    bulletText=f"{n}.",
                )
            )
    doc.build(story)
    reader = PdfReader(OUTPUT)
    content = "\n".join(p.extract_text() for p in reader.pages)
    normalized = re.sub(r"\s+", " ", content)
    assert len(reader.pages) == 2, len(reader.pages)
    for m in modules:
        assert f"Модуль {m['number']}. {m['title']}" in normalized
        for n, topic in topic_rows(m):
            assert f"{n}. {topic}" in normalized
    assert "9. Решение уравнений" in normalized
    assert "Модуль 7. Повторение" in normalized
    assert "Сборные (из разных тем) листочки - 16 уроков" in normalized
    assert "Итоговое повторение и закрепление" not in normalized
    assert not re.search(r"\d{2}\.\d{2}\.\d{4}", content)
    for unwanted in ("Всего:", "Разделы программы", "в неделю", "включительно", "с перерывом"):
        assert unwanted not in content
    report = {
        "output": str(OUTPUT),
        "pages": len(reader.pages),
        "topics": 25,
        "lessons": 136,
        "break_start": str(BREAK_START),
        "break_end": str(BREAK_END),
        "start": str(START),
        "end": str(END),
        "modules": [{k: m[k] for k in ("number", "count", "first", "last")} for m in modules],
    }
    (QA / "verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
