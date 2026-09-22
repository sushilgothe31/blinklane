create table if not exists public.premium_users (
  id text primary key,
  user_ref text unique not null,
  wallet_address text not null,
  transaction_signature text unique not null,
  merchant_wallet text not null,
  amount_lamports bigint not null,
  created_at timestamptz not null default now()
);

alter table public.premium_users enable row level security;
