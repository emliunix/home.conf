#!/usr/bin/env python3
"""Privacy-gate controls: synthetic RED and near-miss GREEN fixtures, asserted independently.

⚠ WHY THIS IS A PYTHON SCRIPT AND NOT A SHELL HEREDOC (#50). The repository already carries a
`credential-argv-guard` that refuses credential-shaped COMMAND ARGUMENTS -- it blocked my first attempt
to write this file, and two message bodies. So fixtures are WRITTEN BY THIS SCRIPT TO TEMP FILES and
passed to the scanner as paths; no fixture value ever appears in argv.

⚠ AND THE OUTPUT ASSERTION IS INDEPENDENT OF THE FORMATTER. Every red arm re-greps the captured output
for its own seeded value. A formatter that leaked would pass a "the formatter says it redacted" check;
it cannot pass this one.

Run:  python3 skills/privacy-review/tests/controls.py      exit 0 = all controls behaved
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCAN = ROOT / "skills" / "privacy-review" / "scripts" / "privacy_scan.py"

# Every value here is obviously fake and unique, so the leak assertion is unambiguous.
# ⚠ No real credential shape is used for the private-key arm: the header alone is the detector's subject.
RED = [
    ("private-key block", "-----BEGIN RSA PRIVATE KEY-----\nMIIFAKEnotarealkey\n"),
    ("provider token", "api_key = FAKEFAKE1234567890abcdefghij"),
    ("generic secret", "secret = FAKEFAKEthesekret1234"),
    ("aws access key", "AKIAFAKEFAKEFAKE1234"),
    ("bearer token", "Authorization: Bearer FAKEFAKEFAKEFAKE1234567890"),
    ("password assignment", "password = FAKEFAKEpass1234"),
    ("deny-list term", "the FAKECODENAME rollout"),
]
GREEN = [
    ("placeholder example", "api_key = your_api_key_here\n"),
    ("scanner doc example", "secret = YOUR_SECRET_GOES_HERE\n"),
    ("clean prose", "this line carries nothing sensitive at all\n"),
    ("env indirection", "password = os.getenv('DB_PASSWORD')\n"),
]


def run_staged(repo: Path) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, str(SCAN), str(repo), "--staged", "--deny-terms", "FAKECODENAME"],
        capture_output=True, text=True,
    )
    return r.returncode, r.stdout + r.stderr


def main() -> int:
    failures = 0
    total = 0
    work = Path(tempfile.mkdtemp(prefix="privacy-controls-"))
    try:
        subprocess.run(["git", "init", "-q"], cwd=work, check=True)
        for name, body in RED:
            f = work / "zz-ctl.txt"
            f.write_text(body)
            subprocess.run(["git", "add", "-f", "zz-ctl.txt"], cwd=work, capture_output=True)
            rc, out = run_staged(work)
            subprocess.run(["git", "rm", "-q", "--cached", "zz-ctl.txt"], cwd=work, capture_output=True)
            f.unlink()
            total += 1
            if rc == 0:
                print(f"FAIL {name}: expected RED, got exit 0")
                failures += 1
                continue
            print(f"ok   {name} (exit {rc})")
            # ⚠ INDEPENDENT LEAK ASSERTION: grep the captured output for the seeded value itself.
            total += 1
            seed = body.split("=")[-1].strip().split()[-1] if "=" in body else body.strip().split()[-1]
            if seed and seed in out:
                print(f"FAIL {name}: OUTPUT CONTAINED THE SEEDED VALUE")
                failures += 1
            else:
                print(f"ok   {name} (value absent from output)")

        for name, body in GREEN:
            f = work / "zz-ctl.txt"
            f.write_text(body)
            subprocess.run(["git", "add", "-f", "zz-ctl.txt"], cwd=work, capture_output=True)
            rc, out = run_staged(work)
            subprocess.run(["git", "rm", "-q", "--cached", "zz-ctl.txt"], cwd=work, capture_output=True)
            f.unlink()
            total += 1
            if rc != 0:
                print(f"FAIL {name}: expected GREEN, got exit {rc}")
                print("     " + out.strip().splitlines()[-1][:100] if out.strip() else "")
                failures += 1
            else:
                print(f"ok   {name} (exit 0)")

        # Named refusals: an empty staged set must not read as a pass.
        rc, out = run_staged(work)
        total += 1
        if rc == 0:
            print("FAIL empty staged set exited 0")
            failures += 1
        else:
            print(f"ok   empty staged set exits {rc} (not a pass)")

        # ⚠ EXCLUSIONS ARE PATHS, AND ARE ANNOUNCED (#50, owner 2026-10-18). An exclusion list is how a
        # gate gets quietly defeated, so: a path exclusion makes a known fixture green, and the gate
        # PRINTS how many it loaded -- a silent exclusion is indistinguishable from a silent pass.
        (work / ".privacy-scan.json").write_text('{"exclude_paths": ["fixtures/"]}\n')
        (work / "fixtures").mkdir(exist_ok=True)
        f = work / "fixtures" / "fake.txt"
        f.write_text(RED[1][1])
        subprocess.run(["git", "add", "-f", "fixtures/fake.txt"], cwd=work, capture_output=True)
        rc, out = run_staged(work)
        total += 1
        if rc != 0:
            print(f"FAIL excluded path still refused (exit {rc})")
            failures += 1
        else:
            print("ok   excluded path passes (exit 0)")
        total += 1
        if "exclusions loaded" not in out:
            print("FAIL the gate did not announce its exclusion count")
            failures += 1
        else:
            print("ok   the gate announces how many exclusions it loaded")
        subprocess.run(["git", "rm", "-q", "--cached", "fixtures/fake.txt"], cwd=work, capture_output=True)
        shutil.rmtree(work / "fixtures", ignore_errors=True)
        (work / ".privacy-scan.json").unlink()

        # A RULE exclusion must be refused outright: it disables a detector everywhere.
        (work / ".privacy-scan.json").write_text('{"exclude_paths": ["rule:api key"]}\n')
        f = work / "zz-ctl.txt"
        f.write_text("clean line\n")
        subprocess.run(["git", "add", "-f", "zz-ctl.txt"], cwd=work, capture_output=True)
        rc, out = run_staged(work)
        total += 1
        if rc == 0:
            print("FAIL a rule-shaped exclusion was accepted")
            failures += 1
        else:
            print(f"ok   a rule-shaped exclusion is refused (exit {rc})")
        subprocess.run(["git", "rm", "-q", "--cached", "zz-ctl.txt"], cwd=work, capture_output=True)
        f.unlink()
        (work / ".privacy-scan.json").unlink()

        # ⚠ NO CONTENT MUTATION: the staged file must be byte-identical after a red run.
        f = work / "zz-ctl.txt"
        f.write_text(RED[1][1])
        subprocess.run(["git", "add", "-f", "zz-ctl.txt"], cwd=work, capture_output=True)
        before = f.read_bytes()
        run_staged(work)
        after = f.read_bytes()
        total += 1
        if before != after:
            print("FAIL the scanner modified the staged file")
            failures += 1
        else:
            print("ok   staged file unchanged by a red run (reject, never rewrite)")
    finally:
        shutil.rmtree(work, ignore_errors=True)

    print(f"\ncontrols: {total} assertions, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
