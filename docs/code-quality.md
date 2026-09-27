# Code quality

This library pilots the Engineering Playbook's executable JavaScript defaults. The shared configuration is a development dependency; runtime consumers still install a library with zero runtime dependencies.

## Provenance

- Source: internal Engineering Playbook Git repository.
- Immutable tag: `v0.12.0`.
- Source commit: `e7c2f0e48c477ee454d2ee007a19b6652f56e00f`.
- Package: `@fishgold/eslint-config@0.2.0`.
- Artifact: [fishgold-eslint-config-0.2.0.tgz](../vendor/fishgold-eslint-config-0.2.0.tgz).
- SHA-256: `50da0438c5f37e9e8373e60eca48684317c1da1a7278354dcd6224562716b3cc`.

The artifact was packed from a clean checkout of that tag after full playbook verification. Its source, README and dependency declarations travel inside the archive. npm's committed lock records the artifact integrity and resolved transitive dependencies. Keep the tarball in Git; `npm ci` must not depend on a registry publication of the private configuration or an author-machine source path. Upgrade the tag, source commit, archive hash and lock together after reviewing the changes. Never move an existing tag. Reverting the adoption commit restores the previous tooling.

## Scopes and gates

Run `npm ci` with Node 22.18+ within Node 22, or Node 24+. This development-tool requirement does not raise the library's published runtime minimum of Node 22.16.0. ESLint 10.11.0, Prettier 3.9.6 and typescript-eslint 8.70.1 are pinned. TypeScript remains 5.8.3 to preserve the declaration compatibility check. React plugins are not installed.

[eslint.config.mjs](../eslint.config.mjs) selects CommonJS/Node for runtime code, Node scripts and tests; ESM/Node for configuration; browser globals only for the real-browser suite. Typed lint covers declarations and compile-only fixtures using the actual TypeScript projects. The root [tsconfig.json](../tsconfig.json) provides a project for the declaration entry point; the fixture's existing project remains the declaration-consumer contract.

`npm run lint` fails on errors or warnings. `npm run format:check` checks all supported maintained files, including the README template. Both lead `npm run verify`, which the existing Verify CI job runs on Node 22 and 24. Local hooks are optional; branch protection must require CI checks to block merges. The CI configuration is committed; remote branch-protection settings are not managed by this pilot.

Generated `dist/` and `README.md` are verified by build/artifact and documentation tests. Vendor archives, dependency/cache output, IDE metadata and the verbatim third-party license are excluded. These exclusions must not expand to maintained source just to obtain a passing check. The published package allowlist excludes tooling, its archive and tests; packed-consumer tests enforce that boundary.

## Deliberate exceptions

Library maintainers own these exceptions. Review each when the named contract or fixture changes; remove it when no longer required. Unused disable comments are errors.

- `eqeqeq`: three explained statements in `src/compare.js`, `src/ComparisonContext.js` and the independent test oracle implement deliberate loose primitive equality. Replacing these operators would change the public contract. Source, oracle, artifact and real-browser tests protect the behavior.
- `@typescript-eslint/no-unsafe-call` and `require-await`: individual negative declaration assertions intentionally call missing members, reject narrowing or pass an asynchronous callback. Their `@ts-expect-error` directives require the compiler to reject those cases; the surrounding file retains typed lint.
- `@typescript-eslint/no-require-imports`: one import-equals statement deliberately tests the CommonJS declaration contract, alongside the separate ES module fixture.

Runtime comparisons received formatting and braces without changing their expressions. Build error handling preserves original and cleanup errors while avoiding throws inside `finally`; recovery tests remain required.
