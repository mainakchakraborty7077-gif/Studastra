# StudAstra — Next.js + Supabase

A cosmic-style study app with student accounts, private notes and goals, admin tools, and practice tests.

## Features
- Student sign-up and sign-in at /auth
- Personal dashboard at /dashboard
- Study goals and notes saved to Supabase
- Admin sign-in at /admin/login and overview at /admin
- Admin test builder at /admin/tests
- Student practice tests at /dashboard/tests, with saved scores
- Supabase Row Level Security; answer keys are private and scoring is done in the database

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/tests.sql` to enable practice tests.
4. In Project Settings → API, copy the project URL and publishable/anon key.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and in Vercel Preview and Production environments.
6. Add your deployed Vercel URL to Supabase Authentication's allowed redirect URLs.

## Admin setup
1. Create and confirm your normal account at `/auth`.
2. In Supabase Authentication → Users, copy your account UUID.
3. In SQL Editor, grant admin to your own account:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR-ACCOUNT-UUID';
```

4. Sign in at `/admin/login` using the same confirmed account email and password.
5. Open **Open test builder** to create and publish multiple-choice tests for students.

New accounts always receive the student role. Never put the Supabase service-role key in the browser or in a `NEXT_PUBLIC_*` variable.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
