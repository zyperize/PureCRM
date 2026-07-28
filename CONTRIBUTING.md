# Contributing to PureCRM

Thanks for helping improve PureCRM.

## Before opening an issue

- Search existing issues first.
- Use the bug report or feature request template.
- Never include customer records, lead lists, API keys, `.env` files, database
  exports, or other private business data.

## Local development

```bash
cd crm-app
npm ci
npm run dev
```

Before submitting a change:

```bash
npm run verify
npm run test:setup
```

## Pull requests

- Keep changes focused and explain the user impact.
- Add or update regression coverage when behavior changes.
- Update documentation when setup, imports, integrations, or releases change.
- Do not commit generated build output, desktop bundles, local test results, or
  credentials.

By submitting a contribution, you agree that the project owner may use it under
the repository's license terms.
