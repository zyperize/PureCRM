# Architecture

PureCRM uses one React application for web and desktop environments.

## Application layers

- **React + Vite** provide the interface and production web bundle.
- **IndexedDB** is the default local data store through a Supabase-compatible
  local client adapter.
- **Supabase** is an optional Team sync backend, not a setup requirement.
- **Tauri 2** packages the same application as lightweight Windows and macOS
  desktop binaries.
- **Playwright** verifies the first-run, import, edit, theme, backup, and restore
  workflow in a fresh browser.

## Data flow

```text
Interface
   |
Service modules
   |
   +-- Local mode (default) --> IndexedDB
   |
   +-- Team sync (optional) --> Supabase
```

Workspace configuration selects the data adapter. UI pages use the same service
interfaces in either mode.

## Optional integrations

- Supabase provides shared team data and authentication.
- Gemini can transcribe and summarize calls through the server-side API route.
- PostHog analytics remains disabled unless a public project token is supplied.

All optional integrations are configured with environment variables or
workspace settings; none are required for local use.
