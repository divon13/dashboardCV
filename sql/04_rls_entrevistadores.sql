-- 04_rls_entrevistadores.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)
--
-- Corrige o dropdown de entrevistadores no agendamento de entrevistas:
-- recrutadores precisam de ler perfis com role = 'entrevistador'.
-- Sem esta política, a query devolve lista vazia por causa do RLS.

-- Função auxiliar (criar se ainda não existir)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recrutadores (e admin) podem listar entrevistadores ativos
DROP POLICY IF EXISTS "profiles_select_entrevistadores" ON public.profiles;
CREATE POLICY "profiles_select_entrevistadores" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    role = 'entrevistador'
    AND ativo = true
    AND public.get_my_role() IN ('recrutador', 'admin')
  );
