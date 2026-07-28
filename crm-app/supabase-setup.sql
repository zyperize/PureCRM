-- ═══════════════════════════════════════════════════════════════════════
-- CONFIGURABLE CRM — FULL SUPABASE SETUP (fresh project)
-- Run ONCE in the new project's SQL editor: paste all, click RUN.
-- Order: 1) CRM core  2) email templates  3) outreach engine  4) read RLS
-- ═══════════════════════════════════════════════════════════════════════

-- ░░░░░░░░░░ 1. CRM CORE SCHEMA ░░░░░░░░░░
-- Configurable CRM Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- LEADS TABLE (Main table for businesses)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Business Info
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'prospect', -- prospect, partner, inbound, event, outbound, referral, other, other

  -- Contact Info
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(500),

  -- Address
  street_address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zipcode VARCHAR(10),
  county VARCHAR(100),
  full_address TEXT, -- Complete formatted address

  -- Coordinates for mapping
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- External IDs
  google_places_id VARCHAR(255),
  yelp_id VARCHAR(255),

  -- Business Details (NEW - for scraped data)
  opening_hours JSONB, -- Store as JSON: {"monday": "9am-5pm", "tuesday": "9am-5pm", ...}
  business_type VARCHAR(100), -- Type/category from Google
  rating DECIMAL(2, 1), -- Google rating (e.g., 4.5)
  reviews_count INTEGER, -- Number of reviews
  price_level INTEGER, -- 1-4 dollar signs
  phone_formatted VARCHAR(50), -- Formatted phone like (123) 456-7890

  -- Photos/Images (NEW - for scraped data)
  photos JSONB, -- Array of photo URLs: ["url1", "url2", ...]
  cover_photo_url TEXT, -- Main/first photo URL

  -- Additional scraped data
  google_maps_url TEXT, -- Direct link to Google Maps listing
  description TEXT, -- Business description if available
  amenities JSONB, -- Array of amenities/features

  -- Contact Details
  manager_name VARCHAR(255),
  manager_email VARCHAR(255),
  receptionist_name VARCHAR(255),

  -- Sales Process
  lead_stage VARCHAR(50) DEFAULT 'new', -- new, contacted, interested, qualified, won, lost
  lead_source VARCHAR(100) DEFAULT 'manual', -- manual, scraped, instagram, google, referral, etc.
  next_follow_up_date DATE,
  next_follow_up_task VARCHAR(255),

  -- Metadata
  tags TEXT[], -- Array of tags
  notes_count INTEGER DEFAULT 0, -- Cache for performance
  tasks_count INTEGER DEFAULT 0,
  completed_tasks_count INTEGER DEFAULT 0,

  -- Search optimization
  search_vector TSVECTOR
);

-- QUALIFICATION QUESTIONS TABLE (Templates)
CREATE TABLE qualification_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QUALIFICATION ANSWERS TABLE (Lead-specific answers)
CREATE TABLE qualification_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  question TEXT NOT NULL, -- Store question text to handle question changes
  answer TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LEAD TASK TEMPLATES TABLE (Sales process steps)
CREATE TABLE lead_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TASKS TABLE (Lead-specific tasks)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  task_description TEXT,
  display_order INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTES TABLE (Activity log)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  note_type VARCHAR(50) DEFAULT 'general', -- general, call, email, meeting
  note_text TEXT NOT NULL,
  audio_url VARCHAR(500), -- Optional audio recording URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CALL LOGS TABLE
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  call_direction VARCHAR(10) DEFAULT 'outbound', -- outbound, inbound
  call_duration INTEGER, -- seconds (manually entered for Google Voice)
  call_outcome VARCHAR(50), -- no_answer, busy, voicemail, connected
  call_notes TEXT,
  transcript TEXT, -- AI (Whisper) transcript of an uploaded call recording
  summary TEXT, -- AI (GPT) summary of the transcript
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CALLING SCRIPTS TABLE
CREATE TABLE calling_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_name VARCHAR(100) NOT NULL,
  script_type VARCHAR(50), -- cold_call, manager_script, pricing_info, follow_up
  script_content TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SAVED SEARCHES TABLE
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_name VARCHAR(255) NOT NULL,
  search_filters JSONB NOT NULL, -- Store filter criteria as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_leads_business_name ON leads(business_name);
CREATE INDEX idx_leads_category ON leads(category);
CREATE INDEX idx_leads_state ON leads(state);
CREATE INDEX idx_leads_city ON leads(city);
CREATE INDEX idx_leads_stage ON leads(lead_stage);
CREATE INDEX idx_leads_next_followup ON leads(next_follow_up_date);
CREATE INDEX idx_leads_search ON leads USING GIN(search_vector);
CREATE INDEX idx_leads_tags ON leads USING GIN(tags);
CREATE INDEX idx_leads_coords ON leads(latitude, longitude);

CREATE INDEX idx_notes_lead ON notes(lead_id, created_at DESC);
CREATE INDEX idx_tasks_lead ON tasks(lead_id, display_order);
CREATE INDEX idx_call_logs_lead ON call_logs(lead_id, created_at DESC);
CREATE INDEX idx_qualification_answers_lead ON qualification_answers(lead_id);

-- Keep denormalized lead activity counters consistent at the database layer.
CREATE OR REPLACE FUNCTION refresh_one_lead_activity_counts(target_lead_id uuid)
RETURNS void AS $$
BEGIN
  IF target_lead_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE leads
  SET
    notes_count = (SELECT COUNT(*) FROM notes WHERE lead_id = target_lead_id),
    tasks_count = (SELECT COUNT(*) FROM tasks WHERE lead_id = target_lead_id),
    completed_tasks_count = (
      SELECT COUNT(*) FROM tasks WHERE lead_id = target_lead_id AND completed = true
    )
  WHERE id = target_lead_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_lead_activity_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
    PERFORM refresh_one_lead_activity_counts(OLD.lead_id);
    PERFORM refresh_one_lead_activity_counts(NEW.lead_id);
    RETURN NEW;
  END IF;

  PERFORM refresh_one_lead_activity_counts(COALESCE(NEW.lead_id, OLD.lead_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_notes_activity_counts ON notes;
CREATE TRIGGER refresh_notes_activity_counts
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION refresh_lead_activity_counts();

DROP TRIGGER IF EXISTS refresh_tasks_activity_counts ON tasks;
CREATE TRIGGER refresh_tasks_activity_counts
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION refresh_lead_activity_counts();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calling_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Single-user CRM policy: anonymous visitors cannot read or write CRM data.
CREATE POLICY "Authenticated CRM access" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON qualification_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON qualification_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON lead_task_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON call_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON calling_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON saved_searches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- EMAIL TEMPLATES TABLE
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER SETTINGS TABLE (key-value store for app settings)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated CRM access" ON email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated CRM access" ON user_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ░░░░░░░░░░ 2. EMAIL TEMPLATES ░░░░░░░░░░
-- Email Templates Table for CRM Workspace
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_created_at
ON email_templates(created_at DESC);

-- Enable Row Level Security (optional, adjust based on your auth setup)
-- ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment and adjust if using RLS)
-- CREATE POLICY "Authenticated email template access"
-- ON email_templates
-- FOR ALL
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);

COMMENT ON TABLE email_templates IS 'Email templates with placeholder support: [BUSINESS_NAME], [MANAGER_NAME], [PHONE], [CITY], [STATE]';


-- ░░░░░░░░░░ 3. EMAIL AUTOMATION ░░░░░░░░░░
-- ════════════════════════════════════════════════════════════════════════
--  EMAIL AUTOMATION — additive migration
--  Run this in the SAME Supabase project as the CRM app.
--  It is ADDITIVE: it does not modify or drop the existing `leads`,
--  `email_templates`, or any other CRM table. It references leads(id).
--
--  Safe to re-run: every object uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- SEGMENTS — the three buyer types. One Smartlead campaign each.
-- ─────────────────────────────────────────────────────────────
create table if not exists segments (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,           -- 'prospect' | 'inbound' | 'partner' | 'customers'
  source        text not null default 'mixed',  -- 'apollo' | 'frog' | 'mixed' | 'warm'
  audience      text not null default 'cold',   -- 'cold' | 'warm'
  angle         text not null,
  smartlead_campaign_id bigint,
  active         boolean default true,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS — warm audience (past orders + website captures that converted).
-- Separate from cold `leads` because compliance + copy differ. They opted in.
-- ─────────────────────────────────────────────────────────────
create table if not exists customers (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  first_name    text,
  last_name     text,
  source        text default 'order',           -- 'order' | 'capture' | 'manual'
  order_count   int default 0,
  last_order_at timestamptz,
  total_spent   numeric(10,2) default 0,
  city          text,
  state         text,
  consented     boolean default true,           -- they bought / opted in
  status        text default 'active',          -- active | unsub | bounced | dnc
  notes         text,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- WEBSITE CAPTURES — raw "before you leave" exit-intent submissions.
-- The capture widget on your connected website POSTs here. Promoted into customers
-- (source='capture') by the importer once double-checked.
-- ─────────────────────────────────────────────────────────────
create table if not exists website_captures (
  id            uuid primary key default uuid_generate_v4(),
  email         text not null,
  source_page   text,
  offer_shown   text,                            -- e.g. '10% off first order'
  consented     boolean default false,           -- did they tick the opt-in box
  user_agent    text,
  ip_hash       text,                             -- hashed, never raw IP
  promoted      boolean default false,            -- moved into customers yet
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- COPY VARIANTS — per segment, per sequence step. The A/B units.
-- body_template supports {{first_name}}, {{opener}}, {{company}}, {{city}}.
-- ─────────────────────────────────────────────────────────────
create table if not exists copy_variants (
  id            uuid primary key default uuid_generate_v4(),
  segment_id    uuid references segments(id) on delete cascade,
  name          text not null,                    -- 'distributors_v1_volume'
  step_number   int not null default 1,           -- 1 = first touch, 2 = bump...
  subject       text not null,
  body_template text not null,
  hook_type     text,                             -- 'list_tease' | 'contrarian' | 'mistake_warning'
  status        text default 'active',            -- active | paused | winner | loser
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- WAVES — the "test in waves" engine. A wave is a batch of sends for a
-- segment in a date window, splitting traffic across the active variants.
-- ─────────────────────────────────────────────────────────────
create table if not exists waves (
  id            uuid primary key default uuid_generate_v4(),
  segment_id    uuid references segments(id) on delete cascade,
  wave_number   int not null,
  size          int not null,                     -- how many leads this wave sends to
  test_dimension text,                            -- 'subject' | 'opener' | 'cta' | 'send_time' | 'length'
  status        text default 'planned',           -- planned | sending | measuring | decided
  started_at    timestamptz,
  decided_at    timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- OUTREACH — one row per (recipient, variant) send. Recipient is EITHER a
-- cold lead (lead_id) OR a warm customer (customer_id), never both.
-- ─────────────────────────────────────────────────────────────
create table if not exists outreach (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid references leads(id) on delete set null,
  customer_id   uuid references customers(id) on delete set null,
  segment_id    uuid references segments(id),
  variant_id    uuid references copy_variants(id),
  wave_id       uuid references waves(id),
  smartlead_campaign_id bigint,
  smartlead_lead_id     bigint,
  email         text,
  subject       text,
  body          text,
  opener        text,
  status        text default 'queued',            -- queued | sent | opened | replied | bounced | unsub | dnc
  opened        boolean default false,
  clicked       boolean default false,
  replied       boolean default false,
  positive_reply boolean default false,
  bounced       boolean default false,
  sent_at       timestamptz,
  replied_at    timestamptz,
  bumped_at     timestamptz,
  created_at    timestamptz default now()
);

alter table outreach add column if not exists bumped_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- OUTREACH EVENTS — raw event log from Smartlead webhooks (via CF Worker).
-- ─────────────────────────────────────────────────────────────
create table if not exists outreach_events (
  id            uuid primary key default uuid_generate_v4(),
  outreach_id   uuid references outreach(id) on delete set null,
  email         text,
  type          text not null,                    -- EMAIL_SENT|EMAIL_OPEN|EMAIL_LINK_CLICK|EMAIL_REPLY|LEAD_UNSUBSCRIBED|EMAIL_BOUNCE
  payload       jsonb,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- EXPERIMENTS — what the Analyst is testing each wave.
-- ─────────────────────────────────────────────────────────────
create table if not exists experiments (
  id            uuid primary key default uuid_generate_v4(),
  segment_id    uuid references segments(id) on delete cascade,
  wave_id       uuid references waves(id),
  test_dimension text,                            -- subject | opener | cta | send_time | length
  hypothesis    text,
  variant_a_id  uuid references copy_variants(id),
  variant_b_id  uuid references copy_variants(id),
  metric        text default 'reply_rate',        -- reply_rate | open_rate | positive_reply_rate
  status        text default 'running',           -- running | decided
  result_summary text,
  winner_variant_id uuid references copy_variants(id),
  started_at    timestamptz default now(),
  decided_at    timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- SUPPRESSION — global do-not-contact. Sacred. Any unsub/bounce lands here
-- and is checked before every send across BOTH leads and customers.
-- ─────────────────────────────────────────────────────────────
create table if not exists suppression (
  email         text primary key,
  reason        text not null,                    -- 'unsub' | 'bounce' | 'complaint' | 'manual'
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_outreach_status      on outreach(status);
create index if not exists idx_outreach_segment      on outreach(segment_id);
create index if not exists idx_outreach_variant      on outreach(variant_id);
create index if not exists idx_outreach_wave         on outreach(wave_id);
create index if not exists idx_outreach_bump_candidates
  on outreach(sent_at, created_at)
  where status = 'sent' and replied = false and bounced = false and bumped_at is null;
create index if not exists idx_copy_variants_segment on copy_variants(segment_id, step_number, status);
create index if not exists idx_events_type           on outreach_events(type);
create index if not exists idx_captures_promoted     on website_captures(promoted);



-- ░░░░░░░░░░ 4. OUTREACH READ-ONLY RLS (for the dashboard) ░░░░░░░░░░
-- ════════════════════════════════════════════════════════════════════════
--  EMAIL AUTOMATION — authenticated read-only RLS for the CRM dashboard
--  Run AFTER migration_outreach.sql, in the same Supabase project.
--
--  The CRM app uses the public anon key, but reads require a signed-in Supabase
--  user. The automation service engine and Cloudflare Worker write with the SERVICE ROLE key,
--  which bypasses RLS, so browser clients only get authenticated READ access.
--
--  Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  -- Authenticated-only: dashboard reads require a Supabase Auth session.
  -- Service-role automation service workers still bypass RLS for writes.
  foreach t in array array[
    'segments','customers','website_captures','copy_variants',
    'waves','outreach','outreach_events','experiments','suppression'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t||'_read', t);
    execute format('drop policy if exists %I on %I;', t||'_authenticated_read', t);
    -- read for signed-in dashboard users only
    execute format(
      'create policy %I on %I for select to authenticated using (true);',
      t||'_authenticated_read', t
    );
  end loop;
end $$;

drop policy if exists customers_authenticated_insert on customers;
drop policy if exists customers_authenticated_update on customers;
drop policy if exists website_captures_authenticated_update on website_captures;

create policy customers_authenticated_insert
on customers
for insert
to authenticated
with check (true);

create policy customers_authenticated_update
on customers
for update
to authenticated
using (true)
with check (true);

-- Captures are still inserted by the storefront Worker/service role only.
-- Signed-in CRM users can only update consented captures, which supports
-- marking a warm opt-in as promoted after it is copied into customers.
create policy website_captures_authenticated_update
on website_captures
for update
to authenticated
using (consented is true)
with check (consented is true);

-- DISTRIBUTION RPCS AND EXPLICIT DATA API GRANTS

-- Consolidate the dashboard command-center's 7 full-table lead COUNT queries
-- (each an exact-count scan over large rows) into a single one-pass RPC.
-- Matches PostgREST NOT IN null-semantics exactly (a NULL lead_stage is excluded
-- by `lead_stage not in (...)`). SECURITY INVOKER. Safe to re-run.

create or replace function dashboard_lead_counts(p_today date, p_next7 date)
returns table (
  total_leads int,
  hot_leads int,
  no_follow_up int,
  overdue_followups int,
  today_followups int,
  upcoming_7d int,
  missing_contact int
)
language sql
stable
as $$
  select
    count(*)::int,
    count(*) filter (where lead_stage in ('interested','qualified','samples_sent'))::int,
    count(*) filter (where next_follow_up_date is null and lead_stage not in ('won','lost'))::int,
    count(*) filter (where next_follow_up_date < p_today and lead_stage not in ('won','lost'))::int,
    count(*) filter (where next_follow_up_date = p_today and lead_stage not in ('won','lost'))::int,
    count(*) filter (where next_follow_up_date > p_today and next_follow_up_date <= p_next7 and lead_stage not in ('won','lost'))::int,
    count(*) filter (where email is null or email = '' or phone is null or phone = '')::int
  from leads
$$;

-- Append a tag to many leads at once (skips leads that already have it).
-- Backs the leads bulk action bar "Add tag" control. Returns the number of rows
-- actually updated. SECURITY INVOKER (default). Safe to re-run.
create or replace function bulk_add_lead_tag(p_ids uuid[], p_tag text)
returns int
language sql
as $$
  with updated as (
    update leads
    set tags = array_append(coalesce(tags, '{}'), p_tag)
    where id = any(p_ids)
      and not (p_tag = any(coalesce(tags, '{}')))
    returning id
  )
  select count(*)::int from updated;
$$;

-- Move three full-table lead reads (stage chart, state chart, import
-- duplicate check) into SQL aggregates so the browser stops paging through
-- all 163k+ leads. SECURITY INVOKER (default) — RLS still applies as the
-- calling (authenticated) user. Safe to re-run.

CREATE OR REPLACE FUNCTION lead_stage_counts()
RETURNS TABLE (name text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(lead_stage, 'new') AS name, count(*) AS count
  FROM leads
  GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION lead_state_counts()
RETURNS TABLE (name text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT state AS name, count(*) AS count
  FROM leads
  WHERE state IS NOT NULL AND state <> ''
  GROUP BY 1
$$;

-- candidates: jsonb array of {i, business_name, phone, city} built from the
-- rows being imported. Returns one row per candidate that matches an
-- existing lead, preferring a phone match over a business_name+city match.
-- Both match arms are equi-joins (hash-joinable): each side's keys are
-- cleaned ONCE. An OR-join here forces a nested loop that re-runs
-- regexp_replace per candidate x lead pair and times out on real imports.
CREATE OR REPLACE FUNCTION find_lead_duplicates(candidates jsonb)
RETURNS TABLE (
  candidate_idx int,
  matched_by text,
  id uuid,
  business_name text,
  phone text,
  phone_formatted text,
  city text,
  state text
)
LANGUAGE sql
STABLE
AS $$
  WITH candidate_rows AS (
    SELECT
      (elem->>'i')::int AS candidate_idx,
      NULLIF(elem->>'business_name', '') AS business_name,
      right(regexp_replace(coalesce(elem->>'phone', ''), '\D', '', 'g'), 10) AS clean_phone,
      NULLIF(elem->>'city', '') AS city
    FROM jsonb_array_elements(candidates) AS t(elem)
  ),
  lead_keys AS (
    SELECT
      l.id, l.business_name, l.phone, l.phone_formatted, l.city, l.state,
      right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10) AS p1,
      right(regexp_replace(coalesce(l.phone_formatted, ''), '\D', '', 'g'), 10) AS p2,
      lower(l.business_name) AS lname,
      lower(l.city) AS lcity
    FROM leads l
  ),
  lead_phone_keys AS (
    SELECT k.*, p.key
    FROM lead_keys k
    CROSS JOIN LATERAL (VALUES (k.p1), (k.p2)) AS p(key)
    WHERE length(p.key) = 10
  ),
  phone_matches AS (
    SELECT c.candidate_idx, 'phone'::text AS matched_by,
           k.id, k.business_name, k.phone, k.phone_formatted, k.city, k.state
    FROM candidate_rows c
    JOIN lead_phone_keys k ON c.clean_phone = k.key
    WHERE length(c.clean_phone) = 10
  ),
  name_matches AS (
    SELECT c.candidate_idx, 'name_city'::text AS matched_by,
           k.id, k.business_name, k.phone, k.phone_formatted, k.city, k.state
    FROM candidate_rows c
    JOIN lead_keys k
      ON k.lname = lower(c.business_name) AND k.lcity = lower(c.city)
    WHERE c.business_name IS NOT NULL AND c.city IS NOT NULL
  ),
  all_matches AS (
    SELECT * FROM phone_matches
    UNION ALL
    SELECT * FROM name_matches
  )
  SELECT DISTINCT ON (candidate_idx)
    candidate_idx, matched_by, id, business_name, phone, phone_formatted, city, state
  FROM all_matches
  ORDER BY candidate_idx, (matched_by = 'phone') DESC, id
$$;

-- Duplicate finder + merge, backing the Duplicates page.
-- Duplicate signal is business_name + street address (fallback full_address):
-- true same-location dupes. (Phone-only groups shared toll-free numbers; name+
-- city groups distinct chain locations — both wrong on this dataset.)

create or replace function find_duplicate_lead_groups(p_limit int default 100)
returns table (group_key text, lead_count bigint, leads jsonb)
language sql
stable
as $$
  with cleaned as (
    select id, business_name, city, state, phone, email, lead_stage, created_at,
           lower(trim(business_name)) as lname,
           lower(trim(coalesce(nullif(trim(street_address), ''), full_address))) as laddr
    from leads
    where business_name is not null and trim(business_name) <> ''
  ),
  groups as (
    select lname, laddr, count(*) as n
    from cleaned
    where laddr is not null and laddr <> ''
    group by lname, laddr
    having count(*) > 1
    order by count(*) desc
    limit p_limit
  )
  select
    (g.lname || ' — ' || g.laddr) as group_key,
    g.n,
    jsonb_agg(
      jsonb_build_object(
        'id', c.id, 'business_name', c.business_name, 'city', c.city,
        'state', c.state, 'phone', c.phone, 'email', c.email,
        'lead_stage', c.lead_stage, 'created_at', c.created_at
      ) order by c.created_at
    )
  from groups g
  join cleaned c on c.lname = g.lname and c.laddr = g.laddr
  group by g.lname, g.laddr, g.n
  order by g.n desc;
$$;

-- Reassign child records from losers to the keeper, then delete the losers.
-- Reassign-before-delete preserves rows that would otherwise cascade-delete.
create or replace function merge_leads(p_keep uuid, p_losers uuid[])
returns int
language plpgsql
as $$
declare
  deleted int;
begin
  p_losers := array(select unnest(p_losers) except select p_keep);
  if array_length(p_losers, 1) is null then
    return 0;
  end if;

  update notes set lead_id = p_keep where lead_id = any(p_losers);
  update tasks set lead_id = p_keep where lead_id = any(p_losers);
  update call_logs set lead_id = p_keep where lead_id = any(p_losers);
  update qualification_answers set lead_id = p_keep where lead_id = any(p_losers);
  update outreach set lead_id = p_keep where lead_id = any(p_losers);

  delete from leads where id = any(p_losers);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Migration: keep website_captures Worker-only.
-- Why: the storefront widget posts to the Cloudflare Worker's /capture route.
-- The Worker writes with the service-role key, hashes IPs, and validates input.
-- Do not expose direct anon inserts from the browser.

ALTER TABLE website_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insertions" ON website_captures;
DROP POLICY IF EXISTS "Allow public insert" ON website_captures;

COMMENT ON TABLE website_captures IS
  'Website capture submissions are accepted only through the automation service Cloudflare Worker /capture route.';

-- Supabase changed new-project defaults in 2026: Data API access is explicit.
-- The browser always signs in, so no CRM table privileges are granted to anon.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Preserve the same secure defaults for tables/functions added later.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
