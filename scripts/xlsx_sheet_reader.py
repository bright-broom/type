#!/usr/bin/env python3
"""Read an XLSX workbook into plain rows of strings using only the standard library.

Importers need cell text, not a spreadsheet object model, so this reads the OOXML
package directly instead of adding a dependency. Shared strings, inline strings,
and sparse rows are all resolved into dense rows of trimmed text.
"""

from __future__ import annotations

import re
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET
from zipfile import ZipFile

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN, "r": REL}
REL_NS = {"p": PACKAGE_REL}


def column_index(reference: str) -> int:
    """Translate an `A1`-style reference into a zero-based column index."""
    letters = re.match(r"[A-Z]+", reference)
    result = 0
    for char in letters.group(0) if letters else "":
        result = result * 26 + ord(char) - 64
    return result - 1


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    value = cell.find("m:v", NS)
    inline = cell.find("m:is", NS)
    if cell.attrib.get("t") == "s" and value is not None and value.text is not None:
        return shared[int(value.text)]
    if inline is not None:
        return "".join(node.text or "" for node in inline.iter(f"{{{MAIN}}}t"))
    return (value.text or "") if value is not None else ""


def _shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.iter(f"{{{MAIN}}}t"))
        for item in root.findall("m:si", NS)
    ]


def read_sheets(source: Path) -> dict[str, list[list[str]]]:
    """Return `{sheet name: rows}`, each row a dense list of trimmed cell strings.

    Rows keep their workbook order, including blank spacer rows, so callers should
    locate their header row rather than assuming a fixed preamble height.
    """
    sheets: dict[str, list[list[str]]] = {}
    with ZipFile(source) as archive:
        shared = _shared_strings(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {
            item.attrib["Id"]: item.attrib["Target"].lstrip("/")
            for item in relationships.findall("p:Relationship", REL_NS)
        }

        for sheet_node in workbook.find("m:sheets", NS) or []:
            target = targets[sheet_node.attrib[f"{{{REL}}}id"]]
            path = target if target.startswith("xl/") else str(PurePosixPath("xl") / target)
            root = ET.fromstring(archive.read(path))
            rows: list[list[str]] = []
            for row_node in root.findall(".//m:sheetData/m:row", NS):
                cells: dict[int, str] = {}
                for cell in row_node.findall("m:c", NS):
                    cells[column_index(cell.attrib.get("r", "A1"))] = cell_value(cell, shared).strip()
                rows.append([cells.get(index, "") for index in range(max(cells) + 1)] if cells else [])
            sheets[sheet_node.attrib["name"]] = rows
    return sheets
