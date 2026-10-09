-- ============================================================
-- 2026-10-09_fase2a_delta.sql
-- Compasso — SOMENTE Compasso (fytynjjvzecljmgbtwec).
--
-- Fase 2A · delta do modelo M12A:
--   1. Colunas adicionais em fiscal_years (name, previous/next,
--      policy_version, row_version, preencher data_inicio/data_fim)
--   2. Migrar bc_package_status para enum de 4 valores
--   3. Criar fiscal_windows
--   4. Criar fiscal_milestones
--
-- Idempotente — seguro re-executar após falha parcial.
-- Rode no SQL Editor do Supabase (service_role ignora RLS).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Colunas adicionais em fiscal_years
-- ============================================================
ALTER TABLE fiscal_years
    ADD COLUMN IF NOT EXISTS name                   TEXT,
    ADD COLUMN IF NOT EXISTS previous_fiscal_year_id INT REFERENCES fiscal_years(id),
    ADD COLUMN IF NOT EXISTS next_fiscal_year_id     INT REFERENCES fiscal_years(id),
    ADD COLUMN IF NOT EXISTS policy_version          INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS row_version             INT NOT NULL DEFAULT 1;

-- ============================================================
-- 2. Preencher data_inicio / data_fim para exercícios legados
--    que ainda têm esses campos NULL.
--    Usa o mes_inicio mais recente de fiscal_periods.
--    Assume codigo = '2026', '2027', etc. (ano de início do exercício).
-- ============================================================
DO $$
DECLARE
    v_mes_inicio INT;
BEGIN
    SELECT mes_inicio INTO v_mes_inicio
    FROM fiscal_periods
    ORDER BY vigencia_de DESC
    LIMIT 1;

    IF v_mes_inicio IS NULL THEN
        v_mes_inicio := 4; -- fallback: abril
        RAISE NOTICE 'Nenhum fiscal_period encontrado; usando mês 4 (abril) como padrão.';
    END IF;

    -- Preenche data_inicio / data_fim onde ainda são NULL e o codigo é um ano de 4 dígitos
    UPDATE fiscal_years
    SET
        data_inicio = make_date(codigo::int, v_mes_inicio, 1),
        data_fim    = (make_date(codigo::int, v_mes_inicio, 1) + INTERVAL '1 year' - INTERVAL '1 day')::date
    WHERE data_inicio IS NULL
      AND codigo ~ '^\d{4}$';

    RAISE NOTICE 'data_inicio/data_fim preenchidos para % exercícios (mes_inicio=%)',
        (SELECT COUNT(*) FROM fiscal_years WHERE data_inicio IS NOT NULL),
        v_mes_inicio;

    -- Preenche name se NULL
    UPDATE fiscal_years
    SET name = 'Exercício Fiscal ' || codigo
    WHERE name IS NULL;
END $$;

-- ============================================================
-- 3. Migrar bc_package_status de 2 para 4 valores (M12A canônico)
--
--    Antes: 'ABERTO' | 'FECHADO'
--    Depois: 'NAO_INICIADO' | 'EM_COMPOSICAO' | 'EM_APROVACAO' | 'FECHADO'
--
--    Ordem importante: dropar o constraint ANTES do UPDATE,
--    senão 'NAO_INICIADO' viola o check antigo ('ABERTO','FECHADO').
-- ============================================================

-- 1. Dropa o constraint antigo primeiro
ALTER TABLE fiscal_years
    DROP CONSTRAINT IF EXISTS fiscal_years_bc_package_status_check;

-- 2. Converte o valor legado 'ABERTO' → 'NAO_INICIADO'
UPDATE fiscal_years
SET bc_package_status = 'NAO_INICIADO'
WHERE bc_package_status = 'ABERTO';

-- 3. Muda o DEFAULT para o novo valor canônico
ALTER TABLE fiscal_years
    ALTER COLUMN bc_package_status SET DEFAULT 'NAO_INICIADO';

-- 4. Cria o novo constraint com os 4 valores M12A
ALTER TABLE fiscal_years
    ADD CONSTRAINT fiscal_years_bc_package_status_check
    CHECK (bc_package_status IN (
        'NAO_INICIADO',
        'EM_COMPOSICAO',
        'EM_APROVACAO',
        'FECHADO'
    ));

-- Atualiza a VIEW anos_fiscais_config para refletir o novo valor
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
    status                      AS fy_status,
    data_inicio,
    data_fim,
    id                          AS fy_id,
    bc_package_status,
    name                        AS fy_name
FROM fiscal_years;

-- ============================================================
-- 4. Criar fiscal_windows
--    Referencia fiscal_years por codigo (TEXT) — mesmo padrão
--    de project_fiscal_year que usa fiscal_year_codigo TEXT.
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_windows (
    id                  SERIAL PRIMARY KEY,
    fiscal_year_codigo  TEXT NOT NULL REFERENCES fiscal_years(codigo) ON DELETE CASCADE,
    window_type         TEXT NOT NULL
        CHECK (window_type IN (
            'EXECUTION',
            'CLOSING_PREPARATION',
            'CLOSING',
            'BC_CREATION',
            'BC_ESTIMATION',
            'BC_PACKAGE'
        )),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    description         TEXT,
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fiscal_windows_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS fiscal_windows_year_idx
    ON fiscal_windows (fiscal_year_codigo);

-- ============================================================
-- 5. Criar fiscal_milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_milestones (
    id                  SERIAL PRIMARY KEY,
    fiscal_year_codigo  TEXT NOT NULL REFERENCES fiscal_years(codigo) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    milestone_date      DATE NOT NULL,
    milestone_type      TEXT NOT NULL
        CHECK (milestone_type IN (
            'PLANNING',
            'CLOSING',
            'BC_CYCLE',
            'CUSTOM'
        )),
    responsavel         TEXT,
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fiscal_milestones_year_idx
    ON fiscal_milestones (fiscal_year_codigo);

-- ============================================================
-- Habilitar RLS (sem policies por ora — acesso via service_role)
-- ============================================================
ALTER TABLE fiscal_windows    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_milestones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fiscal_windows'
          AND policyname = 'fiscal_windows: acesso autenticado'
    ) THEN
        EXECUTE 'CREATE POLICY "fiscal_windows: acesso autenticado"
            ON fiscal_windows FOR ALL USING (auth.role() = ''authenticated'')';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fiscal_milestones'
          AND policyname = 'fiscal_milestones: acesso autenticado'
    ) THEN
        EXECUTE 'CREATE POLICY "fiscal_milestones: acesso autenticado"
            ON fiscal_milestones FOR ALL USING (auth.role() = ''authenticated'')';
    END IF;
END $$;

-- ============================================================
-- Notify PostgREST para recarregar schema
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificação pós-migração
-- ============================================================
SELECT
    'fiscal_years'        AS tabela,
    COUNT(*)              AS total,
    COUNT(data_inicio)    AS com_data_inicio,
    COUNT(bc_package_status) FILTER (WHERE bc_package_status='NAO_INICIADO') AS status_nao_iniciado,
    COUNT(bc_package_status) FILTER (WHERE bc_package_status='FECHADO')      AS status_fechado
FROM fiscal_years
UNION ALL
SELECT
    'fiscal_windows'      AS tabela,
    COUNT(*)              AS total,
    0                     AS com_data_inicio,
    0                     AS status_nao_iniciado,
    0                     AS status_fechado
FROM fiscal_windows
UNION ALL
SELECT
    'fiscal_milestones'   AS tabela,
    COUNT(*)              AS total,
    0                     AS com_data_inicio,
    0                     AS status_nao_iniciado,
    0                     AS status_fechado
FROM fiscal_milestones;

COMMIT;

-- ============================================================
-- Conferência manual (opcional):
--   SELECT id, codigo, name, data_inicio, data_fim,
--          status, bc_package_status
--   FROM fiscal_years ORDER BY codigo;
-- ============================================================
