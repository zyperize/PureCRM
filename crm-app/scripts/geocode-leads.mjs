// Geocode leads that are missing latitude/longitude using the free US Census
// batch geocoder (no API key, up to 10,000 addresses per request). Populates the
// Map View, which only plots leads that have coordinates.
//
// Usage (from crm-app/):
//   node scripts/geocode-leads.mjs [limit]     # default 500; use up to 10000
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from crm-app/.env.
// Run repeatedly to work through the backlog; it always grabs the next batch
// of un-geocoded leads.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnv() {
    try {
        const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
        for (const line of txt.split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
            if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
        }
    } catch { /* no .env — rely on real env */ }
}
loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (crm-app/.env).')
    process.exit(1)
}
const db = createClient(url, key)

const LIMIT = Math.min(Math.max(Number(process.argv[2]) || 500, 1), 10000)
const BENCHMARK = 'Public_AR_Current'

const csvEscape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function parseCsvLine(line) {
    const out = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (q) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
            else if (c === '"') q = false
            else cur += c
        } else if (c === '"') q = true
        else if (c === ',') { out.push(cur); cur = '' }
        else cur += c
    }
    out.push(cur)
    return out
}

async function main() {
    const { data: leads, error } = await db
        .from('leads')
        .select('id, street_address, city, state, zipcode')
        .is('latitude', null)
        .not('street_address', 'is', null).neq('street_address', '')
        .not('city', 'is', null).neq('city', '')
        .not('state', 'is', null).neq('state', '')
        .limit(LIMIT)
    if (error) throw error
    if (!leads?.length) { console.log('No leads left to geocode.'); return }
    console.log(`Geocoding ${leads.length} leads via US Census batch geocoder...`)

    // Census batch input CSV (no header): unique_id, street, city, state, zip
    const csv = leads
        .map((l) => [l.id, l.street_address, l.city, l.state, l.zipcode || ''].map(csvEscape).join(','))
        .join('\n')

    const form = new FormData()
    form.append('benchmark', BENCHMARK)
    form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv')

    const res = await fetch('https://geocoding.geo.census.gov/geocoder/locations/addressbatch', {
        method: 'POST',
        body: form,
    })
    if (!res.ok) throw new Error(`Census geocoder ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const out = await res.text()

    // Response CSV: id,"input","Match|No_Match","Exact|...","matched addr","lon,lat",tigerid,side
    let matched = 0
    let updated = 0
    for (const line of out.split('\n')) {
        if (!line.trim()) continue
        const cols = parseCsvLine(line)
        if (cols[2] !== 'Match') continue
        const [lon, lat] = String(cols[5] || '').split(',').map(Number)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        matched++
        const { error: upErr } = await db.from('leads').update({ latitude: lat, longitude: lon }).eq('id', cols[0])
        if (upErr) { console.warn(`  update ${cols[0]} failed: ${upErr.message}`); continue }
        updated++
    }
    console.log(`Census matched ${matched}/${leads.length}; updated ${updated} leads with coordinates.`)
    console.log('Run again to geocode the next batch.')
}

main().catch((e) => { console.error(e); process.exit(1) })
