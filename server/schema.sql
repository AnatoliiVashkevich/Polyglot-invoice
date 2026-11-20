-- =====================================================================================================
-- schema.sql - Polyglot Invoice database (Supabase / PostgreSQL).
-- Paste it all into Supabase > SQL Editor > Run. Safe to run again: it only creates what is missing.
--
--   businesses   one per login: the business info printed on PDFs + the settings (id = the login's user id)
--   clients      the user's customers
--   items        ONE job, three stages: kind task | estimate | invoice (product-decisions.md §4)
--   expenses     what the user spent; linked to a client (or none = "General business"),
--                and to an invoice when it was added to one
--
-- Every row belongs to one login (owner_id). The server uses the SECRET key and always filters by owner_id;
-- Row Level Security is ON with no policies, so the public (anon) key can read nothing.
-- =====================================================================================================

-- ---------- ONE TIME: remove the old crm-solo tables (test data only; the owner agreed 2026-11-19) ----------
drop table if exists invoices, receipts, visits, projects, team_members, companies cascade;
-- the old "clients" table had other columns: drop it only if it is the old one
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clients' and column_name = 'company_id') then
    drop table clients cascade;
  end if;
end $$;

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- The business + settings (one per login) ----------
create table if not exists businesses (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text not null default '',
  logo_url         text not null default '',
  phone            text not null default '',
  email            text not null default '',
  address          text not null default '',
  payment_info     text not null default '',             -- "How customers pay you": Zelle, Venmo...
  app_language     text not null default 'en' check (app_language in ('en','es','pt','ru','uk')),
  doc_language     text not null default 'en' check (doc_language in ('en','es','pt','ru','uk')),
  tax_rate         numeric(5,3) not null default 0,       -- sales tax %, 0 = off (the default)
  tax_applies_to   text not null default 'materials' check (tax_applies_to in ('materials','everything')),
  due_days         int not null default 0 check (due_days in (0,7,15,30)),   -- 0 = "Due: Now"
  invoice_terms    text not null default '',
  tax_setaside_pct numeric(5,2) not null default 25,      -- Money screen: set aside for income taxes
  created_at       timestamptz not null default now()
);

-- ---------- Clients ----------
create table if not exists clients (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null default '',
  phone              text not null default '',
  email              text not null default '',
  address            text not null default '',
  notes              text not null default '',
  preferred_language text not null default '' check (preferred_language in ('','en','es','pt','ru','uk')),
  addresses          jsonb not null default '[]'::jsonb,   -- other job addresses: [{"label": "Rental", "address": "…"}]
  created_at         timestamptz not null default now()
);
alter table clients add column if not exists addresses jsonb not null default '[]'::jsonb;   -- added 2026-11-19
create index if not exists clients_owner_idx on clients (owner_id);

-- ---------- Items: task -> estimate -> invoice ----------
create table if not exists items (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,   -- empty = no customer (tasks only)
  kind             text not null check (kind in ('task','estimate','invoice')),
  status           text not null default 'created'
                   check (status in ('created','done','sent','requested','paid')),
  date             date not null,                        -- the day it shows on the calendar
  time             text not null default '',             -- HH:MM (tasks)
  reminder_minutes int,                                   -- tasks: null = no reminder
  title            text not null default '',             -- short description of the work
  address          text not null default '',
  number           text not null default '',             -- INV-0012 / EST-0004
  lines            jsonb not null default '[]',          -- [{text, qty, price, kind: work|material}]
  tax_rate         numeric(5,3) not null default 0,       -- copied from settings when created; 0 = no tax
  tax_applies_to   text not null default 'materials' check (tax_applies_to in ('materials','everything')),
  subtotal         numeric(12,2) not null default 0,     -- the server computes these three
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  due_date         date,
  terms            text not null default '',
  paid_date        date,
  payment_method   text not null default '',
  from_item_id     uuid references items(id) on delete set null,   -- task/estimate it was made from
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists items_owner_date_idx on items (owner_id, date);
create index if not exists items_client_idx on items (client_id);

-- ---------- Expenses ----------
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  client_id   uuid references clients(id) on delete set null,   -- empty = General business
  item_id     uuid references items(id) on delete set null,     -- the invoice it was added to
  date        date not null,
  store       text not null default '',
  category    text not null default '',
  description text not null default '',
  amount      numeric(12,2) not null default 0,
  photo_url   text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists expenses_owner_date_idx on expenses (owner_id, date);

alter table businesses enable row level security;
alter table clients    enable row level security;
alter table items      enable row level security;
alter table expenses   enable row level security;
