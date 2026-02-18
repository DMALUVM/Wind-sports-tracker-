-- ============================================================
-- AERO - Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Profiles ──────────────────────────────────────────────
-- Auto-created when a user signs up
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    avatar_url text,
    preferred_sport text default 'kitesurf',
    distance_unit text default 'mi',
    wind_unit text default 'kts',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data->>'full_name');
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ─── Sessions ──────────────────────────────────────────────
create table if not exists public.sessions (
    id text primary key,
    user_id uuid references auth.users on delete cascade not null,
    sport text not null,
    session_date date not null,
    start_time text,
    duration_minutes integer,
    wind_speed numeric,
    wind_gusts numeric,
    wind_direction text,
    tide text,
    water_state text,
    distance numeric,
    max_speed numeric,
    jump_count integer default 0,
    max_jump_height numeric,
    max_airtime numeric,
    spot_id text,
    equipment_id text,
    rating integer,
    notes text,
    source text default 'manual',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_date on public.sessions(session_date desc);

-- ─── Equipment ─────────────────────────────────────────────
create table if not exists public.equipment (
    id text primary key,
    user_id uuid references auth.users on delete cascade not null,
    type text not null,
    name text not null,
    brand text,
    size text,
    notes text,
    created_at timestamptz default now()
);

create index if not exists idx_equipment_user_id on public.equipment(user_id);

-- ─── Spots ─────────────────────────────────────────────────
create table if not exists public.spots (
    id text primary key,
    user_id uuid references auth.users on delete cascade not null,
    name text not null,
    location text,
    water_type text,
    difficulty text,
    wind_directions text[],
    notes text,
    latitude numeric,
    longitude numeric,
    created_at timestamptz default now()
);

create index if not exists idx_spots_user_id on public.spots(user_id);

-- ─── Promo Codes ───────────────────────────────────────────
-- Managed via Supabase Dashboard or SQL
create table if not exists public.promo_codes (
    id uuid default uuid_generate_v4() primary key,
    code text unique not null,
    label text default 'Promo',
    active boolean default true,
    max_uses integer,
    used_count integer default 0,
    expires_at timestamptz,
    created_at timestamptz default now()
);

-- Insert your beta codes
insert into public.promo_codes (code, label, max_uses, expires_at) values
    ('BETA2026', 'Beta Tester', 50, '2027-01-01'),
    ('FOUNDER', 'Founder Access', 10, '2030-01-01'),
    ('AEROLAUNCH', 'Launch Day', 200, '2026-12-31')
on conflict (code) do nothing;

-- ─── Redeemed Promos ───────────────────────────────────────
create table if not exists public.redeemed_promos (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users on delete cascade not null,
    code text not null,
    label text,
    redeemed_at timestamptz default now(),
    unique(user_id, code)
);

-- ─── Subscriptions ─────────────────────────────────────────
-- For App Store / Google Play receipts
create table if not exists public.subscriptions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users on delete cascade not null,
    status text not null default 'inactive',
    platform text, -- 'ios', 'android', 'web'
    product_id text,
    original_transaction_id text,
    expires_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

-- ─── Row Level Security ────────────────────────────────────
-- Users can only read/write their own data

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.equipment enable row level security;
alter table public.spots enable row level security;
alter table public.promo_codes enable row level security;
alter table public.redeemed_promos enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles
    for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
    for update using (auth.uid() = id);

-- Sessions
create policy "Users can view own sessions" on public.sessions
    for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.sessions
    for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.sessions
    for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.sessions
    for delete using (auth.uid() = user_id);

-- Equipment
create policy "Users can view own equipment" on public.equipment
    for select using (auth.uid() = user_id);
create policy "Users can insert own equipment" on public.equipment
    for insert with check (auth.uid() = user_id);
create policy "Users can update own equipment" on public.equipment
    for update using (auth.uid() = user_id);
create policy "Users can delete own equipment" on public.equipment
    for delete using (auth.uid() = user_id);

-- Spots
create policy "Users can view own spots" on public.spots
    for select using (auth.uid() = user_id);
create policy "Users can insert own spots" on public.spots
    for insert with check (auth.uid() = user_id);
create policy "Users can update own spots" on public.spots
    for update using (auth.uid() = user_id);
create policy "Users can delete own spots" on public.spots
    for delete using (auth.uid() = user_id);

-- Promo codes: anyone can read active codes (for validation)
create policy "Anyone can read active promo codes" on public.promo_codes
    for select using (active = true);
create policy "Anyone can update promo code usage" on public.promo_codes
    for update using (active = true);

-- Redeemed promos
create policy "Users can view own redeemed promos" on public.redeemed_promos
    for select using (auth.uid() = user_id);
create policy "Users can insert own redeemed promos" on public.redeemed_promos
    for insert with check (auth.uid() = user_id);

-- Subscriptions
create policy "Users can view own subscriptions" on public.subscriptions
    for select using (auth.uid() = user_id);

-- ─── Done ──────────────────────────────────────────────────
-- Your database is ready! Next steps:
-- 1. Go to Authentication > Settings and enable Email auth
-- 2. Optionally enable Google/Apple OAuth providers
-- 3. Test sign up from the AERO app
