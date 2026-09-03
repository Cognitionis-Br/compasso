-- =========================================================================
-- 2026-09-03_fix_rls_config_orcamento.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- CORREÇÃO: as 3 tabelas de parâmetro/pendência criadas em 03/09 estavam
-- rejeitando INSERT do app com
--   "new row violates row-level security policy for table ..."
-- mesmo para o Proprietário — o app grava com a chave publishable (papel
-- anon), e o RLS estava ligado sem política permissiva.
--
-- Mesmo tratamento das demais tabelas de config/log do sistema
-- (config_email_geral, config_bloqueio_orcamento, ajuste_orcamento_autorizacoes,
-- adhoc_aprovacoes, log_fechamento_ano_fiscal, ...): RLS DESLIGADO. O
-- controle de quem pode alterar continua no app (gate hardcoded
-- ehAdministrador || ehProprietario, e a atividade delegável
-- 'controle_orcamento').
--
-- Idempotente — rodar quantas vezes precisar. Supabase → SQL Editor.
-- =========================================================================

ALTER TABLE config_periodo_ano_fiscal        DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_controle_orcamento        DISABLE ROW LEVEL SECURITY;
ALTER TABLE tradeoff_validacao_pendencias    DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência (relrowsecurity deve ser 'f' nas 3):
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('config_periodo_ano_fiscal','config_controle_orcamento','tradeoff_validacao_pendencias');
-- =========================================================================
