-- =========================================================================
-- 2026-09-25_v3_backup.sql
-- Compasso 2.0 — V3 (Business Case como objeto distinto de Project).
-- PASSO 1 do plano: backup real antes de qualquer ALTER/CREATE.
--
-- Mesmo padrão já usado em sql/2026-09-25_backup_pre_reset_operacional.sql
-- — copia (schema à parte, dentro do próprio banco, sem pg_dump) `projetos`
-- inteira e as tabelas que hoje têm FK conhecida pra ela, antes de tocar
-- em qualquer coisa. Nada é apagado aqui, só copiado.
--
-- Rode este script ANTES de sql/2026-09-25_v3_business_case_split.sql.
--
-- Se já rodou hoje e quer repetir do zero:
--   DROP SCHEMA IF EXISTS backup_pre_v3 CASCADE;
-- e rode este script de novo.
-- =========================================================================

DO $$
DECLARE
    t       TEXT;
    v_count BIGINT;
    tabelas TEXT[] := ARRAY[
        'projetos',
        -- tabelas com FK conhecida pra projetos(codigo) (via migrações no
        -- repo) — ver sql/2026-09-25_v3_business_case_split.sql Passo 4.
        -- As FKs mais antigas (sem migração no repo) entram aqui também
        -- assim que a consulta do Passo 0 vier — por enquanto cobre as
        -- 5 conhecidas.
        'raid_items', 'gates', 'tasks', 'ia_especificacoes', 'project_documents'
    ];
BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS backup_pre_v3';

    FOREACH t IN ARRAY tabelas LOOP
        BEGIN
            EXECUTE format('CREATE TABLE backup_pre_v3.%I AS TABLE %I', t, t);
            EXECUTE format('SELECT count(*) FROM backup_pre_v3.%I', t) INTO v_count;
            RAISE NOTICE 'backup ok: % (% linhas)', t, v_count;
        EXCEPTION
            WHEN undefined_table THEN
                RAISE NOTICE 'ignorada (tabela não existe): %', t;
            WHEN duplicate_table THEN
                RAISE NOTICE 'já existe backup de % — rode DROP SCHEMA backup_pre_v3 CASCADE; antes pra repetir do zero', t;
        END;
    END LOOP;

    RAISE NOTICE 'Backup do V3 concluído em backup_pre_v3.';
END $$;
-- =========================================================================
