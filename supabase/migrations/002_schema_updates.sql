-- Add type column to supplements
alter table public.supplements
  add column if not exists type text default 'supplement'
  check (type in ('supplement', 'medication', 'nutrition'));

-- Update wellness_items category constraint to include approved_products
alter table public.wellness_items
  drop constraint if exists wellness_items_category_check;
alter table public.wellness_items
  add constraint wellness_items_category_check
  check (category in ('nutrition', 'testing', 'care', 'approved_products'));

-- Migrate afternoon timing to evening
update public.supplements set timing = 'evening' where timing = 'afternoon';
