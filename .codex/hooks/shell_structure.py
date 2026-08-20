"""Conservative shell structure inspection for the release-policy hook."""

from __future__ import annotations

import re
import shlex
from pathlib import Path

SHELL_ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
ENV_OPTIONS_WITH_VALUE = {"-C", "--chdir", "-S", "--split-string", "-u", "--unset"}
SUDO_OPTIONS_WITH_VALUE = {"-D", "--chdir", "-g", "--group", "-h", "--host", "-p", "--prompt", "-u", "--user"}
SHELL_CONTROL_PREFIXES = {"!", "if", "then", "elif", "else", "do", "while", "until", "time"}


def shell_structure(
    command: str,
) -> tuple[list[tuple[str, tuple[int, ...], str | None, str | None]], list[str]]:
    """Return executable simple-command segments and nested command bodies.

    This is deliberately smaller than a shell parser, but it models the syntax
    that can start another process. Quotes are retained for shlex; operators are
    boundaries only outside quotes; command/process substitutions are inspected
    recursively instead of being mistaken for inert arguments.
    """

    normalized = command.replace("\\\n", " ")
    segments: list[tuple[str, tuple[int, ...], str | None, str | None]] = []
    substitutions: list[str] = []
    current: list[str] = []
    quote: str | None = None
    escaped = False
    index = 0
    next_scope = 0
    scope: list[int] = []
    separator_before: str | None = None

    def flush(separator_after: str | None = None) -> None:
        nonlocal separator_before
        segment = "".join(current).strip()
        if segment:
            segments.append((segment, tuple(scope), separator_before, separator_after))
        current.clear()
        separator_before = separator_after

    while index < len(normalized):
        character = normalized[index]
        if escaped:
            current.append(character)
            escaped = False
            index += 1
            continue
        if character == "\\" and quote != "'":
            current.append(character)
            escaped = True
            index += 1
            continue
        if character == "'":
            current.append(character)
            if quote is None:
                quote = "'"
            elif quote == "'":
                quote = None
            index += 1
            continue
        if character == '"':
            current.append(character)
            if quote is None:
                quote = '"'
            elif quote == '"':
                quote = None
            index += 1
            continue
        if quote != "'" and character == "`":
            end = index + 1
            nested: list[str] = []
            nested_escaped = False
            while end < len(normalized):
                nested_character = normalized[end]
                if nested_escaped:
                    nested.append(nested_character)
                    nested_escaped = False
                elif nested_character == "\\":
                    nested.append(nested_character)
                    nested_escaped = True
                elif nested_character == "`":
                    break
                else:
                    nested.append(nested_character)
                end += 1
            if end >= len(normalized):
                raise ValueError("unterminated command substitution")
            substitutions.append("".join(nested))
            current.append("$__command_substitution__")
            index = end + 1
            continue
        opens_substitution = quote != "'" and (
            normalized.startswith("$(", index)
            or (quote is None and normalized.startswith("<(", index))
            or (quote is None and normalized.startswith(">(", index))
        )
        if opens_substitution:
            open_index = index + 1
            depth = 1
            end = open_index + 1
            nested_quote: str | None = None
            nested_escaped = False
            while end < len(normalized) and depth:
                nested_character = normalized[end]
                if nested_escaped:
                    nested_escaped = False
                elif nested_character == "\\" and nested_quote != "'":
                    nested_escaped = True
                elif nested_character == "'" and nested_quote != '"':
                    nested_quote = None if nested_quote == "'" else "'"
                elif nested_character == '"' and nested_quote != "'":
                    nested_quote = None if nested_quote == '"' else '"'
                elif nested_quote is None and nested_character == "(":
                    depth += 1
                elif nested_quote is None and nested_character == ")":
                    depth -= 1
                end += 1
            if depth:
                raise ValueError("unterminated command substitution")
            substitutions.append(normalized[open_index + 1 : end - 1])
            current.append("$__command_substitution__")
            index = end
            continue
        if quote is None and character in {";", "\n", "|", "&", "(", ")", "{", "}"}:
            doubled = index + 1 < len(normalized) and normalized[index + 1] == character
            if character == "|" and not doubled:
                separator = "pipeline"
            elif character == "&" and not doubled:
                separator = "background"
            else:
                separator = "sequence"
            flush(separator)
            if character == "(":
                next_scope += 1
                scope.append(next_scope)
            elif character == ")":
                if not scope:
                    raise ValueError("unbalanced subshell grouping")
                scope.pop()
            if doubled:
                index += 1
            index += 1
            continue
        current.append(character)
        index += 1
    if quote is not None or escaped or scope:
        raise ValueError("unterminated shell quoting")
    flush(None)
    return segments, substitutions


def tokens(segment: str) -> list[str]:
    try:
        return shlex.split(segment, posix=True)
    except ValueError:
        return segment.split()


def command_name(token: str) -> str:
    return Path(token).name.lower()


def resolve_executable(parts: list[str], session_cwd: str) -> tuple[list[str], int | None, str]:
    effective_cwd = Path(session_cwd)
    index = 0
    while index < len(parts):
        while index < len(parts) and SHELL_ASSIGNMENT.match(parts[index]):
            index += 1
        if index >= len(parts):
            return parts, None, str(effective_cwd)
        name = command_name(parts[index])
        if name in SHELL_CONTROL_PREFIXES:
            index += 1
            continue
        if name in {"command", "nohup", "builtin"}:
            index += 1
            while index < len(parts) and parts[index].startswith("-"):
                index += 1
            continue
        if name == "exec":
            index += 1
            while index < len(parts) and parts[index].startswith("-"):
                option = parts[index]
                if option == "--":
                    index += 1
                    break
                if option == "-a":
                    if index + 1 >= len(parts):
                        raise ValueError("exec wrapper option is missing its value")
                    index += 2
                    continue
                index += 1
            continue
        if name == "env":
            index += 1
            while index < len(parts):
                option = parts[index]
                if option == "--":
                    index += 1
                    break
                if SHELL_ASSIGNMENT.match(option):
                    index += 1
                    continue
                option_name, separator, inline_value = option.partition("=")
                compact_name = option[:2] if option.startswith(("-C", "-S", "-u")) else option_name
                if compact_name not in ENV_OPTIONS_WITH_VALUE:
                    if option.startswith("-"):
                        index += 1
                        continue
                    break
                if separator:
                    value = inline_value
                    index += 1
                elif len(option) > 2 and compact_name in {"-C", "-S", "-u"}:
                    value = option[2:]
                    index += 1
                else:
                    if index + 1 >= len(parts):
                        raise ValueError("environment wrapper option is missing its value")
                    value = parts[index + 1]
                    index += 2
                if compact_name in {"-C", "--chdir"}:
                    candidate = Path(value)
                    effective_cwd = candidate if candidate.is_absolute() else effective_cwd / candidate
                elif compact_name in {"-S", "--split-string"}:
                    parts = tokens(value) + parts[index:]
                    index = 0
                    break
            continue
        if name == "sudo":
            index += 1
            while index < len(parts) and parts[index].startswith("-"):
                option = parts[index]
                option_name, separator, inline_value = option.partition("=")
                if option_name in SUDO_OPTIONS_WITH_VALUE:
                    if separator:
                        value = inline_value
                        index += 1
                    else:
                        if index + 1 >= len(parts):
                            raise ValueError("sudo wrapper option is missing its value")
                        value = parts[index + 1]
                        index += 2
                    if option_name in {"-D", "--chdir"}:
                        candidate = Path(value)
                        effective_cwd = candidate if candidate.is_absolute() else effective_cwd / candidate
                else:
                    index += 1
            continue
        return parts, index, str(effective_cwd)
    return parts, None, str(effective_cwd)
