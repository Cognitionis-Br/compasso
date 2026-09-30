-- =========================================================================
-- 2026-09-29_fase3_req_spec.sql
-- Compasso 2.0 — Fase 3: Requerimentos (M06) e Especificação (M07)
--
-- PROBLEMA CONHECIDO: `CREATE OR REPLACE VIEW` falha quando novas colunas
-- de tabelas subjacentes se inserem no MEIO da lista alfabética existente
-- (erro 42P16 "cannot change name of view column"). A solução correta é
-- DROP VIEW CASCADE + CREATE VIEW + recriar os 3 triggers INSTEAD OF.
-- As funções _v3_projetos_instead_* NÃO são dropadas pelo CASCADE (são
-- objetos independentes) e são referenciadas diretamente na recriação.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DROP/CREATE VIEW + DROP/CREATE
-- TRIGGER.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Colunas de estado M06 / M07 na tabela projects
-- -------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS req_estado   TEXT DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS spec_modo    TEXT,
    ADD COLUMN IF NOT EXISTS spec_estado  TEXT DEFAULT 'NOT_STARTED';

-- -------------------------------------------------------------------------
-- 2. Dropa a view (CASCADE remove os triggers INSTEAD OF dependentes).
--    As funções _v3_projetos_instead_* NÃO são afetadas pelo CASCADE.
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS projetos CASCADE;

-- -------------------------------------------------------------------------
-- 3. Recria a view dinamicamente com TODAS as colunas atuais de
--    business_cases e projects (mesmo algoritmo do V3/passo5, mas agora
--    como CREATE VIEW puro, sem a restrição de compatibilidade do
--    CREATE OR REPLACE).
-- -------------------------------------------------------------------------
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
    RAISE NOTICE 'view projetos recriada com % colunas (Fase 3)', array_length(string_to_array(select_list, ','), 1);
END $$;

-- -------------------------------------------------------------------------
-- 4. Recria os 3 triggers INSTEAD OF
--    (funções já existem do V3/passo5 + passo5b — não precisam recriar)
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
