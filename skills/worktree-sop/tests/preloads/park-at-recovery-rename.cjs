// Park the lock wrapper at the boundary just before it renames the shared lock path aside, until
// the parent creates `<signal>.go`.
//
// WHY THIS EXISTS. Stale recovery observes a lock and then displaces it. If that observation and
// displacement are not serialized against other reclaimers, a second process can reclaim the
// stale lock, publish, and START RUNNING while the first is still deciding — and the first then
// renames that live holder aside, freeing the path for a third holder. Parking at the rename
// makes the window deterministic and lets a test assert whether anyone could act inside it.
//
// Env: GATE_LOCK_PATH (the shared path), GATE_PARK_SIGNAL (touch to report the park),
// GATE_PARK_MS (upper bound, so a hung run cannot wedge the suite).
const fs = require("node:fs");
const path = require("node:path");
const target =
  process.env.GATE_LOCK_PATH && path.resolve(process.env.GATE_LOCK_PATH);
const sig = process.env.GATE_PARK_SIGNAL;
const ms = Number(process.env.GATE_PARK_MS || "20000");
if (target && sig) {
  const realRename = fs.renameSync;
  let parked = false;
  fs.renameSync = function (source, destination) {
    let resolved;
    try {
      resolved = path.resolve(String(source));
    } catch {
      resolved = undefined;
    }
    if (!parked && resolved === target) {
      parked = true;
      fs.writeFileSync(sig, "parked\n");
      const end = Date.now() + ms;
      while (!fs.existsSync(`${sig}.go`) && Date.now() < end) {}
    }
    return Reflect.apply(realRename, this, arguments);
  };
}
