#!/bin/bash
rm -rf /tmp/eval198/overcap /tmp/eval198/interrupted
mkdir -p /tmp/eval198/overcap/notes /tmp/eval198/interrupted/notes
python3 - <<'PY'
big = "\n".join(f"- entry {i}: " + ("context " * 12) for i in range(150))
open('/tmp/eval198/overcap/MEMORY.md','w').write(f"""# EvalAgent

## Role
Review work.

## Key Knowledge
- Read `notes/real.md` for detail.

## Active Context
Working on a task.

## Long log
{big}
""")
open('/tmp/eval198/overcap/notes/real.md','w').write("detail\n")
open('/tmp/eval198/interrupted/MEMORY.md','w').write("""# EvalAgent

## Role
Review work.

## Key Knowledge
- Read `notes/real.md` for detail.

## Active Context
Working on a task.
""")
open('/tmp/eval198/interrupted/notes/real.md','w').write("detail\n")
open('/tmp/eval198/interrupted/.MEMORY.md.abc123.tmp','w').write("PARTIAL GARBAGE THAT MUST NOT BE PUBLISHED")
PY
