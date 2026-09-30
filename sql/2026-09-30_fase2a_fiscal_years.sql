-- ============================================================
-- Fase 2A: M12A Migration — fiscal_years + backward-compat VIEWs
-- 2026-09-30
--
-- Ordem de execução:
--   1. Criar tabelas fiscal_years e fiscal_periods
--   2. Migrar dados de anos_fiscais_config e config_periodo_ano_fiscal
--   3. Renomear tabelas originais para _legado
--   4. Criar VIEWs de compatibilidade com INSTEAD OF triggers
--
-- Idempotente: seguro re-executar após falha parcial.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabela fiscal_years
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_years (
    id      SERIAL PRIMARY KEY,
    codigo  TEXT UNIQUE NOT NULL,
    status  TEXT NOT NULL DEFAULT 'PLANNING'
        CHECK (status IN ('PLANNING','BUDGETING','OPEN','CLOSING','CLOSED','REOPENED')),

    -- Colunas legadas mantidas para compatibilidade com a VIEW
    recebimento_demandas_aberto  BOOLEAN NOT NULL DEFAULT false,
    orcamento_fechado            BOOLEAN NOT NULL DEFAULT false,
    ano_fiscal_fechado           BOOLEAN NOT NULL DEFAULT false,
    aberto_por                   TEXT,
    aberto_em                    TIMESTAMPTZ,
    fechado_por                  TEXT,
    fechado_em                   TIMESTAMPTZ,
    af_fechado_por               TEXT,
    af_fechado_em                TIMESTAMPTZ,
    af_fechado_observacao        TEXT,
    valor_total_fechado          NUMERIC(14,2),
    qtd_projetos_fechado         INTEGER,

    -- Campos M12A novos
    data_inicio  DATE,
    data_fim     DATE,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Tabela fiscal_periods (substitui config_periodo_ano_fiscal)
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id          SERIAL PRIMARY KEY,
    vigencia_de DATE UNIQUE NOT NULL,
    mes_inicio  INTEGER NOT NULL CHECK (mes_inicio BETWEEN 1 AND 12),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Migrar anos_fiscais_config → fiscal_years
--    Executado apenas se anos_fiscais_config ainda é uma tabela
--    base E fiscal_years ainda está vazia.
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'anos_fiscais_config'
          AND table_type   = 'BASE TABLE'
    ) AND NOT EXISTS (SELECT 1 FROM fiscal_years LIMIT 1) THEN

        INSERT INTO fiscal_years (
            codigo,
            status,
            recebimento_demandas_aberto,
            orcamento_fechado,
            ano_fiscal_fechado,
            aberto_por, aberto_em,
            fechado_por, fechado_em,
            af_fechado_por, af_fechado_em, af_fechado_observacao,
            valor_total_fechado, qtd_projetos_fechado
        )
        SELECT
            ano_fiscal AS codigo,
            CASE
                WHEN ano_fiscal_fechado          = true THEN 'CLOSED'
                WHEN orcamento_fechado           = true THEN 'OPEN'
                WHEN recebimento_demandas_aberto = true THEN 'PLANNING'
                ELSE 'PLANNING'
            END AS status,
            COALESCE(recebimento_demandas_aberto, false),
            COALESCE(orcamento_fechado, false),
            COALESCE(ano_fiscal_fechado, false),
            aberto_por, aberto_em,
            fechado_por, fechado_em,
            af_fechado_por, af_fechado_em, af_fechado_observacao,
            valor_total_fechado, qtd_projetos_fechado
        FROM anos_fiscais_config
        ON CONFLICT (codigo) DO NOTHING;

        RAISE NOTICE 'Migrados % registros de anos_fiscais_config → fiscal_years.',
            (SELECT COUNT(*) FROM fiscal_years);
    END IF;
END $$;

-- ============================================================
-- 4. Migrar config_periodo_ano_fiscal → fiscal_periods
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'config_periodo_ano_fiscal'
          AND table_type   = 'BASE TABLE'
    ) AND NOT EXISTS (SELECT 1 FROM fiscal_periods LIMIT 1) THEN

        INSERT INTO fiscal_periods (vigencia_de, mes_inicio)
        SELECT vigencia_de, mes_inicio
        FROM config_periodo_ano_fiscal
        ON CONFLICT (vigencia_de) DO NOTHING;

        RAISE NOTICE 'Migrados % registros de config_periodo_ano_fiscal → fiscal_periods.',
            (SELECT COUNT(*) FROM fiscal_periods);
    END IF;
END $$;

-- ============================================================
-- 5. Renomear anos_fiscais_config → _legado
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'anos_fiscais_config'
          AND table_type   = 'BASE TABLE'
    ) THEN
        ALTER TABLE anos_fiscais_config RENAME TO anos_fiscais_config_legado;
        RAISE NOTICE 'Tabela anos_fiscais_config renomeada para anos_fiscais_config_legado.';
    END IF;
END $$;

-- ============================================================
-- 6. Renomear config_periodo_ano_fiscal → _legado
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'config_periodo_ano_fiscal'
          AND table_type   = 'BASE TABLE'
    ) THEN
        ALTER TABLE config_periodo_ano_fiscal RENAME TO config_periodo_ano_fiscal_legado;
        RAISE NOTICE 'Tabela config_periodo_ano_fiscal renomeada para config_periodo_ano_fiscal_legado.';
    END IF;
END $$;

-- ============================================================
-- 7. VIEW anos_fiscais_config (leitura + compatibilidade de escrita)
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
    -- Campos M12A expostos adicionalmente (não quebram clientes antigos)
    status                      AS fy_status,
    data_inicio,
    data_fim,
    id                          AS fy_id
FROM fiscal_years;

-- ============================================================
-- 8. Funções e triggers INSTEAD OF para anos_fiscais_config
--    Permite que código legado continue escrevendo via .from('anos_fiscais_config')
--    enquanto os arquivos JS são migrados para escrever direto em fiscal_years.
-- ============================================================

-- Função: INSERT / UPSERT
CREATE OR REPLACE FUNCTION _fn_afc_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    novo_status TEXT;
BEGIN
    novo_status := CASE
        WHEN NEW.ano_fiscal_fechado          = true THEN 'CLOSED'
        WHEN NEW.orcamento_fechado           = true THEN 'OPEN'
        WHEN NEW.recebimento_demandas_aberto = true THEN 'PLANNING'
        ELSE 'PLANNING'
    END;

    INSERT INTO fiscal_years (
        codigo,
        status,
        recebimento_demandas_aberto,
        orcamento_fechado,
        ano_fiscal_fechado,
        aberto_por, aberto_em,
        fechado_por, fechado_em,
        af_fechado_por, af_fechado_em, af_fechado_observacao,
        valor_total_fechado, qtd_projetos_fechado
    ) VALUES (
        NEW.ano_fiscal,
        novo_status,
        COALESCE(NEW.recebimento_demandas_aberto, false),
        COALESCE(NEW.orcamento_fechado, false),
        COALESCE(NEW.ano_fiscal_fechado, false),
        NEW.aberto_por, NEW.aberto_em,
        NEW.fechado_por, NEW.fechado_em,
        NEW.af_fechado_por, NEW.af_fechado_em, NEW.af_fechado_observacao,
        NEW.valor_total_fechado, NEW.qtd_projetos_fechado
    )
    ON CONFLICT (codigo) DO UPDATE SET
        status = CASE
            WHEN EXCLUDED.ano_fiscal_fechado          = true THEN 'CLOSED'
            WHEN EXCLUDED.orcamento_fechado           = true THEN 'OPEN'
            WHEN EXCLUDED.recebimento_demandas_aberto = true THEN 'PLANNING'
            ELSE fiscal_years.status
        END,
        recebimento_demandas_aberto = COALESCE(EXCLUDED.recebimento_demandas_aberto, fiscal_years.recebimento_demandas_aberto),
        orcamento_fechado           = COALESCE(EXCLUDED.orcamento_fechado,           fiscal_years.orcamento_fechado),
        ano_fiscal_fechado          = COALESCE(EXCLUDED.ano_fiscal_fechado,          fiscal_years.ano_fiscal_fechado),
        aberto_por    = COALESCE(EXCLUDED.aberto_por,    fiscal_years.aberto_por),
        aberto_em     = COALESCE(EXCLUDED.aberto_em,     fiscal_years.aberto_em),
        fechado_por   = COALESCE(EXCLUDED.fechado_por,   fiscal_years.fechado_por),
        fechado_em    = COALESCE(EXCLUDED.fechado_em,    fiscal_years.fechado_em),
        af_fechado_por          = COALESCE(EXCLUDED.af_fechado_por,         fiscal_years.af_fechado_por),
        af_fechado_em           = COALESCE(EXCLUDED.af_fechado_em,          fiscal_years.af_fechado_em),
        af_fechado_observacao   = COALESCE(EXCLUDED.af_fechado_observacao,  fiscal_years.af_fechado_observacao),
        valor_total_fechado     = COALESCE(EXCLUDED.valor_total_fechado,    fiscal_years.valor_total_fechado),
        qtd_projetos_fechado    = COALESCE(EXCLUDED.qtd_projetos_fechado,   fiscal_years.qtd_projetos_fechado),
        updated_at = now();

    RETURN NEW;
END $$;

-- Função: UPDATE simples (.update(...).eq(...))
CREATE OR REPLACE FUNCTION _fn_afc_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE fiscal_years SET
        status = CASE
            WHEN NEW.ano_fiscal_fechado          = true THEN 'CLOSED'
            WHEN NEW.orcamento_fechado           = true THEN 'OPEN'
            WHEN NEW.recebimento_demandas_aberto = true THEN 'PLANNING'
            ELSE status
        END,
        recebimento_demandas_aberto = COALESCE(NEW.recebimento_demandas_aberto, recebimento_demandas_aberto),
        orcamento_fechado           = COALESCE(NEW.orcamento_fechado,           orcamento_fechado),
        ano_fiscal_fechado          = COALESCE(NEW.ano_fiscal_fechado,          ano_fiscal_fechado),
        aberto_por    = COALESCE(NEW.aberto_por,    aberto_por),
        aberto_em     = COALESCE(NEW.aberto_em,     aberto_em),
        fechado_por   = COALESCE(NEW.fechado_por,   fechado_por),
        fechado_em    = COALESCE(NEW.fechado_em,    fechado_em),
        af_fechado_por        = COALESCE(NEW.af_fechado_por,         af_fechado_por),
        af_fechado_em         = COALESCE(NEW.af_fechado_em,          af_fechado_em),
        af_fechado_observacao = COALESCE(NEW.af_fechado_observacao,  af_fechado_observacao),
        valor_total_fechado   = COALESCE(NEW.valor_total_fechado,    valor_total_fechado),
        qtd_projetos_fechado  = COALESCE(NEW.qtd_projetos_fechado,   qtd_projetos_fechado),
        updated_at = now()
    WHERE codigo = NEW.ano_fiscal;
    RETURN NEW;
END $$;

-- Função: DELETE
CREATE OR REPLACE FUNCTION _fn_afc_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM fiscal_years WHERE codigo = OLD.ano_fiscal;
    RETURN OLD;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS trg_afc_insert ON anos_fiscais_config;
CREATE TRIGGER trg_afc_insert
    INSTEAD OF INSERT ON anos_fiscais_config
    FOR EACH ROW EXECUTE FUNCTION _fn_afc_insert();

DROP TRIGGER IF EXISTS trg_afc_update ON anos_fiscais_config;
CREATE TRIGGER trg_afc_update
    INSTEAD OF UPDATE ON anos_fiscais_config
    FOR EACH ROW EXECUTE FUNCTION _fn_afc_update();

DROP TRIGGER IF EXISTS trg_afc_delete ON anos_fiscais_config;
CREATE TRIGGER trg_afc_delete
    INSTEAD OF DELETE ON anos_fiscais_config
    FOR EACH ROW EXECUTE FUNCTION _fn_afc_delete();

-- ============================================================
-- 9. VIEW config_periodo_ano_fiscal (leitura + compatibilidade de escrita)
-- ============================================================
CREATE OR REPLACE VIEW config_periodo_ano_fiscal AS
SELECT id, vigencia_de, mes_inicio, created_at
FROM fiscal_periods;

CREATE OR REPLACE FUNCTION _fn_cpaf_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO fiscal_periods (vigencia_de, mes_inicio)
    VALUES (NEW.vigencia_de, NEW.mes_inicio)
    ON CONFLICT (vigencia_de) DO UPDATE SET
        mes_inicio = EXCLUDED.mes_inicio;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cpaf_insert ON config_periodo_ano_fiscal;
CREATE TRIGGER trg_cpaf_insert
    INSTEAD OF INSERT ON config_periodo_ano_fiscal
    FOR EACH ROW EXECUTE FUNCTION _fn_cpaf_insert();

-- ============================================================
-- Verificação pós-migração
-- ============================================================
SELECT
    'fiscal_years'   AS tabela, COUNT(*) AS linhas FROM fiscal_years
UNION ALL
SELECT
    'fiscal_periods' AS tabela, COUNT(*) AS linhas FROM fiscal_periods
UNION ALL
SELECT
    'legado_afc'     AS tabela, COUNT(*) AS linhas FROM anos_fiscais_config_legado
UNION ALL
SELECT
    'legado_cpaf'    AS tabela, COUNT(*) AS linhas
FROM config_periodo_ano_fiscal_legado;

COMMIT;
