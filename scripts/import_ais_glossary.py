#!/usr/bin/env python3
"""Import the AIS weekly meeting glossary workbook into a de-identified dataset.

Reads the normalised sheets (term master, category master, term-category join,
meeting context, review queue), joins them into one flat entry per term, applies
the de-identification policy, and writes a publication-safe JSON artifact.

The monetary fact sheets (`06_主要数値`, `07_数値-用語リンク`, `11_主要数値_VIEW`)
are intentionally not imported: they are pipeline financials, not vocabulary.

Usage: import_ais_glossary.py <source.xlsx>
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

from ais_glossary_masking import (
    MaskingReport,
    assert_no_leak,
    assign_identities,
    masked_definition,
    sanitize,
)
from ais_glossary_readings import READINGS, pseudonym_reading
from xlsx_sheet_reader import read_sheets

OUTPUT_PATH = Path("src/content/generated/ais-glossary.json")
EXCEL_EPOCH = date(1899, 12, 30)
CONFIDENCE_ORDER = ("確定", "一部要確認", "要確認")
EXPECTED_ENTRY_COUNT = 154


def data_rows(sheets: dict[str, list[list[str]]], name: str, header: str) -> list[list[str]]:
    """Rows below the header row, located by its first column name.

    Each sheet carries a title, a description, and a spacer above the header, so
    anchoring on the header keeps the import stable if that preamble changes.
    """
    rows = sheets[name]
    for index, row in enumerate(rows):
        if row and row[0] == header:
            return [candidate for candidate in rows[index + 1:] if any(candidate)]
    raise SystemExit(f"Sheet {name} has no '{header}' header row")


def cell(row: list[str], index: int) -> str:
    return row[index].strip() if index < len(row) else ""


def read_meeting(sheets: dict[str, list[list[str]]]) -> dict[str, str]:
    rows = data_rows(sheets, "01_会議マスタ", "meeting_id")
    if len(rows) != 1:
        raise SystemExit(f"Expected exactly one meeting row, received {len(rows)}")
    row = rows[0]
    serial = cell(row, 2)
    return {
        "id": cell(row, 0),
        "name": cell(row, 1),
        "date": (EXCEL_EPOCH + timedelta(days=int(serial))).isoformat() if serial.isdigit() else serial,
        "organization": cell(row, 3),
        "sourceType": cell(row, 4),
    }


def read_terms(sheets: dict[str, list[list[str]]]) -> list[dict[str, str]]:
    return [
        {
            "termId": cell(row, 0),
            "term": cell(row, 1),
            "englishName": cell(row, 2),
            "definition": cell(row, 3),
            "termKind": cell(row, 4),
            "confidence": cell(row, 5),
            "reviewState": cell(row, 6),
            "categoryLabel": cell(row, 7),
        }
        for row in data_rows(sheets, "02_用語マスタ", "term_id")
    ]


def read_categories(sheets: dict[str, list[list[str]]]) -> dict[str, list[str]]:
    """Resolve the term-category join into atomic category names per term."""
    names = {cell(row, 0): cell(row, 1) for row in data_rows(sheets, "03_カテゴリマスタ", "category_id")}
    grouped: dict[str, list[str]] = {}
    for row in data_rows(sheets, "04_用語カテゴリ", "term_id"):
        term_id, category_id = cell(row, 0), cell(row, 1)
        if category_id not in names:
            raise SystemExit(f"Unknown category reference: {category_id}")
        grouped.setdefault(term_id, []).append(names[category_id])
    return grouped


def read_contexts(sheets: dict[str, list[list[str]]], meeting_id: str) -> dict[str, str]:
    contexts: dict[str, str] = {}
    for row in data_rows(sheets, "05_会議文脈", "context_id"):
        if cell(row, 1) != meeting_id:
            raise SystemExit(f"Context {cell(row, 0)} references an unknown meeting")
        contexts[cell(row, 2)] = cell(row, 3)
    return contexts


def read_review_queue(sheets: dict[str, list[list[str]]]) -> dict[str, dict[str, str]]:
    reviews: dict[str, dict[str, str]] = {}
    for row in data_rows(sheets, "08_確認キュー", "review_id"):
        term_id = cell(row, 1)
        if term_id:
            reviews[term_id] = {"priority": cell(row, 3), "question": cell(row, 4)}
    return reviews


def build_entries(
    terms: list[dict[str, str]],
    categories: dict[str, list[str]],
    contexts: dict[str, str],
    reviews: dict[str, dict[str, str]],
    report: MaskingReport,
) -> list[dict[str, object]]:
    identities = {identity.term_id: identity for identity in report.identities}
    unused_readings = set(READINGS)
    entries: list[dict[str, object]] = []

    for index, row in enumerate(terms, start=1):
        identity = identities.get(row["termId"])
        if identity:
            term = identity.pseudonym
            reading = pseudonym_reading(identity.pseudonym)
            english_name = "-"
            definition = masked_definition(identity)
        else:
            term = row["term"]
            reading = READINGS.get(term, "")
            if not reading:
                raise SystemExit(f"Missing authored reading for {row['termId']}")
            unused_readings.discard(term)
            english_name = sanitize(row["englishName"], report) or "-"
            definition = sanitize(row["definition"], report)

        review = reviews.get(row["termId"], {})
        entries.append(
            {
                "id": index,
                "termId": row["termId"],
                "term": term,
                "reading": reading,
                "englishName": english_name,
                "definition": definition,
                "meetingContext": sanitize(contexts.get(row["termId"], ""), report),
                "termKind": row["termKind"],
                "confidence": row["confidence"],
                "reviewState": row["reviewState"],
                "categories": categories.get(row["termId"], []),
                "categoryLabel": row["categoryLabel"],
                "reviewPriority": review.get("priority", ""),
                "reviewQuestion": sanitize(review.get("question", ""), report),
                "masked": identity is not None,
            }
        )

    if unused_readings:
        raise SystemExit(f"{len(unused_readings)} authored reading(s) match no term")
    return entries


def build_filters(entries: list[dict[str, object]]) -> dict[str, list[str]]:
    categories = {name for entry in entries for name in entry["categories"]}
    confidence = {str(entry["confidence"]) for entry in entries}
    return {
        "categories": sorted(categories, key=lambda value: (len(value), value)),
        "confidenceLevels": [level for level in CONFIDENCE_ORDER if level in confidence],
        "termKinds": sorted({str(entry["termKind"]) for entry in entries}),
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: import_ais_glossary.py <source.xlsx>")

    sheets = read_sheets(Path(sys.argv[1]).expanduser().resolve())
    meeting = read_meeting(sheets)
    terms = read_terms(sheets)
    report = assign_identities(terms)
    entries = build_entries(
        terms,
        read_categories(sheets),
        read_contexts(sheets, meeting["id"]),
        read_review_queue(sheets),
        report,
    )

    if len(entries) != EXPECTED_ENTRY_COUNT:
        raise SystemExit(f"Expected {EXPECTED_ENTRY_COUNT} terms, received {len(entries)}")

    glossary = {
        "title": "AIS週次定例会議 用語辞典",
        "meeting": meeting,
        "version": 1,
        "stats": {
            "entryCount": len(entries),
            "maskedEntryCount": len(report.identities),
            "reviewQueueCount": sum(1 for entry in entries if entry["reviewPriority"]),
        },
        "masking": {
            "policy": "顧客名・人名は取込時に固定の代替表記へ置換し、金額・件数・割合は非開示マーカーへ置換しています。",
            "redactionCounts": dict(sorted(report.redaction_counts.items())),
        },
        "filters": build_filters(entries),
        "entries": entries,
    }

    payload = json.dumps(glossary, ensure_ascii=False, indent=2)
    assert_no_leak(payload, report)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(f"{payload}\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "entries": len(entries),
                "masked": len(report.identities),
                "redactions": report.redaction_counts,
                "output": str(OUTPUT_PATH),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
