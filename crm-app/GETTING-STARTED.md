# Getting Started — No Technical Setup

## Desktop app

1. Download the Windows `.exe` or macOS `.dmg` from GitHub Releases.
2. Install and open **PureCRM**.
3. Enter a workspace name, choose your appearance, and click **Create PureCRM**.
4. PureCRM opens **Import Data** automatically. Choose an Excel or CSV lead
   sheet and review the preview before importing.

No database account, terminal, or API key is required.

## Local web app

If you downloaded the source code:

```bash
npm install
npm run dev
```

Open the address printed in the terminal, normally `http://localhost:5173`.

## What a lead needs

Each spreadsheet row needs at least one of:

- business/contact name,
- email,
- phone.

The importer recognizes common headings and shows the normalized preview before
anything is saved. All other fields are optional.

## Protect local data

Local mode saves automatically on the current device. It does not upload data.
Use **Settings → Data & Workspace → Workspace & Database → Download backup**
regularly and before clearing browser data, moving computers, or reinstalling
the desktop app.

Use **Restore backup** to replace local records with a previous PureCRM
backup.

## Customize the app

Open **Settings → Data & Workspace → Workspace & Database** to change:

- workspace, owner, or industry,
- light/dark/system appearance,
- accent color,
- local or Team sync storage mode.

To add or export leads later, use **Import Data** in the sidebar or
**Settings → Data & Workspace → Import & Export**.

## Optional connections

- [Team sync with Supabase](./TEAM-SYNC.md)
- [Email automation provider](./AUTOMATION-INTEGRATION.md)
- AI transcription using a server-side `GEMINI_API_KEY`
