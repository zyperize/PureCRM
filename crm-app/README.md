# PureCRM application

PureCRM runs local-first in a browser or lightweight Tauri desktop app.
Supabase is optional.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test:setup
```

Desktop commands require the Tauri prerequisites, including Rust:

```bash
npm run desktop:dev
npm run desktop:build
```

## Storage modes

- **Local on this device** — default; IndexedDB, no login, no server.
- **Team sync** — optional Supabase mode using the existing schema and Auth.

Local backups include every IndexedDB record and can be downloaded or restored
from **Settings → Workspace**.

## Documentation

- [`GETTING-STARTED.md`](./GETTING-STARTED.md)
- [`CSV-IMPORT-GUIDE.md`](./CSV-IMPORT-GUIDE.md)
- [`TEAM-SYNC.md`](./TEAM-SYNC.md)
- [`DESKTOP.md`](./DESKTOP.md)
- [`AUTOMATION-INTEGRATION.md`](./AUTOMATION-INTEGRATION.md)
