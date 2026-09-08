-- =========================================================================
-- 2026-09-08_fix_rls_log_percentual_bloqueio.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- CORREÇÃO: log_percentual_bloqueio_orcamento (histórico da tela
-- "Percentual de Bloqueio de Orçamento") rejeitava o INSERT do app com
-- "new row violates row-level security policy" — RLS ligado sem política
-- permissiva, mesmo problema já visto em config_periodo_ano_fiscal e
-- empresa_licenciada.
--
-- Mesmo tratamento das demais tabelas de config/log: RLS DESLIGADO. O
-- controle de quem pode alterar continua no app (usuarioPodeAlterarTela).
--
-- Idempotente — rodar quantas vezes precisar. Supabase → SQL Editor.
-- =========================================================================

ALTER TABLE log_percentual_bloqueio_orcamento DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência (relrowsecurity deve ser 'f'):
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'log_percentual_bloqueio_orcamento';
-- =========================================================================
