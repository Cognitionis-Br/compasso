-- =========================================================================
-- 2026-09-01_fase2_crud_funcao_atividades.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- FASE 2 do endurecimento de RBAC/RLS (ver SEGURANCA.md).
-- Granularidade CRUD por concessão: `funcao_atividades` ganha 4 flags.
--
--   pode_consultar  DEFAULT true   -> concessão existente = "pode ver a tela"
--   pode_incluir    DEFAULT false
--   pode_alterar    DEFAULT false
--   pode_deletar    DEFAULT false
--
-- O `ADD COLUMN ... NOT NULL DEFAULT true` já preenche `pode_consultar = true`
-- em todas as 131 concessões atuais — nenhum UPDATE de migração necessário.
-- Incluir/alterar/deletar nascem `false` (a UI da matriz de Funções e
-- Permissões passa a marcar cada um; incluir/alterar/deletar implicam
-- consultar, reforçado no `saveFuncao`).
--
-- Idempotente (`ADD COLUMN IF NOT EXISTS`). Supabase -> SQL Editor.
-- =========================================================================

ALTER TABLE funcao_atividades ADD COLUMN IF NOT EXISTS pode_consultar BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE funcao_atividades ADD COLUMN IF NOT EXISTS pode_incluir   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE funcao_atividades ADD COLUMN IF NOT EXISTS pode_alterar   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE funcao_atividades ADD COLUMN IF NOT EXISTS pode_deletar   BOOLEAN NOT NULL DEFAULT false;

-- Reforço: se a coluna já existisse de antes com outro default/nulos.
UPDATE funcao_atividades SET pode_consultar = true  WHERE pode_consultar IS NULL;
UPDATE funcao_atividades SET pode_incluir   = false WHERE pode_incluir   IS NULL;
UPDATE funcao_atividades SET pode_alterar   = false WHERE pode_alterar   IS NULL;
UPDATE funcao_atividades SET pode_deletar   = false WHERE pode_deletar   IS NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar
--   FROM funcao_atividades ORDER BY funcao_id, atividade_id;
-- =========================================================================
