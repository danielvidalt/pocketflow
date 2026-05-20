alter table savings_goals
  add column if not exists frequency text not null default 'monthly'
    check (frequency in ('weekly', 'fortnightly', 'monthly'));
