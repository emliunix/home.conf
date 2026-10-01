# demo-proj — architecture

System boundary and principal flows. Current law; decisions live in `design/`.

## Boundary

The system is a single application package (`src/`), split into no further layers yet;
`tests/test_layering.py` enforces direction the moment a package splits out. Documents,
designs and checks are inside the boundary; deployment and external services are outside
it.

## Principal flows

> Replace: the two or three flows a newcomer follows first, each ending at the artifact
> it produces.

Each module's current contract: `docs/modules/<pkg>/contract.md`.
