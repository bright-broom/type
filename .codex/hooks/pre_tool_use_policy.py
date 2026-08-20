#!/usr/bin/env python3
"""Block release mutations that TypeLoop reserves for a human owner."""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

PROTECTED_BRANCHES = {"main", "master"}
GITHUB_MERGE_ENDPOINT = re.compile(r"(?:^|/)pulls/\d+/merge(?:$|[?\s])", re.IGNORECASE)
GITHUB_PROTECTED_REF_ENDPOINT = re.compile(
    r"(?:^|/)git/refs/heads/(?:main|master)(?:$|[?\s])", re.IGNORECASE
)
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
            current.append("__command_substitution__")
            index = end + 1
            continue
        opens_substitution = quote != "'" and (
            normalized.startswith("$(", index)
            or (quote is None and normalized.startswith("<(" , index))
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
            current.append("__command_substitution__")
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
        if name in {"command", "nohup"}:
            index += 1
            while index < len(parts) and parts[index].startswith("-"):
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


def is_protected_ref(token: str) -> bool:
    clean = token.lstrip("+").lower()
    destination = clean.rsplit(":", 1)[-1]
    return destination.removeprefix("refs/heads/") in PROTECTED_BRANCHES


def git_command_cwd(
    parts: list[str], git_index: int, push_index: int, session_cwd: str
) -> str | None:
    target = Path(session_cwd)
    index = git_index + 1
    while index < push_index:
        argument = parts[index]
        if argument == "-C":
            if index + 1 >= push_index:
                return None
            candidate = Path(parts[index + 1])
            target = candidate if candidate.is_absolute() else target / candidate
            index += 2
            continue
        if argument.startswith("--git-dir") or argument.startswith("--work-tree"):
            return None
        index += 1
    try:
        return str(target.resolve(strict=True))
    except OSError:
        return None


def git_push_reason(parts: list[str], git_index: int, session_cwd: str) -> str | None:
    lowered = [part.lower() for part in parts]
    try:
        push_index = lowered.index("push", git_index + 1)
    except ValueError:
        return None
    command_cwd = git_command_cwd(parts, git_index, push_index, session_cwd)
    if command_cwd is None:
        return "The Git repository targeted by this push cannot be inspected, so the hook failed closed."
    arguments = lowered[push_index + 1 :]
    if any(argument in {"--all", "--mirror"} for argument in arguments):
        return "Pushing every ref can update the protected default branch. Push only the feature branch."
    if any(is_protected_ref(argument) for argument in arguments):
        return "Direct pushes to main/master are forbidden. Push a codex/* feature branch and open a PR."
    if any("$" in argument or "`" in argument for argument in arguments):
        return "A dynamic push target cannot be verified. Push an explicit codex/* ref instead."
    if current_branch(command_cwd) in PROTECTED_BRANCHES:
        return "A push from main/master is forbidden, including an implicit git push. Create a feature branch first."
    return None


def release_mutation_reason(command: str, session_cwd: str, nesting: int = 0) -> str | None:
    try:
        segments, substitutions = shell_structure(command)
    except ValueError:
        return "The shell command could not be parsed safely, so the release-policy hook failed closed."
    if nesting >= 6 and substitutions:
        return "Nested shell execution exceeded the inspection limit, so the hook failed closed."
    for substitution in substitutions:
        reason = release_mutation_reason(substitution, session_cwd, nesting + 1)
        if reason:
            return reason
    active_cwds: dict[tuple[int, ...], str] = {(): session_cwd}
    ambiguous_cwd_scopes: set[tuple[int, ...]] = set()
    for segment, scope, _separator_before, _separator_after in segments:
        if scope not in active_cwds:
            active_cwds[scope] = active_cwds.get(scope[:-1], session_cwd)
        active_cwd = active_cwds[scope]
        parts = tokens(segment)
        try:
            parts, command_index, effective_cwd = resolve_executable(parts, active_cwd)
        except ValueError:
            return "A command wrapper could not be inspected safely, so the release-policy hook failed closed."
        if command_index is None:
            continue
        lowered = [part.lower() for part in parts]
        executable = command_name(parts[command_index])
        if executable in {"cd", "pushd"} and command_index + 1 < len(parts):
            # Branching, pipelines, and background lists make path-sensitive cwd
            # propagation impossible without a complete shell AST. Remember the
            # ambiguity in this execution scope and require a separate, explicit
            # Git command instead of guessing which `cd` actually ran.
            ambiguous_cwd_scopes.add(scope)
            continue
        if executable == "git":
            if scope in ambiguous_cwd_scopes and "push" in lowered[command_index + 1 :]:
                return "A compound cwd change made the Git push target ambiguous. Use a separate explicit git -C call."
            reason = git_push_reason(parts, command_index, effective_cwd)
            if reason:
                return reason
        if executable in {"bash", "sh", "zsh"}:
                nested_index: int | None = None
                for option_index in range(command_index + 1, len(parts)):
                    option = lowered[option_index]
                    if option == "--":
                        break
                    if option == "-c" or (
                        option.startswith("-") and not option.startswith("--") and "c" in option[1:]
                    ):
                        nested_index = option_index + 1
                        break
                    if not option.startswith("-"):
                        break
                if nested_index is not None:
                    if nested_index >= len(parts):
                        return "A nested shell command could not be inspected, so the hook failed closed."
                    if nesting >= 6:
                        return "Nested shell execution exceeded the inspection limit, so the hook failed closed."
                    reason = release_mutation_reason(parts[nested_index], effective_cwd, nesting + 1)
                    if reason:
                        return reason
        if executable == "eval" and command_index + 1 < len(parts):
            if nesting >= 6:
                return "Nested eval execution exceeded the inspection limit, so the hook failed closed."
            reason = release_mutation_reason(" ".join(parts[command_index + 1 :]), effective_cwd, nesting + 1)
            if reason:
                return reason
        arguments = lowered[command_index + 1 :]
        if executable == "gh":
            if "pr" in arguments and "merge" in arguments[arguments.index("pr") + 1 :]:
                return "Agents never merge pull requests. Leave the green PR for the human repository owner."
        joined = " ".join(arguments)
        if executable in {"curl", "gh", "wget"} and GITHUB_MERGE_ENDPOINT.search(joined):
            return "GitHub's pull-request merge API is reserved for the human repository owner."
        if executable in {"curl", "gh", "wget"} and GITHUB_PROTECTED_REF_ENDPOINT.search(joined):
            return "GitHub's protected-branch ref API must not be mutated by an agent."
        invokes_vercel = executable.split("@", 1)[0] == "vercel" or (
            executable in {"bun", "bunx", "corepack", "npm", "npx", "pnpm", "yarn"}
            and any(command_name(part).split("@", 1)[0] == "vercel" for part in arguments)
        )
        if invokes_vercel:
            return "Vercel CLI use is disabled until its isolated dependency graph passes the repository security audit."
    return None


def current_branch(cwd: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip().lower() or None


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


def main() -> int:
    try:
        payload: dict[str, Any] = json.load(sys.stdin)
        tool_input = payload.get("tool_input")
        command = tool_input.get("command") if isinstance(tool_input, dict) else None
        cwd = payload.get("cwd")
        if payload.get("tool_name") != "Bash":
            return 0
        if not isinstance(command, str) or not isinstance(cwd, str):
            deny("The release-policy hook could not inspect this Bash call, so it failed closed.")
            return 0
        reason = release_mutation_reason(command, cwd)
        if reason:
            deny(reason)
        return 0
    except (json.JSONDecodeError, OSError, TypeError):
        deny("The release-policy hook received invalid input, so it failed closed.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
