# Email Automation Integration

The CRM includes an automation dashboard and empty database tables, but it does
not send email by itself. Connect any provider through a trusted server or
worker; never put provider secrets in browser code.

## Data contract

Write provider/campaign data into these tables created by
`supabase-setup.sql`:

- `segments` — campaign audiences
- `copy_variants` — sequence copy variants
- `waves` — campaign batches/tests
- `outreach` — one row per recipient/send
- `outreach_events` — provider webhook events
- `experiments` — test decisions
- `suppression` — global do-not-contact list

The browser has authenticated read access to automation tables. Sending workers
should use server-side credentials and must check `suppression` before every
send.

## Minimum provider adapter

1. Create/update a segment.
2. Insert queued outreach rows.
3. Send through the provider from a server process.
4. Store provider IDs and set `status`/`sent_at`.
5. Process webhooks into `outreach_events`.
6. Update opened, replied, bounced, unsubscribe, and positive-reply fields.
7. Add bounced/unsubscribed emails to `suppression`.

Until an adapter is connected, the CRM labels manual campaign controls as
unavailable and keeps all other CRM features working.
