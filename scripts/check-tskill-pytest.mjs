#!/usr/bin/env node
// check-tskill-pytest -- run tskill's pytest suite under the landing hooks (#283).
//
// WHY. `tskill/` ships a pytest suite (16 collected tests) that no hook and no CI
// workflow ran. #268 reworked this code and its verification was a manual run —
// nothing would redden if the suite went stale. Owner bias: drive it with uv.
//
// COMMAND (from the home.conf root):
//   uv run --frozen --directory tskill pytest -q
//
// `--frozen` is LOAD-BEARING. This machine's uv index differs from the committed
// lock's registry; a bare `uv run` re-resolves and rewrites the tracked
// `tskill/uv.lock` (HorseBoy, reproduced). The flag is what keeps the hook from
// mutating a tracked file while it runs.
//
// POPULATION. Print the collected count from `pytest --collect-only`, never a
// `grep def test_` tally: `tests/conftest.py` holds four fixtures whose names
// match `def test_*`, so grep over-counts (20) against the real 16.
//
// EXIT: 0 only when the suite is green, the population is non-zero, and
// `tskill/uv.lock` is clean after the run. `--self-test` proves a seeded red.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TSKILL = join(ROOT, 'tskill')
const LOCK = join(TSKILL, 'uv.lock')
const SEED = join(TSKILL, 'tests', '_gate_seed_probe.py')

const args = new Set(process.argv.slice(2))
const selfTestOnly = args.has('--self-test')
const skipSelfTest = args.has('--no-self-test')

function gitPorcelain(path) {
  return execFileSync('git', ['status', '--porcelain', '--', path], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
}

function runUvPytest(extraArgs, { expectFail = false } = {}) {
  const argv = ['run', '--frozen', '--directory', 'tskill', 'pytest', ...extraArgs]
  const r = spawnSync('uv', argv, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const code = r.status ?? 1
  if (expectFail) {
    if (code === 0) {
      return { ok: false, code, out, reason: 'seeded red exited 0' }
    }
    return { ok: true, code, out }
  }
  if (code !== 0) {
    return { ok: false, code, out, reason: `pytest exited ${code}` }
  }
  return { ok: true, code, out }
}

/** Parse `N tests collected` / `N test collected` from pytest --collect-only -q. */
function collectedCount(collectOut) {
  const m = /(\d+)\s+tests?\s+collected/i.exec(collectOut)
  return m ? Number(m[1]) : null
}

function assertLockClean(phase) {
  const dirty = gitPorcelain('tskill/uv.lock')
  if (dirty !== '') {
    console.error(`FAIL: tskill/uv.lock dirty after ${phase}: ${dirty}`)
    console.error('  `--frozen` must keep the hook from rewriting the lock.')
    process.exit(1)
  }
}

function runSuite() {
  if (!existsSync(join(TSKILL, 'pyproject.toml'))) {
    console.error(`FAIL: ${TSKILL}/pyproject.toml missing — tskill population undefined`)
    process.exit(1)
  }

  const collect = runUvPytest(['--collect-only', '-q'])
  if (!collect.ok) {
    console.error('FAIL: pytest --collect-only failed')
    console.error(collect.out.trim().split('\n').slice(-12).join('\n'))
    process.exit(1)
  }
  const population = collectedCount(collect.out)
  if (population === null) {
    console.error('FAIL: could not read collected population from pytest --collect-only')
    console.error(collect.out.trim().split('\n').slice(-8).join('\n'))
    process.exit(1)
  }
  if (population === 0) {
    console.error('FAIL: collected population is 0 — a green over nothing is not a pass')
    process.exit(1)
  }
  console.log(`tskill pytest population: ${population} collected test(s)`)

  const run = runUvPytest(['-q'])
  if (!run.ok) {
    console.error(`FAIL: ${run.reason}`)
    console.error(run.out.trim().split('\n').slice(-20).join('\n'))
    process.exit(1)
  }
  // Surface the suite's own summary line when present.
  const summary = run.out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+ passed/.test(l) || /passed in /.test(l))
  for (const line of summary.slice(-2)) console.log(`  ${line}`)

  assertLockClean('pytest run')
  console.log('OK: tskill pytest suite passed under --frozen.')
  return population
}

function selfTest() {
  // Seed a failing test into the real suite path so the same command path reddens.
  writeFileSync(
    SEED,
    [
      '# Temporary seed for scripts/check-tskill-pytest.mjs --self-test. Do not commit.',
      'def test_gate_seed_must_red():',
      '    assert False, "seeded red for check-tskill-pytest"',
      '',
    ].join('\n'),
  )
  try {
    const red = runUvPytest(['-q', 'tests/_gate_seed_probe.py'], { expectFail: true })
    if (!red.ok) {
      console.error(`FAIL: self-test not armed — ${red.reason}`)
      console.error(red.out.trim().split('\n').slice(-12).join('\n'))
      process.exit(2)
    }
    console.log('tskill pytest: armed — seeded probe went RED')
  } finally {
    try {
      unlinkSync(SEED)
    } catch {
      // keep going; the suite run below must not see the seed
    }
  }
  assertLockClean('self-test')
}

if (selfTestOnly) {
  selfTest()
  process.exit(0)
}

if (!skipSelfTest) {
  selfTest()
}

runSuite()
