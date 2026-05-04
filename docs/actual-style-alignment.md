# Actual Budget Style Alignment

AB Bot is a separate npm companion package, not a package inside the Actual Budget monorepo. The Actual style guide still gives useful direction for keeping this project familiar to Actual contributors.

## What AB Bot Follows

- Named exports for project utilities and modules.
- Small, focused modules with helpers kept close to the code that uses them.
- Functional parsing, normalization, preview, and summary code.
- Descriptive boolean names such as `isRateLimitError`.
- No direct imports from Actual web internals. AB Bot uses the public `@actual-app/api` package.
- Local-first behavior by default, with explicit cloud AI configuration.

## Where AB Bot Differs

- AB Bot is currently plain JavaScript ESM rather than TypeScript. A TypeScript migration would be reasonable before a larger contributor base forms.
- The web UI is vanilla HTML/CSS/JavaScript, not React, so Actual's React-specific conventions do not apply directly.
- User-facing strings are not internationalized yet. Actual requires translation support in its app; AB Bot should consider this if it becomes more than an early companion tool.
- Provider modules currently expose provider objects/classes for a small plugin-like interface. New shared code should still prefer simple functions where possible.

## Quality Commands

These scripts map AB Bot to the closest equivalent of Actual's testing guidance:

```bash
npm test
npm run test:debug
npm run test:syntax
npm run test:all
```

Actual's monorepo uses `yarn test`, `yarn test:debug`, package-level workspace tests, and Playwright E2E. AB Bot's `test:all` currently covers Node unit tests and syntax checks. Browser E2E tests are the next gap to close.

## Before Sharing Changes

- Run `npm run test:all`.
- Run a privacy scan before committing screenshots, examples, or fixtures.
- Keep real bank data, `.env`, `.ab-bot`, and package tarballs out of git.
- Prefer sample data that is synthetic and clearly marked as such.
