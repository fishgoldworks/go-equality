# Repository instructions

## Read first

Read the [development guide](docs/development.md) for contributor and release procedures and [code quality and tooling](docs/code-quality.md) for the local lint configuration, supported contributor tools and deliberate exceptions.

## Local constraints

- Edit `scripts/README.template.md` and `scripts/API.template.md`, then run `npm run docs` instead of editing generated `README.md` or `docs/API.md`; rebuild the complete `package/` directory from source.
- Preserve intentional equality semantics and negative declaration fixtures.

## Validation

- Run `npm run verify` for changes to JavaScript, declarations, tooling or package metadata; include real-browser checks when browser behaviour or generated bundles change.
- Fix required checks or report a concrete blocker; do not relax them merely to pass.

## Completion requirements

- Commit validated meaningful units separately and preserve unrelated work.
