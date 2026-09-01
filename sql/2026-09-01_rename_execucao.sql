-- =========================================================================
-- 2026-09-01_rename_execucao.sql
-- Compasso — catalogo_atividades está sob RLS; roda no SQL Editor.
--
-- "Execução - Desenvolvimento" -> "Execução" (menu/headers já ajustados no
-- index.html neste commit). Só as linhas de fase_execution:* — UAT /
-- Go-Live / Conclusão de Projeto ficam sob o grupo EXECUÇÃO também.
-- Idempotente.
-- =========================================================================

UPDATE catalogo_atividades SET grupo    = 'EXECUÇÃO'          WHERE grupo    = 'EXECUÇÃO - DESENVOLVIMENTO';
UPDATE catalogo_atividades SET subgrupo = 'Execução'          WHERE subgrupo = 'Execução - Desenvolvimento';
UPDATE catalogo_atividades SET atividade = 'Planejar Execução' WHERE activity_key = 'fase_execution:a_planejar';

NOTIFY pgrst, 'reload schema';
-- =========================================================================
