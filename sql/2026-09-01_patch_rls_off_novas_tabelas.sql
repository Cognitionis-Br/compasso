-- =========================================================================
-- 2026-09-01_patch_rls_off_novas_tabelas.sql
-- Compasso.
--
-- PATCH: as versões de `produtos` e `ajuste_orcamento_autorizacoes`
-- rodadas primeiro não tinham o DISABLE ROW LEVEL SECURITY (novos
-- projetos Supabase ligam RLS por padrão -> `produtos` retorna 0 linhas
-- pra chave publishable mesmo tendo o sentinela). Rode isto agora.
-- Idempotente.
-- =========================================================================

ALTER TABLE produtos                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE ajuste_orcamento_autorizacoes DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência (deve listar o sentinela):
--   SELECT * FROM produtos;
-- =========================================================================
