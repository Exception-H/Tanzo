# Contributing to Tanzo

Thanks for your interest in contributing to Tanzo. This guide explains how to set up your environment,
the standards we hold code to, and how to submit changes.

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected
to uphold it.

## Development Setup

### Prerequisites

- Node.js 24+
- pnpm 10+

### Getting Started

```bash
# Install dependencies
pnpm install

# Run the app in development mode
pnpm dev
```

## Project Structure

```
src/
├── main/        # Electron main process: agent runtime, tools, providers, MCP, persistence, IPC
├── preload/     # IPC bridge (contextBridge) between main and renderer
├── renderer/    # React 19 frontend, organized by feature (chat, settings, mcp, providers, ...)
└── shared/      # Cross-process contract types
tests/           # Vitest unit tests, mirroring the src/ layout
docs/            # Architecture documentation (docs/architecture/)
```

For a deeper understanding, read the [architecture documentation](./docs/README.md).

## Quality Gates

Every change must pass all three gates before it can be merged. CI runs these on every pull request,
and you should run them locally first:

```bash
pnpm typecheck   # TypeScript type checking (node + web configs)
pnpm lint        # ESLint
pnpm test        # Vitest unit tests
```

You can auto-fix most formatting and lint issues with:

```bash
pnpm format             # Prettier
pnpm exec eslint --fix . # ESLint autofix
```

## Coding Guidelines

- **Keep changes surgical.** Touch only what the change requires. Avoid drive-by refactors, renaming,
  or formatting churn in unrelated code.
- **Match existing style.** Follow the patterns and conventions of the surrounding code.
- **Strict typing.** Avoid `any`, `@ts-ignore`, and `as any`. The codebase is fully strict-typed —
  keep it that way.
- **Test behavior changes.** When you add a feature or fix a bug, add or update the corresponding test
  under `tests/`. Tests mirror the `src/` directory layout.
- **No new secrets or credentials** in code. Use the secure storage mechanisms already in place.
- **Security-sensitive changes** (sandboxing, shell execution, IPC surface, provider credentials)
  deserve extra scrutiny — explain the reasoning in your PR description.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add hooks integration
fix: canonicalize tool transcript pairing
refactor(renderer): introduce app shell
test: align tool transcript order expectation
docs: update architecture overview
chore: bump dependencies
```

## Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Make your changes, keeping commits focused and well-described.
3. Ensure all quality gates pass locally (`pnpm typecheck && pnpm lint && pnpm test`).
4. Open a pull request with:
   - A concise title (under 70 characters).
   - A description of what changed, why, and how you tested it.
   - Links to any related issues.
5. Address review feedback. Keep the discussion focused and respectful.

## Reporting Bugs and Requesting Features

Open an issue with a clear title and description. For bugs, include reproduction steps, expected vs.
actual behavior, and your environment (OS, Node version, app version).

For security vulnerabilities, **do not open a public issue** — follow the process in
[SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](./LICENSE).
