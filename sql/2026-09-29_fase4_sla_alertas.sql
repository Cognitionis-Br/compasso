-- =========================================================================
-- 2026-09-29_fase4_sla_alertas.sql
-- Compasso 2.0 — Fase 4: Prazos, alertas e escalonamento (D-09)
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + INSERT ON CONFLICT DO NOTHING
-- + ADD COLUMN IF NOT EXISTS + DROP/CREATE VIEW + DROP/CREATE TRIGGER.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Tabela de configuração de SLA por etapa
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_config (
    etapa                 TEXT PRIMARY KEY,
    dias_uteis            INT  NOT NULL DEFAULT 10,
    aviso_antecipado_dias INT  NOT NULL DEFAULT 2,
    escalonamento_1_papel TEXT,
    escalonamento_1_dias  INT  DEFAULT 2,
    escalonamento_2_papel TEXT,
    escalonamento_2_dias  INT  DEFAULT 4,
    ativo                 BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO sla_config
    (etapa, dias_uteis, aviso_antecipado_dias, escalonamento_1_papel, escalonamento_1_dias, escalonamento_2_papel, escalonamento_2_dias)
VALUES
    ('REQUERIMENTOS', 10, 2, 'Coordenador',        2, 'Diretoria', 4),
    ('ESPECIFICACAO',  8, 2, 'Diretor de Negócio',  2, 'Comitê',    4),
    ('EXECUCAO',      30, 5, 'Coordenador',         3, 'Diretoria', 5),
    ('UAT',           10, 2, 'Coordenador',         2, 'Diretoria', 4),
    ('GOLIVE',         5, 1, 'Coordenador',         2, 'Diretoria', 3),
    ('ENCERRAMENTO',  15, 3, 'Coordenador',         3, 'Diretoria', 5)
ON CONFLICT (etapa) DO NOTHING;

-- -------------------------------------------------------------------------
-- 2. Colunas de timestamps de entrada no estado atual (req / spec)
-- -------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS req_estado_desde  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS spec_estado_desde TIMESTAMPTZ;

-- -------------------------------------------------------------------------
-- 3. Recria a view `projetos` para incluir as novas colunas
--    (mesmo padrão idempotente do Fase 3: DROP CASCADE + CREATE + triggers)
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS projetos CASCADE;

DO $$
DECLARE
    col RECORD;
    select_list TEXT := '';
    tem_bc  BOOLEAN;
    tem_proj BOOLEAN;
BEGIN
    FOR col IN
        SELECT DISTINCT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('business_cases', 'projects')
          AND column_name <> 'business_case_codigo'
        ORDER BY column_name
    LOOP
        tem_bc   := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cases' AND column_name=col.column_name);
        tem_proj := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name=col.column_name);

        IF select_list <> '' THEN select_list := select_list || ', '; END IF;

        IF tem_bc AND tem_proj THEN
            select_list := select_list || format('COALESCE(p.%1$I, bc.%1$I) AS %1$I', col.column_name);
        ELSIF tem_proj THEN
            select_list := select_list || format('p.%1$I AS %1$I', col.column_name);
        ELSE
            select_list := select_list || format('bc.%1$I AS %1$I', col.column_name);
        END IF;
    END LOOP;

    select_list := select_list || ', p.business_case_codigo';

    EXECUTE format(
        'CREATE VIEW projetos AS SELECT %s FROM business_cases bc LEFT JOIN projects p ON p.codigo = bc.codigo',
        select_list
    );
    RAISE NOTICE 'view projetos recriada com % colunas (Fase 4)', array_length(string_to_array(select_list, ','), 1);
END $$;

-- -------------------------------------------------------------------------
-- 4. Recria os 3 triggers INSTEAD OF
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_projetos_instead_insert ON projetos;
CREATE TRIGGER trg_projetos_instead_insert INSTEAD OF INSERT ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_insert();

DROP TRIGGER IF EXISTS trg_projetos_instead_update ON projetos;
CREATE TRIGGER trg_projetos_instead_update INSTEAD OF UPDATE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_update();

DROP TRIGGER IF EXISTS trg_projetos_instead_delete ON projetos;
CREATE TRIGGER trg_projetos_instead_delete INSTEAD OF DELETE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_delete();

-- -------------------------------------------------------------------------
-- 5. Notifica PostgREST para recarregar o schema
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
