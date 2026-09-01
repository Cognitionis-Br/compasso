-- =========================================================================
-- 2026-09-01_fase4_rls.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- FASE 4 do endurecimento de RBAC/RLS (ver SEGURANCA.md).
-- Liga RLS em 5 tabelas de controle de acesso.
--
--   LEITURA  (SELECT):
--     funcoes, funcao_atividades, catalogo_atividades, licenca_modulos
--       -> livre para qualquer usuário AUTENTICADO (o app precisa lê-las
--          pra montar menu/telas).
--     usuario_funcoes
--       -> cada usuário só vê as PRÓPRIAS linhas; irrestrito/proprietário
--          vê todas (a tela de Atribuição de Funções, restrita a admin,
--          lista todos).
--   ESCRITA  (INSERT/UPDATE/DELETE):
--     funcoes, funcao_atividades, usuario_funcoes, catalogo_atividades
--       -> só quem tem função com acesso_irrestrito = true OU eh_proprietario = true
--     licenca_modulos
--       -> só quem tem função com eh_proprietario = true
--
-- A checagem usa 2 funções SECURITY DEFINER (rodam com o dono, então não
-- disparam RLS de novo -> sem recursão) que resolvem as funções do
-- auth.uid() atual contra usuario_funcoes + funcoes.
--
-- service_role (migrações via SQL Editor, edge function admin-create-user)
-- ignora RLS por completo — nada disso trava deploy/manutenção.
--
-- REVISAR ANTES DE RODAR. Idempotente (CREATE OR REPLACE / DROP POLICY IF
-- EXISTS / ENABLE RLS é no-op se já ligado). Supabase -> SQL Editor.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Funções de apoio
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_atual_irrestrito()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuario_funcoes uf
    JOIN funcoes f ON f.id = uf.funcao_id
    WHERE uf.usuario_id = auth.uid()
      AND (f.acesso_irrestrito = true OR f.eh_proprietario = true)
  );
$$;

CREATE OR REPLACE FUNCTION public.usuario_atual_proprietario()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuario_funcoes uf
    JOIN funcoes f ON f.id = uf.funcao_id
    WHERE uf.usuario_id = auth.uid()
      AND f.eh_proprietario = true
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_atual_irrestrito()   FROM public;
REVOKE ALL ON FUNCTION public.usuario_atual_proprietario() FROM public;
GRANT EXECUTE ON FUNCTION public.usuario_atual_irrestrito()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_atual_proprietario() TO authenticated;

-- -------------------------------------------------------------------------
-- Macro por tabela: SELECT livre p/ authenticated; escrita só irrestrito.
-- (Policies criadas ANTES do ENABLE — nunca há janela "RLS on, sem policy".)
-- -------------------------------------------------------------------------

-- ===== funcoes =====
DROP POLICY IF EXISTS funcoes_sel ON funcoes;
DROP POLICY IF EXISTS funcoes_ins ON funcoes;
DROP POLICY IF EXISTS funcoes_upd ON funcoes;
DROP POLICY IF EXISTS funcoes_del ON funcoes;
CREATE POLICY funcoes_sel ON funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY funcoes_ins ON funcoes FOR INSERT TO authenticated WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY funcoes_upd ON funcoes FOR UPDATE TO authenticated USING (public.usuario_atual_irrestrito()) WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY funcoes_del ON funcoes FOR DELETE TO authenticated USING (public.usuario_atual_irrestrito());
ALTER TABLE funcoes ENABLE ROW LEVEL SECURITY;

-- ===== funcao_atividades =====
DROP POLICY IF EXISTS funcao_atividades_sel ON funcao_atividades;
DROP POLICY IF EXISTS funcao_atividades_ins ON funcao_atividades;
DROP POLICY IF EXISTS funcao_atividades_upd ON funcao_atividades;
DROP POLICY IF EXISTS funcao_atividades_del ON funcao_atividades;
CREATE POLICY funcao_atividades_sel ON funcao_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY funcao_atividades_ins ON funcao_atividades FOR INSERT TO authenticated WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY funcao_atividades_upd ON funcao_atividades FOR UPDATE TO authenticated USING (public.usuario_atual_irrestrito()) WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY funcao_atividades_del ON funcao_atividades FOR DELETE TO authenticated USING (public.usuario_atual_irrestrito());
ALTER TABLE funcao_atividades ENABLE ROW LEVEL SECURITY;

-- ===== usuario_funcoes =====
DROP POLICY IF EXISTS usuario_funcoes_sel ON usuario_funcoes;
DROP POLICY IF EXISTS usuario_funcoes_ins ON usuario_funcoes;
DROP POLICY IF EXISTS usuario_funcoes_upd ON usuario_funcoes;
DROP POLICY IF EXISTS usuario_funcoes_del ON usuario_funcoes;
CREATE POLICY usuario_funcoes_sel ON usuario_funcoes FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.usuario_atual_irrestrito());
CREATE POLICY usuario_funcoes_ins ON usuario_funcoes FOR INSERT TO authenticated WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY usuario_funcoes_upd ON usuario_funcoes FOR UPDATE TO authenticated USING (public.usuario_atual_irrestrito()) WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY usuario_funcoes_del ON usuario_funcoes FOR DELETE TO authenticated USING (public.usuario_atual_irrestrito());
ALTER TABLE usuario_funcoes ENABLE ROW LEVEL SECURITY;

-- ===== catalogo_atividades =====
DROP POLICY IF EXISTS catalogo_atividades_sel ON catalogo_atividades;
DROP POLICY IF EXISTS catalogo_atividades_ins ON catalogo_atividades;
DROP POLICY IF EXISTS catalogo_atividades_upd ON catalogo_atividades;
DROP POLICY IF EXISTS catalogo_atividades_del ON catalogo_atividades;
CREATE POLICY catalogo_atividades_sel ON catalogo_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_atividades_ins ON catalogo_atividades FOR INSERT TO authenticated WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY catalogo_atividades_upd ON catalogo_atividades FOR UPDATE TO authenticated USING (public.usuario_atual_irrestrito()) WITH CHECK (public.usuario_atual_irrestrito());
CREATE POLICY catalogo_atividades_del ON catalogo_atividades FOR DELETE TO authenticated USING (public.usuario_atual_irrestrito());
ALTER TABLE catalogo_atividades ENABLE ROW LEVEL SECURITY;

-- ===== licenca_modulos  (escrita só Proprietário) =====
DROP POLICY IF EXISTS licenca_modulos_sel ON licenca_modulos;
DROP POLICY IF EXISTS licenca_modulos_ins ON licenca_modulos;
DROP POLICY IF EXISTS licenca_modulos_upd ON licenca_modulos;
DROP POLICY IF EXISTS licenca_modulos_del ON licenca_modulos;
CREATE POLICY licenca_modulos_sel ON licenca_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY licenca_modulos_ins ON licenca_modulos FOR INSERT TO authenticated WITH CHECK (public.usuario_atual_proprietario());
CREATE POLICY licenca_modulos_upd ON licenca_modulos FOR UPDATE TO authenticated USING (public.usuario_atual_proprietario()) WITH CHECK (public.usuario_atual_proprietario());
CREATE POLICY licenca_modulos_del ON licenca_modulos FOR DELETE TO authenticated USING (public.usuario_atual_proprietario());
ALTER TABLE licenca_modulos ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =========================================================================
-- Conferência pós-execução:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('funcoes','funcao_atividades','usuario_funcoes',
--                     'catalogo_atividades','licenca_modulos');
--     -- relrowsecurity deve ser true nas 5
--
--   SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE tablename IN ('funcoes','funcao_atividades','usuario_funcoes',
--                       'catalogo_atividades','licenca_modulos')
--   ORDER BY tablename, cmd;
--     -- 4 policies por tabela (SELECT/INSERT/UPDATE/DELETE)
--
-- Teste funcional (logado como ADMINISTRADOR ou PROPRIETARIO):
--   - abrir Funções e Permissões, salvar uma função -> OK
--   - abrir qualquer tela -> menu monta normalmente (SELECT livre)
-- Teste (logado como usuário SEM acesso_irrestrito):
--   - leitura do catálogo/menus funciona; nenhuma escrita nessas 5 tabelas
-- =========================================================================
