-- ============================================================
-- Fase 2C: BC sub_status cleanup + codigo_formato + FK validate
-- 2026-09-30
--
-- O que este script faz:
--   1. Verifica e valida a FK fk_bc_ano_fiscal (adicionada NOT VALID em 2B)
--   2. Rename sub_status DEVOLVIDO_FY → DEVOLVED (D-02)
--   3. Adiciona coluna codigo_formato a business_cases (BC-002 parcial)
--
-- Idempotente: seguro re-executar.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Validar FK fk_bc_ano_fiscal
--    Antes de rodar: confirmar que não há valores órfãos:
--    SELECT ano_fiscal FROM business_cases
--    WHERE ano_fiscal IS NOT NULL
--      AND ano_fiscal NOT IN (SELECT codigo FROM fiscal_years);
-- ============================================================
ALTER TABLE business_cases VALIDATE CONSTRAINT fk_bc_ano_fiscal;

-- ============================================================
-- 2. Rename sub_status DEVOLVIDO_FY → DEVOLVED (D-02)
--    business_cases: tabela real dos BCs
--    projects: por precaução (improvável ter esse sub_status aqui)
-- ============================================================
UPDATE business_cases
SET sub_status = 'DEVOLVED'
WHERE sub_status = 'DEVOLVIDO_FY';

UPDATE projects
SET sub_status = 'DEVOLVED'
WHERE sub_status = 'DEVOLVIDO_FY';

-- Também na tabela legada projetos (via VIEW o trigger rotearia certo,
-- mas atualizamos direto nas tabelas base para segurança)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'projetos_pre_v3_backup'
    ) THEN
        UPDATE projetos_pre_v3_backup
        SET sub_status = 'DEVOLVED'
        WHERE sub_status = 'DEVOLVIDO_FY';
        RAISE NOTICE 'projetos_pre_v3_backup: sub_status DEVOLVIDO_FY migrado.';
    END IF;
END $$;

-- ============================================================
-- 3. Coluna codigo_formato em business_cases (BC-002 parcial)
--    Suporta o novo formato BC-AAAA-NNNN (D-1).
--    Hoje nulo para todos; preenchido quando o gerador de código
--    for implementado (Fase futura).
--    Valores possíveis: 'PRJ' (legado) | 'BC' (novo formato)
-- ============================================================
ALTER TABLE business_cases
    ADD COLUMN IF NOT EXISTS codigo_formato TEXT DEFAULT 'PRJ'
        CHECK (codigo_formato IN ('PRJ','BC'));

-- ============================================================
-- Verificação final
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM business_cases WHERE sub_status = 'DEVOLVIDO_FY') AS devolvido_fy_restantes,
    (SELECT COUNT(*) FROM business_cases WHERE sub_status = 'DEVOLVED')     AS devolved_total,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'business_cases' AND column_name = 'codigo_formato') AS col_codigo_formato,
    (SELECT convalidated FROM pg_constraint
     WHERE conname = 'fk_bc_ano_fiscal')                                     AS fk_validated;

COMMIT;
