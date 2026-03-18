# Contributing to TomeReader

Thanks for taking the time to contribute! Every bug report, suggestion, and pull request helps make TomeReader better.

## Before You Start

- **Search first.** Check [open and closed issues](../../issues) before filing a new one — your question or bug may already be covered.
- **Comment before coding.** For anything beyond a small bug fix, open an issue first to discuss the approach. This avoids wasted effort if the direction doesn't fit the project.

## How to Contribute

### Reporting Bugs

Open an issue and include:
- What you did, what you expected, and what happened instead
- Your device/OS and app version
- Steps to reproduce (the more specific the better)

### Suggesting Features

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

### Submitting Code

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Run the test suite — all tests must pass:
   ```bash
   npm test          # unit tests
   npm run test:e2e  # end-to-end tests
   ```
4. Write tests for any new functionality
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`
6. Open a pull request against `main` with a clear description of what and why

## Code Standards

- **TypeScript** — no `any` types unless genuinely unavoidable
- **Tests required** — new features need unit or E2E tests; bug fixes ideally include a regression test
- **One thing per PR** — keep pull requests focused on a single change
- **No console.log** — use proper error handling instead

## What We're Looking For

TomeReader is intentionally simple — offline, no account, no cloud. Contributions that align with that philosophy are most welcome. Features that require accounts, tracking, or external services are unlikely to be accepted.

## Response Time

This is a small project maintained in spare time. I'll aim to respond to issues and PRs within a week, but it may take longer.

## Code of Conduct

Be respectful. Constructive feedback is welcome; personal attacks are not. Issues or PRs that are abusive will be closed.
