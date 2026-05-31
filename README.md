# 👶 Baby Tracker

A mobile-first web app for families to collaboratively track baby activities: feeds, sleep, medication, and nappy changes — with real-time shared visibility across all carers.

## Features

- **4 activity types**: Feed (breast/formula/bottle), Sleep, Medication, Nappy changes
- **Shared in real-time**: All carers see updates instantly via Supabase real-time subscriptions
- **Easy sharing**: Generate a baby code and share it — any carer can join on their phone
- **Quick logging**: Large tap-friendly buttons optimised for mobile use
- **Last activity summary**: Dashboard shows the last event for each category so carers always know what happened

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + real-time subscriptions)
- **Tailwind CSS** (mobile-first styling)

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project.

### 2. Run the database schema

In the Supabase SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql).

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in your Supabase project → Settings → API.

### 4. Install and run

```bash
npm install
npm run dev
```

### 5. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.

---

## How It Works

1. **First carer** opens the app → taps "Add a new baby" → enters baby name and their own name → gets a unique baby code.
2. **Other carers** open the app → tap "Join with a code" → enter the code → enter their name.
3. All carers land on the same dashboard and can see + log activities in real-time.
