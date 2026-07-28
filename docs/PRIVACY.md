# Privacy

PureCRM is local-first.

## Local mode

- CRM records are stored in IndexedDB on the current device.
- No account or remote database is required.
- PureCRM does not upload local records by default.
- Users can export and restore a portable JSON backup.

Removing browser/app data or resetting the workspace deletes the local copy, so
regular backups are recommended.

## Optional services

Data leaves the device only when a user explicitly configures and uses an
optional service such as Supabase Team sync, Gemini transcription, an email
provider, or PostHog analytics. Those services have their own privacy terms.

Do not commit `.env` files, credentials, backups, lead sheets, or customer data
to this repository.
