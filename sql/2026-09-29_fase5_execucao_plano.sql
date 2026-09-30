-- =========================================================================
-- 2026-09-29_fase5_execucao_plano.sql
-- Compasso 2.0 — Fase 5: Execução e Plano de Entrega (D-12, D-10)
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS +
-- DROP/CREATE VIEW + DROP/CREATE TRIGGER.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Estado de execução do projeto
-- -------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS exec_estado TEXT DEFAULT 'READY_FOR_EXECUTION';

-- -------------------------------------------------------------------------
-- 2. Plano de Entrega (cabeçalho por versão)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plano_entrega (
    id           SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    versao       INT NOT NULL DEFAULT 1,
    eh_baseline  BOOLEAN NOT NULL DEFAULT false,
    criado_por   TEXT,
    criado_em    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (projeto_codigo, versao)
);
CREATE INDEX IF NOT EXISTS idx_plano_entrega_projeto ON plano_entrega (projeto_codigo);

-- -------------------------------------------------------------------------
-- 3. Blocos do Plano de Entrega (Execução · UAT · Go Live)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plano_entrega_bloco (
    id           SERIAL PRIMARY KEY,
    plano_id     INT NOT NULL REFERENCES plano_entrega(id) ON DELETE CASCADE,
    bloco        TEXT NOT NULL CHECK (bloco IN ('EXECUCAO', 'UAT', 'GO_LIVE')),
    dt_inicio    DATE,
    dt_fim       DATE,
    responsavel  TEXT,
    descricao    TEXT,
    status       TEXT NOT NULL DEFAULT 'PLANEJADO'
                 CHECK (status IN ('PLANEJADO', 'RATIFICADO', 'RETIFICADO', 'REQUER_RATIFICACAO')),
    UNIQUE (plano_id, bloco)
);

-- -------------------------------------------------------------------------
-- 4. Registro de Planejamento — somente inclusão (D-12)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registro_planejamento (
    id            SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    data_acao     DATE NOT NULL DEFAULT CURRENT_DATE,
    etapa         TEXT NOT NULL,
    bloco         TEXT,
    acao          TEXT NOT NULL,
    autor         TEXT,
    justificativa TEXT,
    datas_antes   TEXT,
    datas_depois  TEXT,
    versao        INT,
    criado_em     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registro_planejamento_projeto ON registro_planejamento (projeto_codigo);

-- Trigger: bloqueia UPDATE e DELETE (append-only — D-12)
CREATE OR REPLACE FUNCTION _bloquear_registro_planejamento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'registro_planejamento é somente inclusão (D-12): UPDATE e DELETE são proibidos.';
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_rp_no_update ON registro_planejamento;
CREATE TRIGGER trg_rp_no_update
    BEFORE UPDATE ON registro_planejamento
    FOR EACH ROW EXECUTE FUNCTION _bloquear_registro_planejamento();

DROP TRIGGER IF EXISTS trg_rp_no_delete ON registro_planejamento;
CREATE TRIGGER trg_rp_no_delete
    BEFORE DELETE ON registro_planejamento
    FOR EACH ROW EXECUTE FUNCTION _bloquear_registro_planejamento();

-- -------------------------------------------------------------------------
-- 5. Recria a view `projetos` para incluir exec_estado
--    (mesmo padrão idempotente do Fase 3/4: DROP CASCADE + CREATE + triggers)
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
    RAISE NOTICE 'view projetos recriada com % colunas (Fase 5)', array_length(string_to_array(select_list, ','), 1);
END $$;

-- -------------------------------------------------------------------------
-- 6. Recria os 3 triggers INSTEAD OF
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
-- 7. Notifica PostgREST para recarregar o schema
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
