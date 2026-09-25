-- =========================================================================
-- 2026-09-25_backup_pre_reset_operacional.sql
-- Compasso — RODE ESTE SCRIPT ANTES de
-- sql/2026-09-25_reset_dados_operacionais.sql.
--
-- Copia (dentro do próprio Supabase, sem precisar de pg_dump nem de
-- ferramenta externa) TODA linha de cada tabela que o reset vai apagar —
-- exatamente a mesma lista de tabelas do reset, na mesma ordem — para um
-- schema à parte: backup_20260925. Nada é apagado aqui, só copiado.
--
-- Depois de rodar, confira rapidamente:
--   SELECT table_name, (xpath('/row/c/text()',
--          query_to_xml(format('select count(*) as c from backup_20260925.%I', table_name), false, true, '')))[1]::text::int AS linhas
--   FROM information_schema.tables WHERE table_schema = 'backup_20260925' ORDER BY 1;
-- (ou, mais simples: abra a aba Table Editor do Supabase e escolha o
-- schema "backup_20260925" no seletor de schema.)
--
-- Se este script já rodou antes hoje e você quer repetir o backup do zero
-- (por exemplo, rodou o reset, viu algo errado, restaurou, e quer testar
-- de novo): rode primeiro
--   DROP SCHEMA IF EXISTS backup_20260925 CASCADE;
-- e então este script de novo. Sem isso, cada tabela já existente no
-- schema de backup aparece como "já existe — não sobrescrito" no log.
--
-- Depois que você validar que o reset saiu como esperado e não precisa
-- mais voltar atrás, pode apagar o backup com o mesmo DROP SCHEMA acima
-- (ele não é limpo sozinho).
--
-- Restaurar: ver sql/2026-09-25_restore_pre_reset_operacional.sql.
-- =========================================================================

DO $$
DECLARE
    t       TEXT;
    v_count BIGINT;
    tabelas TEXT[] := ARRAY[
        -- MESMA lista e ordem de sql/2026-09-25_reset_dados_operacionais.sql
        'task_dependencies','task_attachments','task_mentions','task_comments',
        'task_checklist_items','task_history','tasks',
        'notifications',
        'raid_items',
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
BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS backup_20260925';

    FOREACH t IN ARRAY tabelas LOOP
        BEGIN
            EXECUTE format('CREATE TABLE backup_20260925.%I AS TABLE %I', t, t);
            EXECUTE format('SELECT count(*) FROM backup_20260925.%I', t) INTO v_count;
            RAISE NOTICE 'backup ok: % (% linhas)', t, v_count;
        EXCEPTION
            WHEN undefined_table THEN
                RAISE NOTICE 'ignorada (tabela não existe na base): %', t;
            WHEN duplicate_table THEN
                RAISE NOTICE 'já existe backup de % — rode DROP SCHEMA backup_20260925 CASCADE; antes pra repetir do zero', t;
        END;
    END LOOP;

    RAISE NOTICE 'Backup concluído em backup_20260925. Confira as contagens antes de rodar o reset.';
END $$;
-- =========================================================================
