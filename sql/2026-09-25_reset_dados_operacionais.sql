-- =========================================================================
-- 2026-09-25_reset_dados_operacionais_v2.sql
-- Compasso — reset operacional para iniciar o ciclo de evolução V1-V6
-- (Plano de Evolução, doc "Compasso 2.0 — Avaliação Cruzada e Plano de
-- Evolução"). DIFERENTE de sql/2026-09-03_carga_zero.sql: aquele script
-- também apaga TODOS os cadastros (áreas, pessoas, portes, tipos, pilares,
-- iniciativas, cargos, empresa licenciada) e TODOS os usuários exceto o
-- PROPRIETÁRIO — uma "instalação nova" completa. Este script é mais
-- estreito: mantém cadastros/parâmetros e TODOS os usuários intactos, e
-- limpa só projetos e dados correlativos (transacionais).
--
-- >>> FAÇA O BACKUP ANTES (pg_dump --data-only, ou snapshot do Supabase).
--     Isto NÃO tem volta sem o backup. <<<
--
-- MANTÉM (estrutural/parâmetro — cadastros e configuração do produto):
--   areas_solicitantes, cargos, catalogo_atividades, config_bloqueio_orcamento,
--   config_controle_orcamento, config_email_geral, config_periodo_ano_fiscal,
--   email_templates, email_fluxo (config de gatilho por etapa — não é dado
--   de projeto), empresa_licenciada, empresas_terceirizadas (cadastro de
--   Fornecedores — só os CONTRATOS ligados a projeto são limpos, não o
--   cadastro da empresa), fases_etapas, funcao_atividades, funcoes,
--   ia_config_geral, ia_templates_prompt, iniciativas_estrategicas,
--   licenca_modulos, modulo_funcao, pessoas_solicitantes, pilares_estrategicos,
--   portes, produtos, responsaveis_atividades, sla_etapa_porte, tipos_projeto,
--   tipos_return_benefit.
--
-- MANTÉM (usuários — TODOS, não só o PROPRIETÁRIO):
--   perfis_usuarios, usuario_funcoes, usuario_atividades_responsavel,
--   user_preferences, auth.users (intocado).
--
-- APAGA (projetos e tudo que é dado correlativo a projeto — zera pra início
-- do sistema):
--   projetos, projeto_etapas, projeto_benefit_results; toda a fila de
--   trabalho pessoal ligada a task/projeto (tasks e as 6 tabelas
--   dependentes: checklist, comentários, menções, anexos, dependências,
--   histórico); notifications; raid_items; o módulo de IA de
--   Requerimentos/Especificação (ia_especificacoes e as 3 tabelas
--   dependentes: anexos, histórico, mensagens); documentos de projeto (e
--   versões); Go-Live (ocorrências e termo de aceite); todos os logs
--   ligados a projeto (horas, hold, ratificação de planejamento, decisões
--   de etapa, bloqueio de orçamento, troca de responsável, expurgo,
--   vínculo de contrato, fechamento de ano fiscal, pendências de
--   contrato); aprovações ad-hoc, autorizações de ajuste de orçamento,
--   validação de trade-off, decisões de fechamento de AF; TODO o módulo de
--   Contratos ligado a projeto (pagamentos + itens/anexos, pendências +
--   itens/anexos, propostas, vínculos, contratos_projeto, numeração
--   automática) — mantendo só o cadastro de Fornecedores; anos_fiscais_config
--   (config + totais fechados do AF); contadores_codigo_projeto (numeração
--   de projeto); emails_pendentes (fila de envio).
--
-- Roda no Supabase → SQL Editor. Cada DELETE é tolerante a tabela
-- inexistente (DO block com EXCEPTION undefined_table), mesmo padrão de
-- carga_zero.sql. Ordem: filhos antes de pais (respeita FK sem cascade).
-- =========================================================================

DO $$
DECLARE
    t       TEXT;
    tabelas TEXT[] := ARRAY[
        -- Trabalho pessoal / tarefas (Release 1-2) — filhos de tasks primeiro
        'task_dependencies','task_attachments','task_mentions','task_comments',
        'task_checklist_items','task_history','tasks',
        'notifications',
        -- RAID (Release 3)
        'raid_items',
        -- Módulo de Construção de Requerimentos/Especificação com IA
        'ia_especificacoes_mensagens','ia_especificacoes_anexos',
        'ia_especificacoes_historico','ia_especificacoes',
        -- Documentos de projeto (Release 2)
        'project_document_versions','project_documents',
        -- Go-Live
        'golive_ocorrencias','golive_termo_aceite',
        -- Logs ligados a projeto
        'log_alteracoes_horas','log_retomada_hold','log_ratificacao_planejamento',
        'log_decisoes_etapa','log_percentual_bloqueio_orcamento',
        'log_troca_responsavel_atividade','log_expurgo_referencias_origem',
        'log_alteracao_vinculo_contrato','log_fechamento_ano_fiscal',
        'log_contratos_pendencias',
        -- Contratos e Fornecedores — filhos antes de pais; NÃO inclui
        -- empresas_terceirizadas (cadastro, fica)
        'contratos_pagamento_itens','contratos_pagamentos_anexos','contratos_pagamentos',
        'contratos_pendencias_itens','contratos_pendencias_anexos','contratos_pendencias',
        'contratos_propostas','contratos_vinculos_projeto','contratos_projeto',
        'contadores_contrato_af',
        -- Aprovações / orçamento / fechamento ligados a projeto
        'adhoc_aprovacoes','ajuste_orcamento_autorizacoes','tradeoff_validacao_pendencias',
        'fechamento_af_decisoes','projeto_benefit_results',
        -- Núcleo de projeto
        'projeto_etapas','projetos',
        -- Ciclo fiscal / numeração / fila de e-mail
        'anos_fiscais_config','contadores_codigo_projeto','emails_pendentes'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I', t);
            RAISE NOTICE 'limpa: %', t;
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'ignorada (não existe): %', t;
        END;
    END LOOP;

    RAISE NOTICE 'Reset operacional concluído. Cadastros, parâmetros e todos os usuários permanecem intactos.';
END $$;

NOTIFY pgrst, 'reload schema';

-- Depois: logar normalmente -> Ano Fiscal -> Abertura Ano Fiscal (recriar
-- o AF corrente, já que anos_fiscais_config foi limpo) -> Meus Projetos
-- deve aparecer vazio -> formalizar a primeira demanda pra validar o
-- fluxo ponta a ponta antes de seguir com o V1.
-- =========================================================================
