#!/usr/bin/env python3
"""Block release mutations that TypeLoop reserves for a human owner."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from shell_structure import command_name, resolve_executable, shell_structure, tokens

PROTECTED_BRANCHES = {"main", "master"}
GITHUB_MERGE_ENDPOINT = re.compile(r"(?:^|/)pulls/[^/\s?#]+/merge(?:$|[?\s#])", re.IGNORECASE)
GITHUB_PROTECTED_REF_ENDPOINT = re.compile(
    r"(?:^|/)git/refs/heads/(?:main|master|[^/\s?#]*[$`][^/\s?#]*)(?:$|[?\s#])", re.IGNORECASE
)
PROCESS_LAUNCHERS = {"find", "nice", "setsid", "timeout", "xargs"}


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


def decoded_arguments(arguments: list[str]) -> str:
    value = " ".join(arguments)
    for _ in range(3):
        decoded = unquote(value)
        if decoded == value:
            break
        value = decoded
    return value


def wrapped_mutation_reason(parts: list[str], command_index: int) -> str | None:
    """Reject visible release commands launched through process wrappers.

    These launchers can alter scheduling or populate arguments dynamically, so
    even an apparently safe wrapped Git push is ambiguous. Direct feature-branch
    pushes remain available without a wrapper.
    """

    lowered = [part.lower() for part in parts]
    wrapped_arguments = parts[command_index + 1 :]
    if any("$" in argument or "`" in argument for argument in wrapped_arguments):
        return "A process wrapper contains a dynamic argument, so the hook failed closed."
    for index in range(command_index + 1, len(parts)):
        candidate = command_name(parts[index])
        if candidate in {"bash", "eval", "sh", "zsh"}:
            return "A process wrapper launching a nested shell cannot be inspected safely, so the hook failed closed."
        if candidate == "git" and "push" in lowered[index + 1 :]:
            return "A wrapped Git push cannot be inspected safely. Run an explicit feature-branch push instead."
        if candidate == "gh":
            arguments = lowered[index + 1 :]
            if "pr" in arguments and "merge" in arguments[arguments.index("pr") + 1 :]:
                return "Agents never merge pull requests. Leave the green PR for the human repository owner."
        if candidate.split("@", 1)[0] == "vercel":
            return "Vercel CLI use is disabled until its isolated dependency graph passes the repository security audit."
    joined = decoded_arguments(lowered[command_index + 1 :])
    if GITHUB_MERGE_ENDPOINT.search(joined) or GITHUB_PROTECTED_REF_ENDPOINT.search(joined):
        return "A wrapped GitHub mutation target cannot be inspected safely, so the hook failed closed."
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
        if "$" in executable or "`" in executable:
            return "A dynamic executable cannot be inspected safely, so the hook failed closed."
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
        if executable in PROCESS_LAUNCHERS:
            reason = wrapped_mutation_reason(parts, command_index)
            if reason:
                return reason
        if executable == "gh":
            if "pr" in arguments and "merge" in arguments[arguments.index("pr") + 1 :]:
                return "Agents never merge pull requests. Leave the green PR for the human repository owner."
        joined = decoded_arguments(arguments)
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
