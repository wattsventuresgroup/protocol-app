-- Ensure brand field exists
alter table public.supplements add column if not exists brand text;

-- Ensure type field exists
alter table public.supplements add column if not exists type text default 'supplement' check (type in ('supplement', 'medication', 'nutrition'));

-- Ensure approved_products category exists on wellness_items
alter table public.wellness_items drop constraint if exists wellness_items_category_check;
alter table public.wellness_items add constraint wellness_items_category_check
check (category in ('nutrition', 'testing', 'care', 'approved_products'));

-- Migrate afternoon to evening
update public.supplements set timing = 'evening' where timing = 'afternoon';
