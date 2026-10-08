// Seeded red for the oxlint gate. Do not "fix" this file: the gate asserts that
// a REAL `any` flow produces `typescript(no-unsafe-assignment)`. If this file
// ever stops producing that diagnostic, the gate reports a crash (exit 2)
// rather than a pass -- because an unarmed gate makes every green meaningless.
//
// The shape matters. `out` is exported so the only diagnostic is the unsafe
// assignment: if it were unused, an unrelated `no-unused-vars` would also fire,
// and a count-based assertion would invert (1 when the rule is MISSING, 2 when
// it is present). This gate asserts the CODE, never the count.
declare const src: any;
const out: number = src;
export { out };
