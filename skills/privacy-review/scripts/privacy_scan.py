#!/usr/bin/env -S uv run --script
# /// script
# dependencies = []
# requires-python = ">=3.11"
# ///

"""Privacy review script - scans git repo for sensitive data exposure."""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple


def run_git_command(args: List[str], cwd: Path) -> str:
    """Run a git command and return stdout."""
    try:
        result = subprocess.run(
            ["git"] + args, cwd=cwd, capture_output=True, text=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return e.stdout


# ⚠ ONE DEFINITION, TWO CALLERS (#50). The committed-content path and the staged path must not
# disagree about what counts as a secret.
#
# ⚠ THE PRIVATE-KEY ENTRY WAS MISSING AND A CONTROL FOUND IT. The first run produced
# `FAIL private-key block: expected RED, got exit 0`: eight patterns and none matched a PEM header --
# the exact material in the 2026-10-18 incident, where a live GitHub App key sat tracked for two months.
# The header alone is sufficient and is not itself a secret.
_PATTERNS: List[Tuple[str, str]] = [
    (r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----", "Private key block"),

        (r"postgresql://[^u][^s]+@[^\s]+", "Database URL with credentials"),
        (r"(?i)sk-[a-zA-Z0-9]{20,}", "API token (sk-)"),
        (r"AKIA[0-9A-Z]{16}", "AWS access key"),
        (r"Bearer\s+[a-zA-Z0-9._~+/-]{20,}", "Bearer token"),
        (r"Authorization:\s*[a-zA-Z0-9._~+/-]{20,}", "Authorization header"),
        (r"(?i)api[_-]?key\s*=\s*[\"']?[a-zA-Z0-9]{20,}", "API key assignment"),
        (r"(?i)secret\s*=\s*[\"']?[a-zA-Z0-9]{10,}", "Secret assignment"),
        (r"(?i)password\s*=\s*[\"']?[^\s\"'\)]{8,}", "Password assignment (8+ chars)"),
]

_EXCLUSIONS: List[str] = [
        r"[A-Z_]+PASSWORD\s*=\s*your_",  # Environment variable placeholders (PG_PASSWORD=your_password)
        r"[A-Z_]+PASSWORD\s*=\s*test",  # Test passwords in env vars
        r"password\s*=\s*os\.getenv",  # password=os.getenv(...)
        r"password\s*=\s*environ\[",  # password=environ[...]
        r"password\s*=\s*parsed\.",  # password=parsed.property
        r"password\s*=\s*[\"\']?postgres[\"\']?",  # Default/test postgres password
        r"password\s*=\s*[\"\']?test[\"\']?",  # Test password
        r"password\s*=\s*[\"\']?your_[a-z_]+[\"\']?",  # Placeholder passwords (your_password, your_secret)
        r"password\s*=\s*[\"\']?example[\"\']?",  # Example passwords
]

PRIVACY_CONFIG = ".privacy-scan.json"


def fingerprint(value: str) -> str:
    """A short one-way identifier so a finding is traceable WITHOUT the value.

    ⚠ The value must not survive the detector. The legacy path returns `match.group()` in its finding
    tuple, so anything downstream could echo a live secret; this is the only function that reads it.
    """
    return hashlib.sha256(value.encode("utf-8", "surrogatepass")).hexdigest()[:12]


def load_exclusions(repo_path: Path) -> Tuple[List[str], int]:
    """Repository-local exclusions: PATHS only, never rules (#50, owner 2026-10-18).

    ⚠ A rule-wide exclusion silently disables a detector; a path exclusion is a statement about one
    file a repository has decided is a fixture. The gate prints how many it loaded, because a silent
    exclusion is indistinguishable from a silent pass.
    """
    cfg = repo_path / PRIVACY_CONFIG
    if not cfg.is_file():
        return [], 0
    try:
        data = json.loads(cfg.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        # ⚠ MALFORMED CONFIG IS A REFUSAL, not an empty exclusion set.
        raise SystemExit("privacy-scan: .privacy-scan.json is not valid JSON -- refusing")
    paths = data.get("exclude_paths", []) if isinstance(data, dict) else []
    if any("rule" in str(p) for p in paths):
        raise SystemExit("privacy-scan: exclude_paths must name PATHS, not rules")
    return [str(p) for p in paths], len(paths)


def check_sensitive_patterns_in_content(
    content: str, file_path: str
) -> List[Tuple[str, str, int, str]]:
    """Check content for sensitive patterns. Returns (description, match, line_num, line_content)."""
    findings = []
    lines = content.split("\n")

    patterns = _PATTERNS
    exclusions = _EXCLUSIONS

    for pattern, desc in patterns:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for match in matches:
            line_num = content[: match.start()].count("\n") + 1
            line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ""

            # Check if any exclusion pattern matches the entire line
            excluded = any(re.search(excl, line_content) for excl in exclusions)
            if excluded:
                continue

            findings.append((desc, match.group(), line_num, line_content))

    return findings


def check_committed_files(repo_path: Path) -> dict:
    """Check for sensitive files in commits."""
    results = {
        "sensitive_files": [],
        "env_files": [],
        "key_files": [],
    }

    # List committed files with sensitive extensions
    files_output = run_git_command(
        ["ls-tree", "-r", "HEAD", "--name-only"], cwd=repo_path
    )
    committed_files = files_output.split("\n")

    for file_path in committed_files:
        if not file_path:
            continue

        # Check for sensitive file patterns
        if re.search(
            r"\.(env|key|secret|credential|token|pem|p12)$", file_path, re.IGNORECASE
        ):
            results["sensitive_files"].append(file_path)

    return results


def staged_files(repo_path: Path) -> List[str]:
    """Repository-relative paths in the staged set. NOT the working tree."""
    out = run_git_command(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], repo_path)
    return [x for x in out.split("\n") if x.strip()]


def scan_staged(repo_path: Path, deny_terms: Optional[List[str]] = None) -> List[dict]:
    """Scan the STAGED set; findings never carry the matched bytes.

    Returns {rule, path, line, fingerprint} -- no value, no line content.
    """
    findings: List[dict] = []
    exclude, _ = load_exclusions(repo_path)
    diff = run_git_command(["diff", "--cached", "--unified=0", "--diff-filter=ACMR"], repo_path)
    current = None
    new_line = 0
    for raw in diff.split("\n"):
        if raw.startswith("+++ b/"):
            current = raw[6:]
            continue
        if raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            new_line = int(m.group(1)) if m else 0
            continue
        if not raw.startswith("+") or raw.startswith("+++"):
            continue
        if current is not None and any(current == e or current.startswith(e.rstrip("/") + "/") for e in exclude):
            new_line += 1
            continue
        added = raw[1:]
        hit = False
        for pattern, desc in _PATTERNS:
            for m in re.finditer(pattern, added, re.MULTILINE):
                if any(re.search(excl, added) for excl in _EXCLUSIONS):
                    continue
                findings.append({"rule": desc, "path": current or "", "line": new_line,
                                 "fingerprint": fingerprint(m.group())})
                hit = True
                break
            if hit:
                break
        for term in deny_terms or []:
            if term and term in added:
                findings.append({"rule": "deny-list term", "path": current or "", "line": new_line,
                                 "fingerprint": fingerprint(term)})
        new_line += 1
    return findings


def scan_commit_for_secrets(repo_path: Path) -> List[Tuple[str, str, int, str, str]]:
    """Scan current commit for sensitive patterns. Returns (desc, match, line_num, line_content, file_path)."""
    all_findings = []

    # Get all tracked files
    files_output = run_git_command(["ls-files"], cwd=repo_path)
    files = [f for f in files_output.split("\n") if f]

    for file_path in files:
        full_path = repo_path / file_path

        if not full_path.is_file():
            continue

        # Skip binary files and large files
        if full_path.suffix in [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".pdf",
            ".zip",
            ".skill",
        ]:
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            findings = check_sensitive_patterns_in_content(content, file_path)
            # Append file_path to each finding
            findings_with_file = [
                (desc, match, line_num, line_content, file_path)
                for desc, match, line_num, line_content in findings
            ]
            all_findings.extend(findings_with_file)

        except Exception as e:
            print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)

    return all_findings


def check_gitignore(repo_path: Path) -> dict:
    """Check if .gitignore protects sensitive files."""
    gitignore_path = repo_path / ".gitignore"

    if not gitignore_path.exists():
        return {"protected": False, "missing": True, "env_ignored": False}

    with open(gitignore_path, "r") as f:
        gitignore_content = f.read()

    # Check if .env is ignored
    env_ignored = bool(re.search(r"^\.env", gitignore_content, re.MULTILINE))

    return {"protected": env_ignored, "missing": False, "env_ignored": env_ignored}


def check_local_env(repo_path: Path) -> dict:
    """Check if local .env file exists and has real values."""
    env_path = repo_path / ".env"

    if not env_path.exists():
        return {"exists": False, "has_real_values": False}

    with open(env_path, "r") as f:
        content = f.read()

    # Check for placeholder vs real values
    has_real_db = bool(re.search(r"postgresql://[^u][^s]+@[^\s]+", content))
    has_real_api_key = bool(re.search(r"(sk-|AKIA)[a-zA-Z0-9]{20,}", content))
    has_real_token = bool(re.search(r"[a-zA-Z0-9._~+/-]{30,}", content))

    return {
        "exists": True,
        "has_real_values": has_real_db or has_real_api_key or has_real_token,
    }


def print_report(repo_path: Path):
    """Generate and print privacy review report."""
    print("=" * 70)
    print("PRIVACY REVIEW REPORT")
    print("=" * 70)
    print()

    # Check for sensitive committed files
    print("📁 CHECK 1: Sensitive Files in Git")
    print("-" * 70)
    sensitive_files = check_committed_files(repo_path)
    if sensitive_files["sensitive_files"]:
        print("❌ FOUND sensitive files:")
        for f in sensitive_files["sensitive_files"]:
            print(f"   - {f}")
    else:
        print("✅ No sensitive files committed")
    print()

    # Scan for secrets in code
    print("🔍 CHECK 2: Secrets in Committed Code")
    print("-" * 70)
    findings = scan_commit_for_secrets(repo_path)
    if findings:
        print("❌ FOUND potential secrets:")
        for desc, match, line_num, line_content, file_path in findings[
            :20
        ]:  # Limit to 20 findings
            print(f"\n   📄 {file_path}:{line_num}")
            print(f"   ⚠️  {desc}")
            print(f"   📝 {line_content[:120]}")
        if len(findings) > 20:
            print(f"\n   ... and {len(findings) - 20} more findings")
    else:
        print("✅ No secrets found in committed files")
    print()

    # Check .gitignore protection
    print("🛡️  CHECK 3: .gitignore Protection")
    print("-" * 70)
    gitignore_check = check_gitignore(repo_path)
    if gitignore_check["missing"]:
        print("⚠️  WARNING: .gitignore not found")
    elif gitignore_check["env_ignored"]:
        print("✅ .env is protected by .gitignore")
    else:
        print("❌ .env is NOT ignored by .gitignore")
    print()

    # Check local .env file
    print("📄 CHECK 4: Local .env File")
    print("-" * 70)
    env_check = check_local_env(repo_path)
    if not env_check["exists"]:
        print("ℹ️  No local .env file found")
    elif env_check["has_real_values"]:
        print("⚠️  WARNING: .env exists with real credentials")
        print("   Status: .env file exists locally but is NOT committed")
    else:
        print("✅ .env exists with placeholder values only")
    print()

    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    total_issues = (
        len(sensitive_files["sensitive_files"])
        + len(findings)
        + (0 if gitignore_check["env_ignored"] else 1)
        + (0 if not env_check["has_real_values"] else 0)
    )

    if total_issues == 0:
        print("✅ No privacy concerns detected - Repository is safe to share")
    else:
        print(f"❌ Found {total_issues} privacy concern(s)")
        print()
        print("Recommendations:")
        if sensitive_files["sensitive_files"]:
            print("  - Remove sensitive files from git history (git filter-repo)")
        if findings:
            print("  - Replace secrets with environment variable references")
            print("  - Rotate any exposed credentials")
        if not gitignore_check["env_ignored"]:
            print("  - Add .env to .gitignore")
        if env_check["has_real_values"]:
            print("  - Ensure .env remains in .gitignore")

    print()
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Privacy review - scan git repo for sensitive data exposure"
    )
    parser.add_argument(
        "repo_path",
        nargs="?",
        default=".",
        help="Path to git repository (default: current directory)",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress informational output, show only issues",
    )
    parser.add_argument("--staged", action="store_true",
                        help="scan the STAGED set, redact every match; pre-commit gate")
    parser.add_argument("--deny-terms", default="",
                        help="comma-separated private terms refused in the staged set")

    args = parser.parse_args()

    # ⚠ `.` IS THE CALLER'S REPOSITORY, NOT THE HOOK'S -- and with `language: script` the process runs
    # from the hook repository, so a bare `.` scanned home.conf while the consumer's staged secret sat
    # in the consumer's checkout. The consumer witness caught it as exit 3 "no staged files" against a
    # repository that plainly had one. `rev-parse --show-toplevel` of the INVOKING directory is the only
    # correct subject for a hook: it is the repo whose commit is being gated.
    if str(args.repo_path) == ".":
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
        repo_path = Path(top.stdout.strip() or ".").resolve() if top.returncode == 0 else Path.cwd().resolve()
    else:
        repo_path = Path(args.repo_path).resolve()

    if getattr(args, "staged", False):
        terms = [x.strip() for x in (args.deny_terms or "").split(",") if x.strip()]
        try:
            findings = scan_staged(repo_path, terms)
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001
            print(f"privacy-scan: could not scan the staged set: {type(exc).__name__}", file=sys.stderr)
            sys.exit(2)
        if not staged_files(repo_path):
            print("privacy-scan: no staged files -- nothing was scanned (not a pass)", file=sys.stderr)
            sys.exit(3)
        _, n_excl = load_exclusions(repo_path)
        print(f"privacy-scan: exclusions loaded from {PRIVACY_CONFIG}: {n_excl}", file=sys.stderr)
        print("=" * 70)
        print("PRIVACY REVIEW - STAGED SET (reject-only; findings redacted)")
        print("=" * 70)
        if not findings:
            print(f"\nNo matches ({len(terms)} deny term(s) configured).")
            print("A pass means no configured detector matched -- not that the change is private.")
            sys.exit(0)
        print(f"\n{len(findings)} finding(s). VALUES ARE NOT PRINTED.\n")
        for f in findings:
            print(f"  {f['path']}:{f['line']}  {f['rule']}  fp={f['fingerprint']}")
        print("\nThe commit is refused. Fix the source; this gate never rewrites content.")
        sys.exit(1)

    # Check if it's a git repository
    if not (repo_path / ".git").exists():
        print("Error: Not a git repository", file=sys.stderr)
        sys.exit(1)

    if args.quiet:
        # In quiet mode, only report issues
        sensitive_files = check_committed_files(repo_path)
        findings = scan_commit_for_secrets(repo_path)
        gitignore_check = check_gitignore(repo_path)
        env_check = check_local_env(repo_path)

        total_issues = (
            len(sensitive_files["sensitive_files"])
            + len(findings)
            + (0 if gitignore_check["env_ignored"] else 1)
            + (0 if not env_check["has_real_values"] else 0)
        )

        if total_issues > 0:
            sys.exit(1)
    else:
        print_report(repo_path)


if __name__ == "__main__":
    main()
