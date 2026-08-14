#!/usr/bin/env python3
"""Import every populated XLSX cell into TypeLoop's local playbook dataset."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET
from zipfile import ZipFile

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN, "r": REL}
REL_NS = {"p": PACKAGE_REL}


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        return 0
    result = 0
    for char in letters.group(0):
        result = result * 26 + ord(char) - 64
    return result - 1


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    value = cell.find("m:v", NS)
    inline = cell.find("m:is", NS)
    kind = cell.attrib.get("t")
    if kind == "s" and value is not None and value.text is not None:
        return shared[int(value.text)]
    if inline is not None:
        return "".join(node.text or "" for node in inline.iter(f"{{{MAIN}}}t"))
    if value is None:
        return ""
    if kind == "b":
        return "TRUE" if value.text == "1" else "FALSE"
    return value.text or ""


def normalize_typing_target(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    normalized = normalized.replace("&", " and ").replace("+", " plus ")
    normalized = re.sub(r"[^a-z0-9' -]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" -")
    return normalized


def candidate_score(value: str, column: int) -> float:
    if len(value) < 2 or len(value) > 72:
        return -1
    ascii_letters = len(re.findall(r"[A-Za-z]", value))
    visible = len(re.sub(r"\s", "", value))
    if ascii_letters == 0 or visible == 0:
        return -1
    target = normalize_typing_target(value)
    if len(target) < 2 or len(target) > 54:
        return -1
    ratio = ascii_letters / visible
    return ratio * 100 - len(target) * 0.15 - column * 0.25


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: import_consulting_playbook.py <source.xlsx>")

    source = Path(sys.argv[1]).expanduser().resolve()
    output_json = Path("src/content/generated/consulting-playbook.json")
    output_prompts = Path("src/content/generated/consulting-prompts.json")
    sheets: list[dict[str, object]] = []

    with ZipFile(source) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [
                "".join(node.text or "" for node in item.iter(f"{{{MAIN}}}t"))
                for item in root.findall("m:si", NS)
            ]

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall("p:Relationship", REL_NS)
        }

        for sheet_number, sheet_node in enumerate(workbook.find("m:sheets", NS) or [], 1):
            name = sheet_node.attrib["name"]
            target = relationship_map[sheet_node.attrib[f"{{{REL}}}id"]].lstrip("/")
            sheet_path = target if target.startswith("xl/") else str(PurePosixPath("xl") / target)
            root = ET.fromstring(archive.read(sheet_path))
            imported_rows: list[dict[str, object]] = []
            max_column = 0

            for row_node in root.findall(".//m:sheetData/m:row", NS):
                cells: list[dict[str, str | int]] = []
                for cell in row_node.findall("m:c", NS):
                    value = cell_value(cell, shared)
                    formula_node = cell.find("m:f", NS)
                    formula = formula_node.text if formula_node is not None else ""
                    if value == "" and formula == "":
                        continue
                    column = column_index(cell.attrib.get("r", "A1"))
                    max_column = max(max_column, column + 1)
                    imported: dict[str, str | int] = {"column": column, "value": value}
                    if formula:
                        imported["formula"] = formula
                    cells.append(imported)
                if cells:
                    imported_rows.append({"index": int(row_node.attrib["r"]), "cells": cells})

            sheets.append(
                {
                    "id": f"sheet-{sheet_number:02d}",
                    "name": name,
                    "rowCount": len(imported_rows),
                    "columnCount": max_column,
                    "rows": imported_rows,
                }
            )

    nonempty_cells = sum(len(row["cells"]) for sheet in sheets for row in sheet["rows"])
    formula_cells = sum(
        1
        for sheet in sheets
        for row in sheet["rows"]
        for cell in row["cells"]
        if "formula" in cell
    )
    payload = {
        "source": source.name,
        "version": 1,
        "stats": {
            "sheetCount": len(sheets),
            "rowCount": sum(sheet["rowCount"] for sheet in sheets),
            "nonemptyCellCount": nonempty_cells,
            "formulaCellCount": formula_cells,
        },
        "sheets": sheets,
    }

    dictionary = next(sheet for sheet in sheets if sheet["name"] == "07_コンサル用語辞書")
    prompts: list[dict[str, object]] = []
    seen_targets: set[str] = set()
    header_words = {"term", "title", "category", "english", "consulting dictionary"}

    for row in dictionary["rows"]:
        candidates = []
        for cell in row["cells"]:
            value = str(cell["value"]).strip()
            score = candidate_score(value, int(cell["column"]))
            if score >= 0:
                candidates.append((score, value, int(cell["column"])))
        if not candidates:
            continue
        _, display, selected_column = max(candidates, key=lambda item: item[0])
        target = normalize_typing_target(display)
        if target in seen_targets or target in header_words:
            continue
        seen_targets.add(target)
        context_values = [
            str(cell["value"]).strip()
            for cell in row["cells"]
            if int(cell["column"]) != selected_column and str(cell["value"]).strip()
        ]
        description = max(context_values, key=len, default="")
        prompts.append(
            {
                "id": f"consulting-{int(row['index']):03d}",
                "displayText": display,
                "reading": target,
                "category": "consulting",
                "difficulty": min(5, max(1, (len(target) + 7) // 8)),
                "tags": ["consulting", f"source-row-{int(row['index'])}"],
                "description": description[:240],
            }
        )

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    prompt_json = json.dumps(prompts, ensure_ascii=False, indent=2)
    output_prompts.parent.mkdir(parents=True, exist_ok=True)
    output_prompts.write_text(prompt_json + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "sheets": len(sheets),
                "rows": payload["stats"]["rowCount"],
                "cells": nonempty_cells,
                "formulas": formula_cells,
                "typingPrompts": len(prompts),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
