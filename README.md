# UniSwap ♻

UniSwap is a free, campus-focused student-to-student exchange platform. Students can give away unwanted college items or swap equipment directly on campus with zero platform or transaction fees.

## Tech Stack

- **Framework:** Next.js 16 App Router
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Database & Auth:** Supabase PostgreSQL, Row-Level Security, Realtime, and Storage
- **Location:** Browser Geolocation API only (one-time permission request; no background tracking)

## Required environment variables

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
NEXT_PUBLIC_SITE_URL=https://your-deployment-domain.example.com
```

No external map service or map API key is required.

## Supabase setup

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. It creates or updates the tables, RLS policies, nearby-listings function, Storage bucket, and Realtime publication. The script is idempotent and adds `college_name` without removing existing listing data.

The database supports:

- Give Away and Swap listings
- College-name search using case-insensitive `ILIKE`
- 1.5 km nearby matching through the `get_nearby_listings` RPC
- Incoming and outgoing requests, including `offered_item` for swaps
- Participant-only conversations and messages with `is_read` tracking
- Permanent Supabase Storage image URLs

For an existing project that already ran the initial schema, also run
[`supabase/migrations/20260907_request_seen.sql`](./supabase/migrations/20260907_request_seen.sql)
to add persisted request notifications and tighten storage/request/message safeguards,
then run [`supabase/migrations/20260908_production_hardening.sql`](./supabase/migrations/20260908_production_hardening.sql)
to enforce request targets and recipient-only message read updates.
For the editable student profile fields and private roll number, also run
[`supabase/migrations/20260912_profile_fields.sql`](./supabase/migrations/20260912_profile_fields.sql).

## Local development and validation

```bash
npm install
npm run dev
```

Run the production checks before manual deployment:

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

## Manual Vercel deployment

1. Push the project to your Git provider.
2. Import it into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` in Vercel Environment Variables.
4. Apply the Supabase schema before testing authenticated flows.
5. Deploy using the default Next.js build settings.

## Routes

- `/` — landing page
- `/marketplace` — searchable marketplace with optional live-location radius filtering
- `/marketplace/[id]` — listing details and Give Away/Swap requests
- `/give` — authenticated listing creation with College Name and optional live coordinates
- `/requests` — incoming and outgoing requests
- `/messages` — conversations
- `/messages/[id]` — realtime participant-only chat
- `/login` and `/signup` — authentication
