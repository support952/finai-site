-- FINAI SOLUTIONS — core schema
-- Every table has Row Level Security enabled. Server-side code that must bypass
-- RLS (checkout, webhooks, fulfillment) uses the service_role key, which never
-- reaches the browser.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'customer' check (role in ('admin','affiliate','customer')),
  created_at  timestamptz not null default now()
);
create unique index profiles_email_lower_idx on public.profiles (lower(email));

-- New auth users get a customer profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.levels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0
);

create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title             text not null,
  short_description text,
  description       text,
  category_id       uuid references public.categories(id) on delete set null,
  level_id          uuid references public.levels(id) on delete set null,
  page_count        int check (page_count is null or page_count > 0),
  -- NULL price = not purchasable on its own (e.g. price not yet confirmed).
  price_cents       int check (price_cents is null or price_cents > 0),
  image_url         text,
  is_visible        boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Private files (PDFs etc.) live in the private "course-files" bucket.
create table public.course_files (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create table public.offers (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  description  text,
  price_cents  int not null check (price_cents > 0),
  visibility   text not null default 'public' check (visibility in ('public','affiliate_only')),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.offer_courses (
  offer_id   uuid not null references public.offers(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  primary key (offer_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Affiliates
-- ---------------------------------------------------------------------------
create table public.affiliates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.affiliate_offers (
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  offer_id     uuid not null references public.offers(id) on delete cascade,
  primary key (affiliate_id, offer_id)
);

create table public.payment_links (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references public.affiliates(id) on delete cascade,
  offer_id      uuid not null references public.offers(id) on delete cascade,
  label         text,
  url           text not null,
  is_revoked    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index payment_links_affiliate_idx on public.payment_links (affiliate_id);

-- ---------------------------------------------------------------------------
-- Orders & transactions
-- ---------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  -- Unguessable id used for the public result page (/checkout/result/<public_id>/)
  public_id       uuid not null unique default gen_random_uuid(),
  invoice_number  text not null unique check (char_length(invoice_number) <= 20),
  offer_id        uuid references public.offers(id) on delete restrict,
  course_id       uuid references public.courses(id) on delete restrict,
  item_name       text not null,
  amount_cents    int not null check (amount_cents > 0),
  affiliate_id    uuid references public.affiliates(id) on delete set null,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending','approved','declined','error','held','refunded','voided','chargeback')),
  -- Customer input, exactly as entered (server-validated)
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  state        text not null,
  zip          text not null,
  country      text not null,
  customer_ip  text,
  fulfilled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((offer_id is not null) <> (course_id is not null))
);
create index orders_affiliate_idx on public.orders (affiliate_id, created_at);
create index orders_created_idx on public.orders (created_at);
create index orders_email_idx on public.orders (lower(email));

create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  trans_id          text not null unique,
  ref_trans_id      text,
  transaction_type  text,
  transaction_status text,
  response_code     int,
  response_reason_code int,
  response_reason   text,
  auth_code         text,
  avs_result_code   text,
  cvv_result_code   text,
  card_last4        text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_type         text,
  amount_cents      int,
  bill_to           jsonb,           -- billTo as recorded by Authorize.Net
  customer_ip       text,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index transactions_order_idx on public.transactions (order_id);

-- Denormalised, minimal view of a sale for the affiliate panel. Affiliates can
-- read ONLY this table (never orders/transactions) and only their own rows.
create table public.affiliate_sales (
  order_id        uuid primary key references public.orders(id) on delete cascade,
  affiliate_id    uuid not null references public.affiliates(id) on delete cascade,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  offer_id        uuid references public.offers(id) on delete set null,
  offer_name      text not null,
  amount_cents    int not null,
  status          text not null,
  card_last4      text,
  customer_email  text not null,
  customer_phone  text not null,
  created_at      timestamptz not null,
  updated_at      timestamptz not null default now()
);
create index affiliate_sales_affiliate_idx on public.affiliate_sales (affiliate_id, created_at);

create table public.webhook_events (
  id               uuid primary key default gen_random_uuid(),
  notification_id  text not null unique,
  event_type       text not null,
  entity_id        text,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  error            text
);

-- ---------------------------------------------------------------------------
-- Course access (fulfillment)
-- ---------------------------------------------------------------------------
create table public.course_access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (user_id, course_id, order_id)
);
create index course_access_user_idx on public.course_access (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Declines / card blocks
-- ---------------------------------------------------------------------------
create table public.decline_attempts (
  id          uuid primary key default gen_random_uuid(),
  card_last4  text not null,
  email       text not null,
  trans_id    text not null unique,
  created_at  timestamptz not null default now()
);
create index decline_attempts_lookup_idx on public.decline_attempts (card_last4, lower(email), created_at);

create table public.card_blocks (
  id           uuid primary key default gen_random_uuid(),
  card_last4   text not null,
  email        text not null,
  reason       text not null default '2 declines within 24h',
  blocked_at   timestamptz not null default now(),
  released_at  timestamptz,
  released_by  uuid references auth.users(id) on delete set null
);
create unique index card_blocks_active_idx on public.card_blocks (card_last4, lower(email)) where released_at is null;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, used by server routes via service role)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;   -- true = allowed
end $$;
revoke all on function public.rate_limit_hit(text,int,int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text,int,int) to service_role;

-- ---------------------------------------------------------------------------
-- Helper functions for policies
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Returns the caller's affiliate id, only while the affiliate is active.
create or replace function public.current_affiliate_id() returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from public.affiliates a
  join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid() and a.is_active and p.role = 'affiliate';
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();
create trigger affiliate_sales_touch before update on public.affiliate_sales for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.levels            enable row level security;
alter table public.courses           enable row level security;
alter table public.course_files      enable row level security;
alter table public.offers            enable row level security;
alter table public.offer_courses     enable row level security;
alter table public.affiliates        enable row level security;
alter table public.affiliate_offers  enable row level security;
alter table public.payment_links     enable row level security;
alter table public.orders            enable row level security;
alter table public.transactions      enable row level security;
alter table public.affiliate_sales   enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.course_access     enable row level security;
alter table public.decline_attempts  enable row level security;
alter table public.card_blocks       enable row level security;
alter table public.rate_limits       enable row level security;

-- Admin: full access everywhere.
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','levels','courses','course_files','offers','offer_courses',
    'affiliates','affiliate_offers','payment_links','orders','transactions','affiliate_sales',
    'webhook_events','course_access','decline_attempts','card_blocks']
  loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Profiles: users read their own profile (role changes only by admin).
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());

-- Public catalogue.
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy levels_public_read on public.levels for select to anon, authenticated using (true);
create policy courses_public_read on public.courses for select to anon, authenticated using (is_visible);
create policy offers_public_read on public.offers for select to anon, authenticated
  using (is_active and visibility = 'public');
create policy offer_courses_public_read on public.offer_courses for select to anon, authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and o.is_active and o.visibility = 'public'));

-- Affiliates: own record, own allowed offers, own links, own sales. Nothing else.
create policy affiliates_self_read on public.affiliates for select to authenticated
  using (id = public.current_affiliate_id());
create policy affiliate_offers_self_read on public.affiliate_offers for select to authenticated
  using (affiliate_id = public.current_affiliate_id());
create policy offers_affiliate_read on public.offers for select to authenticated
  using (is_active and exists (select 1 from public.affiliate_offers ao
         where ao.offer_id = offers.id and ao.affiliate_id = public.current_affiliate_id()));
create policy offer_courses_affiliate_read on public.offer_courses for select to authenticated
  using (exists (select 1 from public.affiliate_offers ao
         where ao.offer_id = offer_courses.offer_id and ao.affiliate_id = public.current_affiliate_id()));
create policy payment_links_self_read on public.payment_links for select to authenticated
  using (affiliate_id = public.current_affiliate_id());
create policy affiliate_sales_self_read on public.affiliate_sales for select to authenticated
  using (affiliate_id = public.current_affiliate_id());

-- Customers: their own orders and their own (non-revoked) course access.
create policy orders_customer_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy course_access_self_read on public.course_access for select to authenticated
  using (user_id = auth.uid() and revoked_at is null);
-- Customers may see the file list (names only) of courses they own; downloads go
-- through short-lived signed URLs created server-side after an access check.
create policy course_files_owner_read on public.course_files for select to authenticated
  using (exists (select 1 from public.course_access ca
         where ca.course_id = course_files.course_id and ca.user_id = auth.uid() and ca.revoked_at is null));
-- Customers can see the courses they own even if later hidden from the catalogue.
create policy courses_owner_read on public.courses for select to authenticated
  using (exists (select 1 from public.course_access ca
         where ca.course_id = courses.id and ca.user_id = auth.uid() and ca.revoked_at is null));

-- No policies (other than admin) on: transactions, webhook_events, decline_attempts,
-- card_blocks, rate_limits  => not readable by anon/affiliates/customers at all.

-- Table privileges: anon gets read-only on catalogue; writes only via policies.
revoke all on all tables in schema public from anon;
grant select on public.categories, public.levels, public.courses, public.offers, public.offer_courses to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.rate_limits from authenticated;

-- ---------------------------------------------------------------------------
-- Reporting (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_revenue_by_affiliate(p_from timestamptz, p_to timestamptz)
returns table (affiliate_id uuid, affiliate_name text, orders_count bigint, revenue_cents bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.affiliate_id, coalesce(a.name, 'Direct (site)') as affiliate_name,
           count(*)::bigint, coalesce(sum(o.amount_cents), 0)::bigint
    from public.orders o
    left join public.affiliates a on a.id = o.affiliate_id
    where o.status = 'approved' and o.created_at >= p_from and o.created_at < p_to
    group by o.affiliate_id, a.name
    order by 4 desc;
end $$;
revoke all on function public.admin_revenue_by_affiliate(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_revenue_by_affiliate(timestamptz, timestamptz) to authenticated;
