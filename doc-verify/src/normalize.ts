/**
 * Section-id normalization.
 *
 * A heading's slug is derived from its rendered text, so two documents that declare the same
 * section can slugify differently for reasons that are purely typographic: a leading enumeration
 * (`## 7. Verification design` -> `7-verification-design`) or a dash variant (`## Scope - ...` ->
 * `scope---...`, where the corpus's em dash gives `scope--...`). Neither difference is a difference
 * in the document's structure, so a declared section name is matched after normalization.
 *
 * The rules are explicit and deliberately small -- no substring or fuzzy matching, so a near miss
 * still fails:
 *
 *   1. strip a leading enumeration: `7-`, `7.`, `3-`
 *   2. map every dash-like character (em, en, figure) to `-`
 *   3. collapse runs of `-` to a single `-`
 *   4. trim leading/trailing `-`
 *
 * Applied to BOTH sides of every comparison, so an exact match and a normalized match cannot
 * disagree about which section was meant.
 */
import { SectionId, sectionId } from "./types.js";

const DASHES = /[\u2010-\u2015\u2212]/g;

export function normalizeSectionId(id: SectionId): SectionId {
  return sectionId(id
    .split("/")
    .map((segment) =>
      segment
        .replace(/^\d+(?:[.-]\d+)*[.-]?/, "")
        .replace(DASHES, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .join("/"));
}

/** True when the declared id and the document's id name the same section, under normalization. */
export function sectionIdMatches(declared: SectionId, actual: SectionId): boolean {
  return declared === actual || normalizeSectionId(declared) === normalizeSectionId(actual);
}

/**
 * Why a declared section did not match, stated so the reader does not have to re-derive the rule.
 *
 * The candidate list is NOT repeated per expected section: a diagnostic that prints everything is as
 * unusable as one that prints nothing, which is what running the first version of this showed.
 */
const NORMALIZATION_NOTE =
  "normalization: leading enumeration stripped, dash variants unified, dash runs collapsed";

/** One line per expected name: the near miss, or a bare statement that nothing resembles it. */
export function explainSectionMatch(
  declared: string,
  documentIds: readonly string[],
): string {
  const normalizedDeclared = normalizeSectionId(sectionId(declared));
  const near = documentIds
    .map((id) => ({ id, normalized: normalizeSectionId(sectionId(id)) }))
    .filter(({ normalized }) =>
      normalized === normalizedDeclared ||
      normalized.includes(normalizedDeclared) ||
      normalizedDeclared.includes(normalized));
  if (near.length === 0) return `expected "${declared}" -- no declared heading resembles it`;
  const closest = near
    .map((n) => `${n.id}${n.id === declared ? "" : ` (normalizes to "${n.normalized}")`}`)
    .slice(0, 3)
    .join(", ");
  const exact = near.some((n) => n.id === declared);
  return exact
    ? `expected "${declared}" -- present`
    : `expected "${declared}" -- closest declared: ${closest}; these are different sections, not a typographic variant`;
}

/** The candidates and the normalization rule, stated once for the whole diagnostic. */
export function documentSectionsNote(documentIds: readonly string[]): string {
  return `document declares ${documentIds.length} section(s); ${NORMALIZATION_NOTE}`;
}
