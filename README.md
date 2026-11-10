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

## Auth overhaul (mobile login, roles, parents, MFA)

The app now uses **mobile-number sign-in** with four roles: `student`, `parent`, `teacher`, `admin`.
There is **no public sign-up** — admins create every account.

| URL | Who | Notes |
| --- | --- | --- |
| `/login` | Students & parents | OTP or password, forgot password via OTP. Old `/auth*` URLs redirect here. |
| `/admin/login` | Admins & teachers | Mobile/email + password, then **mandatory TOTP** (authenticator app). |
| `/dashboard`, `/profile` | Students | Unchanged student area. |
| `/parent/dashboard`, `/parent/performance`, `/parent/attendance`, `/parent/profile` | Parents | Only linked students. |
| `/admin/students`, `/admin/parents`, `/admin/teachers`, `/admin/attendance`, `/admin/audit` | Staff | Teachers see only sections they have permission for. |
| `/register`, `/support`, `/privacy`, `/terms` | Everyone | Info pages. |

### Setup
1. Run `supabase/auth_rbac.sql` in the SQL Editor (after `schema.sql`, `tests.sql`, `learning_content.sql`). It is idempotent and **alters** the existing `profiles` table.
2. Supabase → **Authentication → Sign In / Providers → Phone**: enable, and configure an SMS provider (Twilio, MessageBird, Vonage or Textlocal; for MSG91 use a *Send SMS* auth hook). Keep "Enable phone confirmations" on.
3. Supabase → **Authentication → Multi-Factor**: enable **TOTP** (App Authenticator).
4. Add env vars (see `.env.example`), including the server-only `SUPABASE_SERVICE_ROLE_KEY`.
5. Bootstrap the first admin with the snippet at the bottom of `auth_rbac.sql`, then sign in at `/admin/login` and scan the QR code.

Rate limits in `lib/auth/rate-limit.ts` are per server instance (in memory); Supabase's own auth rate limits still apply on top.

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

## Learning videos and notes

To enable the student video and notes libraries, run `supabase/learning_content.sql` once in the Supabase SQL Editor after the main schema. This creates the RLS-protected content tables and a private `learning-content` storage bucket. Admins can add YouTube links or MP4 videos and create text notes with optional JPEG, MP4, or PDF attachments. Students see only published items.

The storage bucket accepts files up to 200 MB, subject to the upload limit configured for your Supabase project.

## 2. Run locally
Install Node.js (current LTS), then in this folder:
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## 3. Create your admin account securely
Public sign-up is disabled. Create the first admin in Supabase → Authentication → Users → *Add user* (phone + password, auto-confirm), then run the **bootstrap snippet** at the bottom of `supabase/auth_rbac.sql`. Sign in at `/admin/login` and enrol an authenticator app (TOTP is mandatory). Create every other account from `/admin/students`, `/admin/parents` and `/admin/teachers`.

Never use a shared demo password or trust a role supplied by the browser. New auth users always start as `student`; roles are set only by server routes using the service role key or by the owner in SQL.

## 4. Deploy to Vercel
1. Push this folder to a private Git repository.
2. In Vercel, import the repository and choose the Next.js framework preset.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (server-only) under Project Settings → Environment Variables for Preview and Production.
4. Deploy, then add the final Vercel URL to Supabase Auth's allowed redirect URLs.
5. Test sign-up, email confirmation, sign-in, creating/deleting a note, test creation/taking, and admin/non-admin access.

## Important security notes
- The publishable/anon key is designed for client use **only with correct RLS policies enabled**. Never put the Supabase `service_role` key in frontend or `NEXT_PUBLIC_*`.
- This is a starter, not a fully audited production system. Review RLS and auth settings before real student data is used.
- Test answer keys are stored separately from student-readable questions and scores are calculated in a Supabase function. Question images use a private storage bucket with RLS; only admins can upload, and students can access images for published tests.
- OAuth/email confirmation flows may need callback routes and redirect settings customized to your project.
- AI tutor/API keys, general file uploads, password reset, and advanced analytics are not included yet.

