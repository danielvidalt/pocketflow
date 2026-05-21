-- Tabla para registrar gastos realizados DESDE un sobre de ahorro.
-- Cada retiro reduce el balance disponible del sobre: disponible = current_amount - sum(withdrawals)
create table savings_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  savings_goal_id uuid references savings_goals(id) on delete cascade not null,
  expense_id uuid references expenses(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  withdrawn_at date not null default current_date,
  created_at timestamptz default now()
);
alter table savings_withdrawals enable row level security;
create policy "own" on savings_withdrawals for all using (auth.uid() = user_id);
