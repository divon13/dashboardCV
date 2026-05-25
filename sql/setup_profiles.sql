-- setup_profiles.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)
-- Cria tabelas de perfis, configurações e políticas RLS.
-- NOTA: Se as tabelas já existirem, este script não as recria (IF NOT EXISTS).

-- ─────────────────────────────────────────────────────────────
-- 1. Tabela de perfis (ligada ao auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'recrutador'
    CHECK (role IN ('admin', 'entrevistador', 'recrutador')),
  entrevistador_id INTEGER REFERENCES public."Entrevistador"(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Tabela de configurações do sistema
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT '',
  descricao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('empresa_nome', 'Dashboard RH',   'Nome exibido no sistema'),
  ('empresa_email', '',              'Email de contacto / notificações'),
  ('fuso_horario',  'Africa/Luanda', 'Fuso horário padrão'),
  ('lembrete_dias', '1',             'Dias de antecedência para lembretes')
ON CONFLICT (chave) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Ativar Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 4. Função auxiliar: lê o role do utilizador atual sem RLS
--    (SECURITY DEFINER evita recursão nas políticas que referenciam profiles)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 5. Políticas RLS — profiles
-- ─────────────────────────────────────────────────────────────

-- Utilizador lê o próprio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admin lê todos os perfis (usa a função para evitar recursão)
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- Inserir: apenas admin pode criar perfis (ou se ainda não há nenhum)
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1)
  );

-- Atualizar o próprio perfil
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Admin atualiza qualquer perfil
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 6. Políticas RLS — configuracoes_sistema
-- ─────────────────────────────────────────────────────────────

-- Qualquer autenticado pode ler configurações
CREATE POLICY "config_select" ON public.configuracoes_sistema
  FOR SELECT TO authenticated USING (true);

-- Apenas admin pode escrever configurações
CREATE POLICY "config_write_admin" ON public.configuracoes_sistema
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 6. Trigger: criar perfil automaticamente ao registar utilizador
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'recrutador')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Roles e o que cada um acede:
--   admin         → apenas Admin.html
--   entrevistador → apenas MinhaAgenda.html
--   recrutador    → painel principal (index, candidatos, vagas, pipeline, entrevistas)
-- ─────────────────────────────────────────────────────────────

-- Para promover um utilizador a admin após o primeiro login:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
