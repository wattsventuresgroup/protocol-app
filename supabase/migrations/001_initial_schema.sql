-- Users
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  phone text,
  role text not null default 'patient' check (role in ('patient', 'doctor')),
  created_at timestamptz default now()
);

-- Supplements (self-tracked by patient)
create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  dose text,
  frequency text,
  cadence text,
  timing text,
  duration text,
  intake_conditions text,
  titration_instructions text,
  notes_for_patient text,
  purchase_source text,
  purchase_source_name text,
  buy_link text,
  source text not null default 'self' check (source in ('self', 'doctor')),
  status text not null default 'tobuy' check (status in ('tobuy', 'notstarted', 'active', 'paused', 'discontinued')),
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Wellness items
create table public.wellness_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null,
  category text not null check (category in ('nutrition', 'testing', 'care')),
  name text not null,
  note text,
  cadence text,
  link_url text,
  source text not null default 'self' check (source in ('self', 'doctor')),
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Regimen events (append-only — never update or delete)
create table public.regimen_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null,
  supplement_id uuid references public.supplements(id) on delete set null,
  supplement_name text not null,
  event text not null check (event in ('purchased','started','paused','resumed','discontinued','added','removed')),
  date timestamptz default now(),
  note text,
  initiated_by text not null default 'patient' check (initiated_by in ('doctor','patient','system'))
);

-- Journal entries (private to patient — RLS must block all other access)
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('checkin','freetext')),
  text text,
  symptoms jsonb,
  linked_supplement_id uuid references public.supplements(id) on delete set null,
  created_at timestamptz default now()
);

-- Journal config (patient-set prompts and cadence)
create table public.journal_configs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null unique,
  cadence text not null default 'weekly',
  cadence_label text,
  symptoms jsonb default '[]',
  allow_free_text boolean default true,
  instructions text,
  updated_at timestamptz default now()
);

-- Summaries (patient-initiated, sent to doctor)
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.users(id) on delete cascade not null,
  sent_at timestamptz default now(),
  coverage_start date,
  coverage_end date,
  body text not null,
  additional_notes text,
  title text not null,
  recipient_email text
);

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.supplements enable row level security;
alter table public.wellness_items enable row level security;
alter table public.regimen_events enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_configs enable row level security;
alter table public.summaries enable row level security;

-- Users: can only read and update their own row
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- Supplements: patient owns their own rows
create policy "supplements_all_own" on public.supplements for all using (auth.uid() = patient_id);

-- Wellness items: patient owns their own rows
create policy "wellness_all_own" on public.wellness_items for all using (auth.uid() = patient_id);

-- Regimen events: patient can insert and read their own — never update or delete
create policy "regimen_select_own" on public.regimen_events for select using (auth.uid() = patient_id);
create policy "regimen_insert_own" on public.regimen_events for insert with check (auth.uid() = patient_id);

-- Journal entries: patient only — no other role can ever read these
create policy "journal_all_own" on public.journal_entries for all using (auth.uid() = patient_id);

-- Journal config: patient owns their own config
create policy "journal_config_all_own" on public.journal_configs for all using (auth.uid() = patient_id);

-- Summaries: patient owns their own summaries
create policy "summaries_all_own" on public.summaries for all using (auth.uid() = patient_id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'patient');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
