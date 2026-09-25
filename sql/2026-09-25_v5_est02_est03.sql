-- =========================================================================
-- 2026-09-25_v5_est02_est03.sql
-- Compasso 2.0 — V5 (Estimation, continuação): EST-02 (Requerimentos) e
-- EST-03 (Especificação/Technical) — mesmo mecanismo de Rate Card do
-- EST-01 (V4), só que disparado em outra fase e preenchendo
-- horas_req/val_req (REQ-02) ou horas_tech/val_tech (SPEC-02) em vez de
-- horas_bc/val_bc.
--
-- Puramente aditivo — só acrescenta uma coluna à tabela criada no V4
-- (`business_case_estimativas`), sem tocar em `business_cases`/`projects`.
-- Reversível: ALTER TABLE business_case_estimativas DROP COLUMN fase;
-- =========================================================================

ALTER TABLE business_case_estimativas ADD COLUMN IF NOT EXISTS fase TEXT NOT NULL DEFAULT 'BC';

ALTER TABLE business_case_estimativas DROP CONSTRAINT IF EXISTS business_case_estimativas_fase_check;
ALTER TABLE business_case_estimativas ADD CONSTRAINT business_case_estimativas_fase_check CHECK (fase IN ('BC', 'REQ', 'TECH'));

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT fase, count(*) FROM business_case_estimativas GROUP BY fase;
-- =========================================================================
