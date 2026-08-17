#!/usr/bin/env python3
"""De-identification policy for the AIS weekly meeting glossary.

The workbook is meeting minutes: it names customers, individuals, and pipeline
figures. The published bundle must not carry any of it, so masking happens at
import time and the generated artifact is the already-safe form.

The policy is driven by the workbook's own `種別` column rather than a hard-coded
list of names, so no confidential name is written into this repository. Every
substitution and redaction is reported back to the importer for the audit trail.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# `種別` values whose display name identifies a real party, mapped to the label
# family used in their place.
PSEUDONYM_FAMILY_BY_TERM_KIND: dict[str, str] = {
    "顧客名": "顧客",
    "人名": "担当者",
}

# A proper noun filed under a customer/deal category is treated as a customer
# even when `種別` is the generic `固有名詞`.
CUSTOMER_CATEGORY_MARKER = "顧客"
GENERIC_PROPER_NOUN_KIND = "固有名詞"

# Figures quoted from the meeting: amounts, deal counts, and probability deltas.
REDACTION_RULES: tuple[tuple[str, str, str], ...] = (
    ("amount", r"約?[0-9][0-9,]*(?:\.[0-9]+)?(?:億|万)?円", "（金額非開示）"),
    ("count", r"約?[0-9][0-9,]*件", "（件数非開示）"),
    ("ratio", r"[0-9]+(?:\.[0-9]+)?\s*[%％]", "（割合非開示）"),
)

HONORIFIC_SUFFIXES = ("さん", "氏", "様")


@dataclass
class MaskedIdentity:
    """One real party replaced by a stable pseudonym."""

    term_id: str
    pseudonym: str
    term_kind: str
    category_label: str
    aliases: tuple[str, ...]


@dataclass
class MaskingReport:
    """Audit trail returned to the importer."""

    identities: list[MaskedIdentity] = field(default_factory=list)
    redaction_counts: dict[str, int] = field(default_factory=dict)

    def count(self, rule: str) -> None:
        self.redaction_counts[rule] = self.redaction_counts.get(rule, 0) + 1


def pseudonym_family(term_kind: str, category_label: str) -> str | None:
    """Return the pseudonym family for a term, or None when it may stay as-is."""
    family = PSEUDONYM_FAMILY_BY_TERM_KIND.get(term_kind)
    if family:
        return family
    if term_kind == GENERIC_PROPER_NOUN_KIND and CUSTOMER_CATEGORY_MARKER in category_label:
        return PSEUDONYM_FAMILY_BY_TERM_KIND["顧客名"]
    return None


def _aliases(term: str, english_name: str) -> tuple[str, ...]:
    """Every spelling of a party that must disappear from the output."""
    candidates = {term, english_name}
    for suffix in HONORIFIC_SUFFIXES:
        if term.endswith(suffix):
            candidates.add(term[: -len(suffix)])
    return tuple(
        sorted(
            (value for value in candidates if value and value != "-"),
            key=len,
            reverse=True,
        )
    )


def assign_identities(rows: list[dict[str, str]]) -> MaskingReport:
    """Assign `顧客A`-style pseudonyms in stable term_id order."""
    report = MaskingReport()
    counters: dict[str, int] = {}
    for row in rows:
        family = pseudonym_family(row["termKind"], row["categoryLabel"])
        if not family:
            continue
        index = counters.get(family, 0)
        if index >= 26:
            raise SystemExit(f"More than 26 masked parties in family: {family}")
        counters[family] = index + 1
        report.identities.append(
            MaskedIdentity(
                term_id=row["termId"],
                pseudonym=f"{family}{chr(ord('A') + index)}",
                term_kind=row["termKind"],
                category_label=row["categoryLabel"],
                aliases=_aliases(row["term"], row["englishName"]),
            )
        )
    return report


def masked_definition(identity: MaskedIdentity) -> str:
    return (
        f"{identity.term_kind}に該当するため、公開ビルドでは実名を伏せています"
        f"（元カテゴリ: {identity.category_label}）。"
    )


def redact_figures(text: str, report: MaskingReport) -> str:
    """Replace quoted amounts, counts, and ratios with non-disclosure markers."""
    for rule, pattern, replacement in REDACTION_RULES:
        text, replaced = re.subn(pattern, replacement, text)
        for _ in range(replaced):
            report.count(rule)
    return text


def substitute_identities(text: str, report: MaskingReport) -> str:
    """Replace every alias of every masked party with its pseudonym."""
    replacements = sorted(
        ((alias, identity.pseudonym) for identity in report.identities for alias in identity.aliases),
        key=lambda pair: len(pair[0]),
        reverse=True,
    )
    for alias, pseudonym in replacements:
        text = text.replace(alias, pseudonym)
    return text


def sanitize(text: str, report: MaskingReport) -> str:
    return redact_figures(substitute_identities(text, report), report)


def assert_no_leak(payload: str, report: MaskingReport) -> None:
    """Fail the import if any real name or quoted figure survived masking."""
    leaks = [alias for identity in report.identities for alias in identity.aliases if alias in payload]
    if leaks:
        raise SystemExit(f"Masking leak: {len(leaks)} identifier(s) survived sanitisation")
    for rule, pattern, _ in REDACTION_RULES:
        if re.search(pattern, payload):
            raise SystemExit(f"Masking leak: unredacted {rule} figure in output")
