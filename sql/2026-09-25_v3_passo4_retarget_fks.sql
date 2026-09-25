-- =========================================================================
-- 2026-09-25_v3_passo4_retarget_fks.sql
-- Compasso 2.0 — V3, PASSO 4: retargeta as FKs que hoje apontam pra
-- `projetos(codigo)` — lista completa vinda da consulta real no Supabase
-- (information_schema), não mais um palpite a partir do código:
--
--   adhoc_aprovacoes.projeto_adhoc_codigo, projeto_etapas.codigo_projeto,
--   projeto_etapas.projeto_codigo, projetos.projeto_pai_codigo (auto-FK),
--   contratos_projeto.projeto_codigo, contratos_vinculos_projeto.projeto_codigo,
--   golive_ocorrencias.projeto_codigo, golive_termo_aceite.projeto_codigo,
--   projeto_benefit_results.projeto_codigo, ia_especificacoes.projeto_codigo,
--   tasks.projeto_codigo, project_documents.projeto_codigo,
--   raid_items.projeto_codigo, gates.projeto_codigo
--
-- Critério de destino (qual das duas tabelas novas cada FK passa a
-- referenciar):
--   -> business_cases: tabelas cujas linhas podem existir enquanto o
--      projeto ainda está em Business Case, OU que cobrem o ciclo de
--      vida INTEIRO (business_cases tem 100% dos códigos, sempre —
--      Passo 3 garante isso). Caso: adhoc_aprovacoes (aprovação
--      acontece ainda em Business Case), projeto_etapas (guarda etapas
--      de BC e de Project na mesma tabela — apontar pra business_cases
--      é o único jeito de nunca falhar, já que toda linha de projeto
--      tem business_case correspondente), projeto_benefit_results
--      (objetivo/key_results nascem no Business Case — tratado como
--      ambíguo, ver nota abaixo).
--   -> projects: tabelas cujas linhas só existem depois que o Project
--      nasce (artefatos de Workspace/execução — não têm como existir
--      antes disso). Caso: contratos_projeto, contratos_vinculos_projeto,
--      golive_ocorrencias, golive_termo_aceite, ia_especificacoes, tasks,
--      project_documents, raid_items, gates, e o auto-FK de subprojeto
--      (projeto_pai_codigo — subprojeto só existe em Execution).
--
-- NOTA (revisar com o usuário): `projeto_benefit_results` é a call mais
-- incerta desta lista — fui com business_cases (sempre válido,
-- independente da fase) por segurança, mas pode fazer mais sentido em
-- projects se o preenchimento só acontecer pós-execução. Fácil de
-- corrigir depois (um DROP+ADD CONSTRAINT a mais), não é destrutivo.
--
-- Rode DEPOIS de sql/2026-09-25_v3_business_case_split.sql (Passo 2+3).
-- Não toca em `projetos` (ainda é a tabela original) nem apaga nenhum
-- dado — só troca o alvo de cada FK. Reversível: rodar de novo trocando
-- os alvos de volta pra `projetos`.
-- =========================================================================

DO $$
DECLARE
    -- cada linha: tabela, coluna, tabela-alvo nova
    fk RECORD;
    fks CONSTANT TEXT[][] := ARRAY[
        ARRAY['adhoc_aprovacoes', 'projeto_adhoc_codigo', 'business_cases'],
        ARRAY['projeto_etapas', 'codigo_projeto', 'business_cases'],
        ARRAY['projeto_etapas', 'projeto_codigo', 'business_cases'],
        ARRAY['projeto_benefit_results', 'projeto_codigo', 'business_cases'],
        ARRAY['contratos_projeto', 'projeto_codigo', 'projects'],
        ARRAY['contratos_vinculos_projeto', 'projeto_codigo', 'projects'],
        ARRAY['golive_ocorrencias', 'projeto_codigo', 'projects'],
        ARRAY['golive_termo_aceite', 'projeto_codigo', 'projects'],
        ARRAY['ia_especificacoes', 'projeto_codigo', 'projects'],
        ARRAY['tasks', 'projeto_codigo', 'projects'],
        ARRAY['project_documents', 'projeto_codigo', 'projects'],
        ARRAY['raid_items', 'projeto_codigo', 'projects'],
        ARRAY['gates', 'projeto_codigo', 'projects']
    ];
    v_constraint_name TEXT;
    v_tabela TEXT;
    v_coluna TEXT;
    v_alvo TEXT;
    i INT;
BEGIN
    FOR i IN 1 .. array_length(fks, 1) LOOP
        v_tabela := fks[i][1];
        v_coluna := fks[i][2];
        v_alvo   := fks[i][3];

        BEGIN
            -- acha o nome real da constraint (não assume o padrão
            -- <tabela>_<coluna>_fkey — pode ter sido nomeada diferente)
            SELECT tc.constraint_name INTO v_constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = v_tabela
              AND kcu.column_name = v_coluna
              AND ccu.table_name = 'projetos'
            LIMIT 1;

            IF v_constraint_name IS NULL THEN
                RAISE NOTICE 'FK não encontrada (já retargetada ou nome mudou?): %.%', v_tabela, v_coluna;
                CONTINUE;
            END IF;

            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', v_tabela, v_constraint_name);
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(codigo)',
                            v_tabela, v_constraint_name, v_coluna, v_alvo);
            RAISE NOTICE 'retargetada: %.% -> %(codigo)', v_tabela, v_coluna, v_alvo;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ERRO ao retargetar %.%: %', v_tabela, v_coluna, SQLERRM;
        END;
    END LOOP;

    -- auto-FK de subprojeto: projeto_pai_codigo hoje aponta projetos(codigo);
    -- no modelo novo, subprojeto só existe como Project (nasce em Execution),
    -- então tanto a coluna quanto o alvo migram pra `projects`.
    BEGIN
        SELECT tc.constraint_name INTO v_constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'projetos'
          AND kcu.column_name = 'projeto_pai_codigo'
          AND ccu.table_name = 'projetos'
        LIMIT 1;

        IF v_constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE projects ADD CONSTRAINT %I FOREIGN KEY (projeto_pai_codigo) REFERENCES projects(codigo)', v_constraint_name || '_v3');
            RAISE NOTICE 'auto-FK de subprojeto recriada em projects.projeto_pai_codigo -> projects(codigo)';
        ELSE
            RAISE NOTICE 'auto-FK de subprojeto não encontrada em projetos — conferir manualmente';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERRO ao criar auto-FK de subprojeto em projects: %', SQLERRM;
    END;
END $$;

NOTIFY pgrst, 'reload schema';
-- =========================================================================
