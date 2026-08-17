# Agent Instructions

The foundational implementation specification for this repository is:

implementation-plans/gca_practice_codex_implementation_spec.md

The assessment-preset expansion specification is:

implementation-plans/assessment_presets_roblox_expansion.md

Read both before making architectural or implementation decisions. The preset
expansion specification supersedes the original GCA-only assumptions wherever
the two conflict; the original specification remains authoritative for shared
architecture, execution, validation, and security boundaries.

Implement the project according to the applicable specification's ordered
phases and priorities.

Do not:
- introduce infrastructure explicitly rejected by the specification
- skip phase acceptance criteria
- weaken runner/import validation
- expose hidden test data to the frontend
- redesign the architecture without a concrete technical blocker

When working on a phase:
1. Read the relevant specification sections.
2. Inspect the existing implementation.
3. Implement the smallest complete change satisfying the phase.
4. Add/update tests.
5. Run tests and type checking.
6. Fix failures before declaring the phase complete.
