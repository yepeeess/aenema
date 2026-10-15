create table if not exists public.contact_requests (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 3000),
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

revoke all on table public.contact_requests from anon, authenticated;
revoke all on sequence public.contact_requests_id_seq from anon, authenticated;
