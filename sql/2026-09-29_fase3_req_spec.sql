-- =========================================================================
-- 2026-09-29_fase3_req_spec.sql
-- Compasso 2.0 — Fase 3: Requerimentos (M06) e Especificação (M07)
--
-- Adiciona campos de estado do workflow nas tabelas projects (para SCR-05/SCR-06).
-- Recria a view `projetos` para expor as novas colunas.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Colunas de estado M06 / M07 na tabela projects
--    (projects é onde vivem os projetos pós-BC, criados pelo trigger V3)
-- -------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS req_estado   TEXT DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS spec_modo    TEXT,
    ADD COLUMN IF NOT EXISTS spec_estado  TEXT DEFAULT 'NOT_STARTED';

-- -------------------------------------------------------------------------
-- 2. Recria a view `projetos` para incluir as novas colunas.
--    Mesmo bloco dinâmico do V3/passo5 — roda sempre que colunas mudam.
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
        'CREATE OR REPLACE VIEW projetos AS SELECT %s FROM business_cases bc LEFT JOIN projects p ON p.codigo = bc.codigo',
        select_list
    );
    RAISE NOTICE 'view projetos recriada com % colunas (Fase 3)', array_length(string_to_array(select_list, ','), 1);
END $$;
