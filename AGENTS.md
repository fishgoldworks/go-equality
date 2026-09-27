# Repository instructions

Follow [code quality and artifact provenance](docs/code-quality.md) for the shared lint configuration, supported contributor tools and deliberate exceptions.

- Run `npm run verify` for changes to JavaScript, declarations, tooling or package metadata; include real-browser checks when browser behavior or generated bundles change.
- Edit `scripts/README.template.md` and run `npm run docs` instead of editing generated `README.md`; rebuild `dist/` from source.
- Preserve intentional equality semantics and negative declaration fixtures. Fix required checks or report a concrete blocker; do not relax them merely to pass.
- Commit validated meaningful units separately and preserve unrelated work.
