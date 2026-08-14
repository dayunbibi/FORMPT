CREATE TYPE public.currency_code AS ENUM ('KRW', 'CAD');

ALTER TABLE public.credit_entries
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'KRW';

ALTER TABLE public.trainer_settings
  ADD COLUMN default_currency public.currency_code NOT NULL DEFAULT 'KRW';