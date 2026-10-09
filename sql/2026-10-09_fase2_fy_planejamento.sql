-- ============================================================
-- 2026-10-09_fase2_fy_planejamento.sql
-- Compasso — Fase 2: VIS-FY-03 Planejamento / Pacote de BC.
--
-- Adiciona 3 colunas:
--   1. business_cases.classificacao_estrategica
--   2. business_cases.fiscal_year_codigo_alvo
--   3. pacote_fy_itens.decisao_fy
--
-- Idempotente. Rode no Supabase SQL Editor (Compasso).
-- ============================================================

-- 1. Classificação estratégica do BC (campo livre, ex.: "Eficiência operacional")
ALTER TABLE business_cases
    ADD COLUMN IF NOT EXISTS classificacao_estrategica TEXT;

-- 2. Decisão individual do BC dentro do pacote FY
--    Valores: SEM_DECISAO (default) | APROVADO | DEVOLVIDO | POSTERGADO
ALTER TABLE pacote_fy_itens
    ADD COLUMN IF NOT EXISTS decisao_fy TEXT NOT NULL DEFAULT 'SEM_DECISAO'
        CHECK (decisao_fy IN ('SEM_DECISAO', 'APROVADO', 'DEVOLVIDO', 'POSTERGADO'));

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT codigo, classificacao_estrategica, fiscal_year_codigo_alvo
--   FROM business_cases LIMIT 10;
--
--   SELECT id, business_case_codigo, decisao_fy
--   FROM pacote_fy_itens LIMIT 10;
