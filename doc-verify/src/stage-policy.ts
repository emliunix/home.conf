import { UsageError } from "./types.js";

/**
 * Map the engine's exit status onto a hook stage's policy.
 *
 *   status        pre-commit   pre-push   (no --stage)
 *   0 PASS            0            0            0
 *   1 NO-GO           0            1            1      <- refused only at push
 *   2 NEEDS-REVIEW    0            2            2      <- refused only at push
 *   3 BLOCKED         0            0            3      <- never refused under a stage
 *
 * The owner's decision: contracts WARN on pre-commit and BLOCK on pre-push. A refused verdict still
 * prints, naming its class -- that is the difference between "warns" and "silently passes".
 */
export function applyStagePolicy(
  status: number,
  stage: string | undefined,
  verdict: string,
  artifactCount: number,
): number {
  if (stage === undefined) return status;
  if (stage !== "pre-commit" && stage !== "pre-push" && stage !== "external") {
    throw new UsageError(`--stage must be pre-commit, pre-push or external, got ${stage}`);
  }
  // ⚠ EXTERNAL IS NOT A THIRD POLICY, IT IS THE ABSENCE OF ONE PLUS ONE EXCEPTION (#38). A consumer's
  // hook has always blocked on a real finding, and `remote-hook.sh` asserts that. What changed is that
  // an empty population now returns BLOCKED -- and an empty index is the NORMAL state of a docs-only
  // commit, so blocking there would break every consumer that stages no docs. So: block on findings,
  // report an unevaluable population.
  if (stage === "external") {
    // ⚠ BLOCKED IS NOT A SYNONYM FOR "EMPTY SELECTION" (#38, @CowBoy's finding). `BLOCKED` has two
    // causes and they must not be treated alike:
    //   - ZERO artifacts     the staged selection matched no document; nothing was ASKED to be checked.
    //                        An empty selection is not a finding, so it may not fail a docs commit.
    //   - NON-EMPTY artifacts  a document WAS selected and its oracle could not be consulted (no judge,
    //                        a missing `.env.doc-verify`, an over-budget round). Nothing was EVALUATED,
    //                        but something was ASKED FOR -- and quietly allowing the commit would be a
    //                        false green over a document nobody checked.
    // Gating on the verdict alone did the second one; the population is the discriminator.
    if (status === 3 && artifactCount === 0) {
      process.stderr.write(
        `doc-verify: ${verdict} -- no documents were selected, so nothing was evaluated. Not failing ` +
          "the commit: an empty selection is not a finding.\n",
      );
      return 0;
    }
    return status;
  }
  if (stage === "pre-commit") {
    if (status !== 0) {
      process.stderr.write(
        `doc-verify: ${verdict} -- reported, not refused (pre-commit warns; pre-push blocks on NO-GO). ` +
          "This verdict does not stop the commit.\n",
      );
    }
    return 0;
  }
  // pre-push: NO-GO and NEEDS-REVIEW block; BLOCKED reports (it is a "could not evaluate", not a finding).
  return status === 3 ? 0 : status;
}
