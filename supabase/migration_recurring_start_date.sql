alter table recurring_expenses add column if not exists start_date date default current_date;
