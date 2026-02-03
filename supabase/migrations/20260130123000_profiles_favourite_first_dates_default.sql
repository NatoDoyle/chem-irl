-- Migration: profiles_favourite_first_dates_default
-- Goal: ensure profiles.favourite_first_dates never violates NOT NULL by:
-- - Detecting column type via pg_attribute/pg_type
-- - Setting empty-array default for text[]/varchar[]/jsonb
-- - Backfilling existing NULLs
-- - Raising exception if column exists but type is unsupported
-- Additive: no policies dropped, no rows deleted.

DO $$
DECLARE
  v_type_oid oid;
  v_typname text;
BEGIN
  -- Get the column's type OID (pg_attribute + pg_class + pg_namespace)
  SELECT a.atttypid
  INTO v_type_oid
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relname = 'profiles'
    AND a.attname = 'favourite_first_dates'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_type_oid IS NULL THEN
    RAISE NOTICE 'Column public.profiles.favourite_first_dates not found; skipping migration.';
    RETURN;
  END IF;

  SELECT t.typname INTO v_typname FROM pg_type t WHERE t.oid = v_type_oid;

  -- Support: text[] (_text), varchar[] (_varchar), jsonb
  IF v_typname = '_text' THEN
    ALTER TABLE public.profiles
      ALTER COLUMN favourite_first_dates SET DEFAULT '{}'::text[];
    UPDATE public.profiles
    SET favourite_first_dates = '{}'::text[]
    WHERE favourite_first_dates IS NULL;

  ELSIF v_typname = '_varchar' THEN
    ALTER TABLE public.profiles
      ALTER COLUMN favourite_first_dates SET DEFAULT '{}'::character varying[];
    UPDATE public.profiles
    SET favourite_first_dates = '{}'::character varying[]
    WHERE favourite_first_dates IS NULL;

  ELSIF v_typname = 'jsonb' THEN
    ALTER TABLE public.profiles
      ALTER COLUMN favourite_first_dates SET DEFAULT '[]'::jsonb;
    UPDATE public.profiles
    SET favourite_first_dates = '[]'::jsonb
    WHERE favourite_first_dates IS NULL;

  ELSE
    RAISE EXCEPTION
      'profiles.favourite_first_dates has unsupported type (pg_type.typname=%). Supported: _text, _varchar, jsonb.',
      v_typname;
  END IF;
END;
$$;
