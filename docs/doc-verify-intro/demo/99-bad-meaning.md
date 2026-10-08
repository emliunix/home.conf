# 99 - Answer cache

## Problem statement

Every check re-asks the judge about sections that did not change, which costs money on each commit.

## Scope - what we touch

The judge client and a cache directory.

## Rationale

Key each answer by model, question and evidence hash, so unchanged text is never asked twice.

## Verification design

It works well and we are confident in it.

## Goal

Unchanged sections cost nothing to re-check.

## Review

Not yet reviewed.

## Status

draft
