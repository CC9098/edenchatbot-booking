# AI Context Import Order

Use this folder as your single entry point when importing files into Claude.

## Fastest (lowest context cost)

1. `01_CLAUDE_CONTEXT.md`

This is usually enough for:
- architecture understanding
- where-to-edit decisions
- safety rules before coding

## Full architecture pack

1. `01_CLAUDE_CONTEXT.md`
2. `02_WEBSITE_ARCHITECTURE_MAP.md`
3. `03_ARCHITECTURE.md`
4. `04_README.md`
5. `05_EDEN_ARCHITECTURE_OVERVIEW.html` (visual map for humans)

## Why this folder exists

- Keeps important files in one predictable location
- Uses numbered names (`00`, `01`, `02`, ...) so you do not need to remember order
- Files `01` to `04` are symlinks to source-of-truth files, so content stays in sync
- File `05` is a visual dashboard for quick architecture review (not source-of-truth text)

## Source of truth (do not duplicate-edit)

- `../CLAUDE_CONTEXT.md`
- `../docs/WEBSITE_ARCHITECTURE_MAP.md`
- `../ARCHITECTURE.md`
- `../README.md`
