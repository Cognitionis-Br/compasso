-- =========================================================================
-- 2026-09-25_v3_passo5_view_triggers.sql
-- Compasso 2.0 — V3, PASSO 5 (o mais delicado): congela `projetos` como
-- backup histórico, e recria `projetos` como uma VIEW que se comporta
-- IGUAL à tabela de sempre pro resto do app — nenhum dos ~50 arquivos
-- que leem/escrevem `projetos` precisa mudar uma linha.
--
-- Roda DEPOIS de sql/2026-09-25_v3_business_case_split.sql (Passo 2+3) e
-- sql/2026-09-25_v3_passo4_retarget_fks.sql (Passo 4).
--
-- A view e os triggers abaixo são construídos DINAMICAMENTE (via
-- information_schema, em tempo de execução) — não dependem de eu saber
-- de antemão a lista completa de colunas de `projetos`, o que é
-- importante já que não existe CREATE TABLE dela no repo.
--
-- Reversível: DROP VIEW projetos; ALTER TABLE projetos_pre_v3_backup
-- RENAME TO projetos; (mais os 3 DROP TRIGGER/FUNCTION).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 5.1 — congela a tabela original (nunca mais recebe INSERT/UPDATE;
-- arquivo histórico, não apagar).
-- -------------------------------------------------------------------------
ALTER TABLE IF EXISTS projetos RENAME TO projetos_pre_v3_backup;

-- -------------------------------------------------------------------------
-- 5.2 — cria a view `projetos` = LEFT JOIN business_cases + projects,
-- reconstruindo TODAS as colunas que existiam antes. Pra cada coluna:
--   - existe só em business_cases -> bc.coluna
--   - existe só em projects       -> p.coluna
--   - existe nas duas             -> COALESCE(p.coluna, bc.coluna) —
--     projects "vence" quando a linha já tem Project (é o dado mais
--     recente); cai pro valor de business_cases enquanto só existe BC.
-- -------------------------------------------------------------------------
DO $$
DECLARE
    col RECORD;
    select_list TEXT := '';
    tem_bc BOOLEAN;
    tem_proj BOOLEAN;
BEGIN
    FOR col IN
        SELECT DISTINCT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('business_cases', 'projects')
          AND column_name <> 'business_case_codigo' -- coluna nova, não existia antes; view não precisa expor
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

    -- expõe também o vínculo de proveniência (novo, mas útil já ter na view)
    select_list := select_list || ', p.business_case_codigo';

    EXECUTE format('CREATE OR REPLACE VIEW projetos AS SELECT %s FROM business_cases bc LEFT JOIN projects p ON p.codigo = bc.codigo', select_list);
    RAISE NOTICE 'view projetos criada com % colunas', array_length(string_to_array(select_list, ','), 1);
END $$;

-- -------------------------------------------------------------------------
-- 5.3 — função auxiliar: monta e executa um INSERT/UPDATE dinâmico numa
-- tabela-alvo, usando só as chaves de `dados` (um jsonb) que realmente
-- existem como coluna nessa tabela — é o que permite os triggers
-- funcionarem sem eu ter que listar as colunas na mão.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _v3_upsert_dinamico(p_tabela TEXT, p_dados JSONB, p_codigo TEXT) RETURNS VOID AS $$
DECLARE
    v_cols TEXT;
    v_vals TEXT;
    v_sets TEXT;
    v_existe BOOLEAN;
BEGIN
    SELECT string_agg(quote_ident(kv.key), ', ' ORDER BY kv.key),
           string_agg(quote_nullable(kv.value), ', ' ORDER BY kv.key)
    INTO v_cols, v_vals
    FROM jsonb_each_text(p_dados) kv
    WHERE kv.key IN (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = p_tabela);

    IF v_cols IS NULL THEN RETURN; END IF; -- nada em comum, nada a fazer

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE codigo = %L)', p_tabela, p_codigo) INTO v_existe;

    IF v_existe THEN
        SELECT string_agg(format('%I = %L', kv.key, kv.value), ', ' ORDER BY kv.key)
        INTO v_sets
        FROM jsonb_each_text(p_dados) kv
        WHERE kv.key IN (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = p_tabela)
          AND kv.key <> 'codigo';
        IF v_sets IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET %s WHERE codigo = %L', p_tabela, v_sets, p_codigo);
        END IF;
    ELSE
        EXECUTE format('INSERT INTO %I (%s) VALUES (%s)', p_tabela, v_cols, v_vals);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 5.4 — INSTEAD OF INSERT: linha nova com etapa_atual = 'BUSINESS CASE'
-- (ou omitida) -> só business_cases. Qualquer outra etapa (caso hoje só
-- de subprojeto, que já nasce em EXECUTION) -> só projects, sem
-- business_case_codigo (subprojeto não tem Business Case próprio).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _v3_projetos_instead_insert() RETURNS TRIGGER AS $$
DECLARE
    v_dados JSONB := to_jsonb(NEW);
BEGIN
    IF NEW.etapa_atual IS NULL OR NEW.etapa_atual = 'BUSINESS CASE' THEN
        PERFORM _v3_upsert_dinamico('business_cases', v_dados, NEW.codigo);
    ELSE
        PERFORM _v3_upsert_dinamico('projects', v_dados, NEW.codigo);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projetos_instead_insert ON projetos;
CREATE TRIGGER trg_projetos_instead_insert INSTEAD OF INSERT ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_insert();

-- -------------------------------------------------------------------------
-- 5.5 — INSTEAD OF UPDATE: os 4 casos do plano.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _v3_projetos_instead_update() RETURNS TRIGGER AS $$
DECLARE
    v_dados     JSONB := to_jsonb(NEW);
    v_era_bc    BOOLEAN := (OLD.etapa_atual IS NULL OR OLD.etapa_atual = 'BUSINESS CASE');
    v_e_bc      BOOLEAN := (NEW.etapa_atual IS NULL OR NEW.etapa_atual = 'BUSINESS CASE');
BEGIN
    -- sempre atualiza business_cases com o que for comum (histórico
    -- nunca é perdido, mesmo depois do Project nascer)
    PERFORM _v3_upsert_dinamico('business_cases', v_dados, OLD.codigo);

    IF v_era_bc AND NOT v_e_bc THEN
        -- travessia BC -> Project: nasce o Project agora (FY-01)
        PERFORM _v3_upsert_dinamico('projects', v_dados || jsonb_build_object('business_case_codigo', OLD.codigo), OLD.codigo);
    ELSIF NOT v_era_bc AND NOT v_e_bc THEN
        -- já era Project, continua Project
        PERFORM _v3_upsert_dinamico('projects', v_dados, OLD.codigo);
    ELSIF NOT v_era_bc AND v_e_bc THEN
        -- caso raro: "voltar" pra Business Case (hoje só
        -- js/dev-tools/reset.js faz isso) -> apaga o Project
        DELETE FROM projects WHERE codigo = OLD.codigo;
    END IF;
    -- (v_era_bc AND v_e_bc já foi coberto pelo UPDATE em business_cases acima)

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projetos_instead_update ON projetos;
CREATE TRIGGER trg_projetos_instead_update INSTEAD OF UPDATE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_update();

-- -------------------------------------------------------------------------
-- 5.6 — INSTEAD OF DELETE: apaga dos dois lados (se existir).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _v3_projetos_instead_delete() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM projects WHERE codigo = OLD.codigo;
    DELETE FROM business_cases WHERE codigo = OLD.codigo;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projetos_instead_delete ON projetos;
CREATE TRIGGER trg_projetos_instead_delete INSTEAD OF DELETE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_delete();

NOTIFY pgrst, 'reload schema';
-- =========================================================================
