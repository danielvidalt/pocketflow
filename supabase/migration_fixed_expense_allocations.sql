-- Fixed expense allocations: tracks money put into each fixed expense envelope per period

create table if not exists fixed_expense_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  recurring_expense_id uuid references recurring_expenses(id) on delete cascade not null,
  amount numeric(10,2) not null check (amount > 0),
  allocated_at date not null default current_date,
  created_at timestamptz default now()
);

alter table fixed_expense_allocations enable row level security;

create policy "Users can manage their own fixed allocations"
  on fixed_expense_allocations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
