# StudAstra — Next.js + Supabase starter

This is a deployable starting point for a cosmic-style study app. It uses the existing static prototype's design direction and adds a real Supabase authentication/database integration.

## Included
- Responsive cosmic homepage and dashboard preview
- Student sign-up and sign-in (`/auth`)
- Student dashboard (`/dashboard`)
- Database-backed study goals and notes
- Admin sign-in (`/admin/login`) with a database role check
- Admin overview (`/admin`) with a read-only view of recent study entries
- Admin-authored single-correct, multiple-correct, and match-the-columns questions at `/admin/tests`
- Student practice tests in a JEE-style CBT portal with a configurable countdown, question palette, Mark for Review, Save & Next, and saved scores
- Optional private question images uploaded by admins
- Supabase Row Level Security (RLS) policies
- No hard-coded admin credentials

## 1. Create Supabase project
1. Create a project in Supabase.
2. In **SQL Editor**, run the full script `supabase/schema.sql`. To enable practice tests on an existing project, run `supabase/tests.sql` after it. If practice tests are already installed, rerun the updated `supabase/tests.sql` to add configurable timers, private question images, multiple-correct and match-the-columns question support; it is safe to rerun.
3. In **Project Settings → API** (or API Keys), copy the project URL and publishable/anon key.
4. Copy `.env.example` to `.env.local` and set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```
5. In Supabase Authentication settings, configure the allowed redirect URLs for local and deployed URLs. For local development, include `http://localhost:3000/**`; after deploying, add your actual Vercel URL.

## 2. Run locally
Install Node.js (current LTS), then in this folder:
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## 3. Create your admin account securely
1. First register a normal account through `/auth`.
2. Confirm the email if Supabase email confirmation is enabled.
3. In Supabase SQL Editor, find the user's UUID under **Authentication → Users**.
4. Run this query, replacing the UUID with the exact ID of your own account:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'PASTE-YOUR-USER-UUID-HERE';
   ```
5. Sign out and sign in at `/admin/login`.

Never use a shared demo password or trust a role supplied by the browser. The database trigger always creates new accounts as `student`; an owner must grant admin role through the trusted Supabase dashboard/SQL editor.

## 4. Deploy to Vercel
1. Push this folder to a private Git repository.
2. In Vercel, import the repository and choose the Next.js framework preset.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project Settings → Environment Variables for Preview and Production.
4. Deploy, then add the final Vercel URL to Supabase Auth's allowed redirect URLs.
5. Test sign-up, email confirmation, sign-in, creating/deleting a note, test creation/taking, and admin/non-admin access.

## Important security notes
- The publishable/anon key is designed for client use **only with correct RLS policies enabled**. Never put the Supabase `service_role` key in frontend or `NEXT_PUBLIC_*`.
- This is a starter, not a fully audited production system. Review RLS and auth settings before real student data is used.
- Test answer keys are stored separately from student-readable questions and scores are calculated in a Supabase function. Question images use a private storage bucket with RLS; only admins can upload, and students can access images for published tests.
- OAuth/email confirmation flows may need callback routes and redirect settings customized to your project.
- AI tutor/API keys, general file uploads, password reset, and advanced analytics are not included yet.

