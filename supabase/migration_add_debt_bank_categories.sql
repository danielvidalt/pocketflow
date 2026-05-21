-- Agrega categorías 'debt' y 'bank' a la tabla expenses
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('food','supermarket','transport','leisure','shopping','health','housing','subscriptions','debt','bank','other'));

-- Agrega categorías 'debt' y 'bank' a la tabla recurring_expenses
alter table recurring_expenses drop constraint if exists recurring_expenses_category_check;
alter table recurring_expenses add constraint recurring_expenses_category_check
  check (category in ('food','supermarket','transport','leisure','shopping','health','housing','subscriptions','debt','bank','other'));
