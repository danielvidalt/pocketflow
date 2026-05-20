-- Vincula una allocation de sobre con el gasto diario que la originó.
-- Cuando expense_id es NULL la allocation es un depósito manual (cuenta en weeklyFixedCosts).
-- Cuando expense_id tiene valor, el monto ya está contado en expenses y NO debe duplicarse.
alter table fixed_expense_allocations
  add column if not exists expense_id uuid references expenses(id) on delete cascade;

create index if not exists idx_fixed_alloc_expense_id
  on fixed_expense_allocations(expense_id)
  where expense_id is not null;
