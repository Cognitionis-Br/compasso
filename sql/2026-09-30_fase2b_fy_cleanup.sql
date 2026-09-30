-- ============================================================
-- Fase 2B: M12A Continuação — FY cleanup + bc_package_status + BC FK
-- 2026-09-30
--
-- O que este script faz:
--   1. Dropa os INSTEAD OF triggers e funções da VIEW anos_fiscais_config
--      (todos os writes JS já vão direto para fiscal_years — confirmado
--      por grep; a VIEW passa a ser estritamente read-only)
--   2. Adiciona coluna bc_package_status em fiscal_years e popula
--      a partir de pacotes_fy (FY-09)
--   3. Atualiza a VIEW anos_fiscais_config para expor bc_package_status
--   4. Adiciona FK business_cases.ano_fiscal → fiscal_years(codigo)
--      com NOT VALID (seguro: não valida rows existentes, só novas/
--      atualizadas; rodar VALIDATE CONSTRAINT depois se desejar)
--
-- Idempotente: seguro re-executar.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP triggers INSTEAD OF da VIEW anos_fiscais_config
-- ============================================================
DROP TRIGGER IF EXISTS trg_afc_insert ON anos_fiscais_config;
DROP TRIGGER IF EXISTS trg_afc_update ON anos_fiscais_config;
DROP TRIGGER IF EXISTS trg_afc_delete ON anos_fiscais_config;

DROP FUNCTION IF EXISTS _fn_afc_insert();
DROP FUNCTION IF EXISTS _fn_afc_update();
DROP FUNCTION IF EXISTS _fn_afc_delete();

-- ============================================================
-- 2. Coluna bc_package_status em fiscal_years (FY-09)
--    'ABERTO'  = pacote FY ainda não fechado para este exercício
--    'FECHADO' = pacote FY persistido (pacotes_fy tem um registro FECHADO)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'fiscal_years'
          AND column_name  = 'bc_package_status'
    ) THEN
        ALTER TABLE fiscal_years
            ADD COLUMN bc_package_status TEXT NOT NULL DEFAULT 'ABERTO'
                CHECK (bc_package_status IN ('ABERTO','FECHADO'));

        RAISE NOTICE 'Coluna bc_package_status adicionada a fiscal_years.';
    END IF;
END $$;

-- Popula bc_package_status para exercícios que já têm pacote fechado
UPDATE fiscal_years fy
SET    bc_package_status = 'FECHADO'
WHERE  EXISTS (
    SELECT 1 FROM pacotes_fy p
    WHERE  p.ano_fiscal = fy.codigo
      AND  p.status     = 'FECHADO'
);

-- ============================================================
-- 3. Atualizar VIEW anos_fiscais_config para expor bc_package_status
-- ============================================================
CREATE OR REPLACE VIEW anos_fiscais_config AS
SELECT
    codigo                      AS ano_fiscal,
    recebimento_demandas_aberto,
    orcamento_fechado,
    ano_fiscal_fechado,
    aberto_por,
    aberto_em,
    fechado_por,
    fechado_em,
    af_fechado_por,
    af_fechado_em,
    af_fechado_observacao,
    valor_total_fechado,
    qtd_projetos_fechado,
    -- Campos M12A (ordem idêntica à VIEW da Fase 2A — novos campos só no final)
    status                      AS fy_status,
    data_inicio,
    data_fim,
    id                          AS fy_id,
    bc_package_status
FROM fiscal_years;

-- ============================================================
-- 4. FK business_cases.ano_fiscal → fiscal_years(codigo)
--    NOT VALID: aplica apenas a novas linhas/updates; não valida
--    dados históricos existentes (seguro para produção com dados).
--    Para validar rows existentes: VALIDATE CONSTRAINT fk_bc_ano_fiscal
-- ============================================================

-- Verificação prévia (informativa — não bloqueia):
DO $$
DECLARE
    v_invalidos INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_invalidos
    FROM business_cases bc
    WHERE bc.ano_fiscal IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM fiscal_years fy WHERE fy.codigo = bc.ano_fiscal
      );

    IF v_invalidos > 0 THEN
        RAISE WARNING 'Atenção: % registros em business_cases.ano_fiscal não correspondem a nenhum fiscal_year. A FK será criada como NOT VALID — esses registros não serão bloqueados agora mas aparecerão em VALIDATE CONSTRAINT.',
            v_invalidos;
    ELSE
        RAISE NOTICE 'OK: todos os valores de business_cases.ano_fiscal têm correspondência em fiscal_years (ou são NULL).';
    END IF;
END $$;

ALTER TABLE business_cases
    DROP CONSTRAINT IF EXISTS fk_bc_ano_fiscal;

ALTER TABLE business_cases
    ADD CONSTRAINT fk_bc_ano_fiscal
        FOREIGN KEY (ano_fiscal)
        REFERENCES fiscal_years(codigo)
        ON UPDATE CASCADE
        NOT VALID;

-- ============================================================
-- Verificação final
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM fiscal_years)                          AS fiscal_years_total,
    (SELECT COUNT(*) FROM fiscal_years WHERE bc_package_status = 'FECHADO') AS fy_com_pacote_fechado,
    (SELECT COUNT(*) FROM business_cases WHERE ano_fiscal IS NOT NULL)      AS bc_com_ano_fiscal,
    (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE constraint_name = 'fk_bc_ano_fiscal'
       AND table_name = 'business_cases')                        AS fk_criada;

COMMIT;
