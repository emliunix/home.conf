---
name: ux-ui-code
description: General UX/UI-to-frontend workflow for turning user needs into detailed interface designs, component analysis, page implementation, and rendered-product acceptance. Use for cross-project UI/UX and frontend work.
---

# UX/UI → Code workflow

## Purpose

Turn a user problem into a detailed, usable interface and a verified frontend result. This skill defines the UX/UI and UI-code workflow; project-specific role, architecture, domain, and deployment rules remain in the workspace skills and the applicable engineering flow skills.

## Two dimensions

### Experience/design

Define what users need to understand and do:

- problem, users, and observable outcomes;
- user stories and operation concepts;
- information architecture, navigation, and entry/exit doors;
- page zones, layout hierarchy, geometry, and responsive intent;
- semantic assignment of every UI element: purpose, data, state, copy, affordance, and outcome;
- loading, empty, unavailable, error, partial, drift, success, and lifecycle postures;
- content/copy, accessibility intent, and acceptance criteria;
- information richness and first-time comprehension.

### UI/code

Translate the approved experience contract into a coherent frontend:

- reusable versus page-specific component boundaries;
- semantic element-to-component mapping;
- adapters/projectors and their inputs;
- state and interaction model;
- wire/API operation mapping and capability availability;
- absent/null/loading/error behavior;
- accessibility and test seams;
- page composition, responsive behavior, and visual consistency.

## Workflow

### 1. Detailed UX/UI design

Produce a design artifact before component analysis or implementation. It must contain, as applicable:

- user stories and observable outcomes;
- primary, recovery, and edge operation flows;
- information architecture and navigation;
- page layout, zones, hierarchy, and responsive behavior;
- semantic assignment for every UI element;
- state/posture matrix;
- content/copy inventory;
- accessibility intent;
- data/wire assumptions;
- scope, non-goals, and acceptance criteria.

A screenshot, rough wireframe, route list, or component list alone is not a complete design.

### 2. UX quality review and feasibility cross-check

Review the design for:

- first-time comprehension;
- sufficient information for each user decision;
- human operability and product quality;
- semantic consistency;
- honest states, copy, and affordances;
- accessibility and acceptance coverage.

Cross-check the touched domain and technical assumptions with the relevant owners. They verify their truth boundary; they do not replace UX quality review. Record `PASS`, `FAIL`, or `N/A` with evidence. Missing truth or unresolved contradiction blocks progression; do not invent an answer in UI code.

### 3. UI component development analysis

Before page implementation, map:

```text
design element → component → input/projector → states → interaction → operation arm → test seam
```

Analyze:

- component boundaries and reuse;
- semantic mapping and page composition;
- adapters/projectors and data inputs;
- operation/capability availability;
- absent/null/loading/error behavior;
- interaction and retry stability;
- accessibility and test seams;
- responsive geometry;
- shared-component identity;
- unresolved gaps, owners, and return paths.

This stage may not silently change user semantics or domain meaning. An unresolved gap is a stop, not an implementation TODO.

### 4. Page implementation

Implement the approved design and component analysis in the project’s designated frontend surface. Preserve the contract and do not introduce unreviewed product semantics.

Use the project’s engineering implementation flow for implementation, tests, code review, commits, deployment, and retrospectives. Do not duplicate those procedures here.

### 5. Browser and rendered-product proof

Walk each affected page/flow leg against the rendered application. A leg is a named route or page state plus the user operations and acceptance criteria it proves.

Evidence should cover, as applicable:

- acceptance-criterion and scenario coverage;
- representative real data and prerequisites;
- screenshots and/or HTML captures;
- operation results and typed outcomes;
- loading, empty, unavailable, error, and retry states;
- keyboard, focus, labels, ARIA, and accessibility checks;
- console errors, uncaught errors, failed requests, and HTTP failures;
- spec-to-render discrepancies;
- build/served identity when deployment is in scope.

Typecheck and unit tests alone are not UI acceptance.

### 6. Product/human review and closure

Have an independent human/product review of the rendered result for:

- information hierarchy and richness;
- trust and state honesty;
- reachable operations and doors;
- copy and jargon;
- visual quality and composition;
- dead ends and misleading states;
- accessibility and day-to-day operability.

Record the verdict and any rejection. A rejection reopens the affected acceptance stage; it is not silently waived.

## General UI laws

- User-facing words name user concepts and operations, not internal machinery.
- Every displayed value and action has an available data or operation source; unavailable capability is absent or explicitly typed according to the product contract.
- Preserve absent and null distinctions; never fabricate values.
- Keep copy in the project’s designated copy home.
- Preserve operation routes, payloads, and interaction keys as defined by the domain contract; the browser must not invent them.
- Stable interaction/retry identity is minted at the correct render boundary.
- Accessibility is part of the design and proof, not a postscript.
- **Constrained input:** if the lawful values are an enumeration (a known set: accounts the user can reach, ready templates, live agents by name, a small verb set), the UI **offers a selector**. The user does not type the member. Typing is for unbounded text (a name, a note). Empty/floor of the selector is designed, not a blank box.

## Stop and return

Stop the affected stage when:

- required design semantics, states, or acceptance criteria are missing;
- information needed for a user decision is missing;
- domain/technical review fails or contradicts another source;
- an element has no lawful data or operation source;
- component analysis exposes an unresolved semantic gap;
- browser evidence is missing, stale, failing, or not tied to the reviewed result;
- human/product review finds a blocker;
- work crosses the role or project boundary.

Record the evidence, affected scope, responsible owner, and next gate. Return the issue to design, the domain owner, or the engineering flow as appropriate. Resume only after a new artifact or verdict discharges it.

## Adaptable practice

Tools and ceremony may vary: design tool, prototype format, component isolation tool, frontend framework, test harness, research method, and handoff medium. Keep the outputs, evidence, review gates, and stop conditions; adapt the tools to the project.
