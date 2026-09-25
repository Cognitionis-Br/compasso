-- =========================================================================
-- 2026-09-25_restore_pre_reset_operacional.sql
-- Compasso — restaura o snapshot criado por
-- sql/2026-09-25_backup_pre_reset_operacional.sql (schema backup_20260925),
-- SÓ USE se algo saiu errado depois de rodar
-- sql/2026-09-25_reset_dados_operacionais.sql e você precisa voltar atrás.
--
-- O que faz:
--   1) Limpa de novo as tabelas atuais (mesma ordem filho->pai do reset —
--      idempotente, funciona mesmo que elas já estejam vazias).
--   2) Copia de volta cada tabela do schema backup_20260925, na ordem
--      inversa (pai->filho, senão a FK barra o insert).
--   3) Reajusta a sequência de identidade (coluna "id") de cada tabela
--      restaurada pra continuar depois do maior id copiado — sem isso, o
--      próximo INSERT novo pode colidir com um id que acabou de voltar.
--
-- Pré-requisito: o schema backup_20260925 tem que existir (rode o backup
-- antes do reset). Se você já rodou DROP SCHEMA backup_20260925 CASCADE
-- depois de validar o reset, este script não tem mais o que restaurar.
-- =========================================================================

DO $$
DECLARE
    t         TEXT;
    v_seq     TEXT;
    v_maxid   BIGINT;
    limpar    TEXT[] := ARRAY[
        -- mesma ordem (filho -> pai) do reset
        'task_dependencies','task_attachments','task_mentions','task_comments',
        'task_checklist_items','task_history','tasks',
        'notifications','raid_items',
        'ia_especificacoes_mensagens','ia_especificacoes_anexos',
        'ia_especificacoes_historico','ia_especificacoes',
        'project_document_versions','project_documents',
        'golive_ocorrencias','golive_termo_aceite',
        'log_alteracoes_horas','log_retomada_hold','log_ratificacao_planejamento',
        'log_decisoes_etapa','log_percentual_bloqueio_orcamento',
        'log_troca_responsavel_atividade','log_expurgo_referencias_origem',
        'log_alteracao_vinculo_contrato','log_fechamento_ano_fiscal',
        'log_contratos_pendencias',
        'contratos_pagamento_itens','contratos_pagamentos_anexos','contratos_pagamentos',
        'contratos_pendencias_itens','contratos_pendencias_anexos','contratos_pendencias',
        'contratos_propostas','contratos_vinculos_projeto','contratos_projeto',
        'contadores_contrato_af',
        'adhoc_aprovacoes','ajuste_orcamento_autorizacoes','tradeoff_validacao_pendencias',
        'fechamento_af_decisoes','projeto_benefit_results',
        'projeto_etapas','projetos',
        'anos_fiscais_config','contadores_codigo_projeto','emails_pendentes'
    ];
    restaurar TEXT[] := ARRAY[
        -- ordem inversa (pai -> filho) — reverso exato da lista acima
        'emails_pendentes','contadores_codigo_projeto','anos_fiscais_config',
        'projetos','projeto_etapas',
        'projeto_benefit_results','fechamento_af_decisoes','tradeoff_validacao_pendencias',
        'ajuste_orcamento_autorizacoes','adhoc_aprovacoes',
        'contadores_contrato_af','contratos_projeto','contratos_vinculos_projeto',
        'contratos_propostas','contratos_pendencias','contratos_pendencias_anexos',
        'contratos_pendencias_itens','contratos_pagamentos','contratos_pagamentos_anexos',
        'contratos_pagamento_itens',
        'log_contratos_pendencias','log_fechamento_ano_fiscal','log_alteracao_vinculo_contrato',
        'log_expurgo_referencias_origem','log_troca_responsavel_atividade',
        'log_percentual_bloqueio_orcamento','log_decisoes_etapa','log_ratificacao_planejamento',
        'log_retomada_hold','log_alteracoes_horas',
        'golive_termo_aceite','golive_ocorrencias',
        'project_documents','project_document_versions',
        'ia_especificacoes','ia_especificacoes_historico','ia_especificacoes_anexos',
        'ia_especificacoes_mensagens',
        'raid_items','notifications',
        'tasks','task_history','task_checklist_items','task_comments','task_mentions',
        'task_attachments','task_dependencies'
    ];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_20260925') THEN
        RAISE EXCEPTION 'schema backup_20260925 não existe — não há o que restaurar. Abortando.';
    END IF;

    -- 1) limpa o estado atual (filho -> pai)
    FOREACH t IN ARRAY limpar LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I', t);
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'ignorada (não existe): %', t;
        END;
    END LOOP;

    -- 2) restaura do backup (pai -> filho) + 3) reajusta sequência de "id"
    FOREACH t IN ARRAY restaurar LOOP
        BEGIN
            EXECUTE format('INSERT INTO %I SELECT * FROM backup_20260925.%I', t, t);
            RAISE NOTICE 'restaurado: %', t;
        EXCEPTION
            WHEN undefined_table THEN
                RAISE NOTICE 'ignorada (backup ou tabela não existe): %', t;
        END;

        BEGIN
            v_seq := pg_get_serial_sequence(t, 'id');
            IF v_seq IS NOT NULL THEN
                EXECUTE format('SELECT max(id) FROM %I', t) INTO v_maxid;
                IF v_maxid IS NOT NULL THEN
                    EXECUTE format('SELECT setval(%L, %s)', v_seq, v_maxid);
                END IF;
            END IF;
        EXCEPTION WHEN undefined_column OR undefined_table THEN
            -- tabela sem coluna "id" identity (ex.: projetos usa codigo TEXT) — nada a ajustar
            NULL;
        END;
    END LOOP;

    RAISE NOTICE 'Restauração concluída a partir de backup_20260925.';
END $$;

NOTIFY pgrst, 'reload schema';
-- =========================================================================
