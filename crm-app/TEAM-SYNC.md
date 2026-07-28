# Optional Team Sync

Local mode is the default and needs no account. Use Team sync only when several
people or devices must work with the same records.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase-setup.sql`](./supabase-setup.sql) in its SQL Editor.
3. In PureCRM, open **Settings → Workspace**.
4. Select **Team sync**.
5. Enter the Project URL and public publishable key, then save.
6. Create or sign in to a Supabase Auth account.

Never use a secret or service-role key in the app.

Switching modes does not automatically copy records. Download a local backup
before switching. Automated local-to-cloud migration is intentionally excluded
until conflict handling can guarantee that records are not duplicated or lost.
