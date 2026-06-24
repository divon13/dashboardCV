-- 05_add_registro_candidatos.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)
--
-- Adiciona o campo 'registro' à tabela 'candidatos' se não existir,
-- ou altera o tipo para timestamp se já existir com tipo incorreto.
-- Este campo armazena a data de registro do candidato.

-- Adiciona a coluna 'registro' se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'candidatos' 
        AND column_name = 'registro'
    ) THEN
        ALTER TABLE public.candidatos 
        ADD COLUMN registro TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Se a coluna já existir mas não for do tipo correto, altera o tipo
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'candidatos' 
        AND column_name = 'registro'
        AND data_type NOT IN ('timestamp with time zone', 'timestamp without time zone')
    ) THEN
        ALTER TABLE public.candidatos 
        ALTER COLUMN registro TYPE TIMESTAMPTZ USING registro::TIMESTAMPTZ;
    END IF;
END $$;

-- Atualiza registros existentes que não têm valor em 'registro'
-- Usa o 'created_at' como fallback
UPDATE public.candidatos
SET registro = created_at
WHERE registro IS NULL AND created_at IS NOT NULL;
