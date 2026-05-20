alter table recurring_expenses drop constraint if exists recurring_expenses_category_check;
alter table recurring_expenses add constraint recurring_expenses_category_check check (category in ('food','supermarket','transport','leisure','shopping','health','housing','subscriptions','other'));
