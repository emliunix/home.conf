# 99 - Answer cache

## Problem statement

Every check re-asks the judge about sections that did not change, which costs money on each commit.

## Scope - what we touch

The judge client and a cache directory.

## Rationale

Key each answer by model, question and evidence hash, so unchanged text is never asked twice.

## Verification design

Run `check` twice on an unchanged document: the second run must report 0 semantic calls and
N cache hits. Then edit one sentence in one section and run again: exactly that section's
question is asked (1 semantic call). If the cache key ignored the evidence hash, the edited run
would report 0 calls and this check fails.

## Goal

Unchanged sections cost nothing to re-check.

## Review

Not yet reviewed.

## Status

draft
