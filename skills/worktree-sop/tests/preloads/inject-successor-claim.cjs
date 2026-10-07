// Inject a SUCCESSOR recovery claim at the exact window between the age measurement and the
// displacement, modelling a second reclaimer that legitimately reclaimed the aged claim and
// published its own.
//
// WHY THIS EXISTS. The claim's aged-claim cleanup must not be path-based: a removal that fires
// after the age check but before the displacement deletes a successor's FRESH claim, and two
// recovery decisions then run — the same overlap the claim exists to prevent, one layer down.
// Parking is not enough to test this: the successor must appear INSIDE the window, and it must be
// the module's own publication shape. The successor's INODE is recorded so the case can assert
// that the successor's own directory, not a replacement, is what remains at the path.
//
// GATE_SUCCESSOR_SHAPE selects the shape modelled: "nonempty" (the corrected claim, holding an
// owner file) or anything else (an empty directory, the pre-correction shape). The case targets
// the WINDOW, so both shapes must be exercised — an empty successor is only protected by the
// window being closed, not by rmdir refusing it.
const fs = require("node:fs");
const path = require("node:path");
const claimPath =
  process.env.GATE_CLAIM_PATH && path.resolve(process.env.GATE_CLAIM_PATH);
const log = process.env.GATE_INJECT_LOG;
if (claimPath && log) {
  const realStat = fs.statSync;
  let injected = false;
  fs.statSync = function (file) {
    const result = Reflect.apply(realStat, this, arguments);
    let resolved;
    try {
      resolved = path.resolve(String(file));
    } catch {
      resolved = undefined;
    }
    if (!injected && resolved === claimPath) {
      injected = true;
      try {
        fs.rmSync(claimPath, { recursive: true, force: true });
      } catch {}
      fs.mkdirSync(claimPath);
      // Model the SHAPE the module under test publishes for a fresh claim: an empty directory in
      // the pre-fix design, one holding an owner file after the fix. The case targets the WINDOW,
      // not the shape, so both must be exercised.
      if (process.env.GATE_SUCCESSOR_SHAPE === "nonempty") {
        fs.writeFileSync(
          path.join(claimPath, "owner"),
          JSON.stringify({ token: "successor-R", pid: process.pid }) + "\n",
        );
      }
      const ino = fs.statSync(claimPath).ino;
      fs.appendFileSync(
        log,
        `INJECTED ino=${ino} shape=${process.env.GATE_SUCCESSOR_SHAPE || "empty"}\n`,
      );
    }
    return result;
  };
}
