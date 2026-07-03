-- 06_add_campos_contratacao.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)
--
-- Adiciona campos de contratação à tabela 'candidatos'
-- Estes campos são preenchidos quando um candidato é movido para a coluna "Contratado"

-- Adiciona a coluna 'data_inicio' se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'candidatos' 
        AND column_name = 'data_inicio'
    ) THEN
        ALTER TABLE public.candidatos 
        ADD COLUMN data_inicio DATE;
    END IF;
END $$;

-- Adiciona a coluna 'hora_entrada' se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'candidatos' 
        AND column_name = 'hora_entrada'
    ) THEN
        ALTER TABLE public.candidatos 
        ADD COLUMN hora_entrada TIME;
    END IF;
END $$;

-- Adiciona a coluna 'hora_saida' se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'candidatos' 
        AND column_name = 'hora_saida'
    ) THEN
        ALTER TABLE public.candidatos 
        ADD COLUMN hora_saida TIME;
    END IF;
END $$;
