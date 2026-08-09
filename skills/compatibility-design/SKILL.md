---
name: compatibility-design
description: Guide architecture and design work involving wire formats, compatibility, migrations, schemas, or version handling; use automatically when such compatibility concerns arise.
---

# Compatibility Design

1. reject any compatibility design,
2. maintain an inventory with index of right choices
3. the current matching one is: introduce wire format versioning gate (detection, and all following processing take assume guaranteed the version). and fail hard on mismatch.
4. otherwise, an exit of current flow with a strong request of design with gate + take assumed at higher level earlier stage
