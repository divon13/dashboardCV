-- 07_fix_campos_vagas.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)
--
-- Garante que os campos status_vagas e data_abertura tenham valores corretos
-- e que os defaults estejam configurados adequadamente

-- Garante que status_vagas tenha default 'aberta'
ALTER TABLE public.Vagas 
ALTER COLUMN status_vagas SET DEFAULT 'aberta';

-- Garante que data_abertura tenha default NOW()
ALTER TABLE public.Vagas 
ALTER COLUMN data_abertura SET DEFAULT NOW();

-- Atualiza registros existentes que não têm status_vagas
UPDATE public.Vagas
SET status_vagas = 'aberta'
WHERE status_vagas IS NULL;

-- Atualiza registros existentes que não têm data_abertura
UPDATE public.Vagas
SET data_abertura = created_at
WHERE data_abertura IS NULL AND created_at IS NOT NULL;
