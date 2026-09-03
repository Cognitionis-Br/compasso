-- =========================================================================
-- 2026-09-03_fix_rls_empresa_licenciada.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- CORREÇÃO: as 3 tabelas da Fase 3 estavam rejeitando INSERT/UPSERT do app
-- com "new row violates row-level security policy" mesmo para o
-- Proprietário — o app grava com a chave publishable (papel anon) e o RLS
-- estava ligado sem política permissiva.
--
-- Mesmo tratamento das demais tabelas de config/log do sistema: RLS
-- DESLIGADO. O controle de quem pode alterar continua no app (gate
-- hardcoded ehProprietario; a Netlify Function de renovação valida a
-- assinatura HMAC no servidor).
--
-- Idempotente — rodar quantas vezes precisar. Supabase → SQL Editor.
-- =========================================================================

ALTER TABLE empresa_licenciada        DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_licenca_verificacao   DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_renovacao_licenca     DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência (relrowsecurity deve ser 'f' nas 3):
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('empresa_licenciada','log_licenca_verificacao','log_renovacao_licenca');
-- =========================================================================
