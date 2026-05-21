-- Agrega campo 'type' a fixed_expense_allocations para distinguir
-- depósitos (fondos que entran al sobre) de retiros (gastos que salen del sobre).
alter table fixed_expense_allocations
  add column if not exists type text not null default 'deposit'
  check (type in ('deposit', 'withdrawal'));

-- Los registros existentes con expense_id vinculado eran retiros
update fixed_expense_allocations set type = 'withdrawal' where expense_id is not null;
