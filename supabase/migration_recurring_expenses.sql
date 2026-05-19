create table recurring_expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(10,2) not null check (amount > 0),
  category text not null default 'other' check (category in ('food','transport','leisure','shopping','health','housing','subscriptions','other')),
  frequency text not null check (frequency in ('weekly','fortnightly','monthly')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table recurring_expenses enable row level security;
create policy "own" on recurring_expenses for all using (auth.uid() = user_id);
