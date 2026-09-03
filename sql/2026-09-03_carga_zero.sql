-- =========================================================================
-- 2026-09-03_carga_zero.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- >>> FAÇA O BACKUP ANTES (pg_dump --data-only). Isto NÃO tem volta sem o
--     backup. <<<
--
-- Deixa a base no estado de "instalação nova": nenhum projeto, nenhum
-- cadastro operacional, nenhuma configuração de ciclo/orçamento/empresa —
-- só a estrutura que acompanha o produto (RBAC, motor de workflow,
-- licenciamento de módulos) e UM usuário PROPRIETÁRIO para logar e
-- cadastrar o resto.
--
-- MANTÉM:
--   funcoes, catalogo_atividades, funcao_atividades, modulo_funcao,
--   licenca_modulos, config_email_geral, fases_etapas, sla_etapa_porte,
--   e o(s) usuário(s) PROPRIETÁRIO (+ o vínculo de função dele).
--
-- APAGA (todas as linhas):
--   projetos e todos os itens/logs de projeto; anos_fiscais_config;
--   contadores_codigo_projeto; áreas / pessoas / portes / tipos de projeto /
--   return-benefit / pilares / iniciativas / cargos; empresas terceirizadas
--   e contratos; templates e fluxo de e-mail; config de bloqueio / período /
--   controle de orçamento; empresa_licenciada e seus logs; responsáveis por
--   atividade; e todos os usuários que NÃO são PROPRIETÁRIO.
--
-- Roda no Supabase → SQL Editor. Cada DELETE é tolerante a tabela
-- inexistente (DO block com EXCEPTION undefined_table).
-- =========================================================================

DO $$
DECLARE
    t         TEXT;
    v_prop    UUID[];
    tabelas   TEXT[] := ARRAY[
        -- itens / logs de projeto
        'projeto_etapas','projeto_benefit_results','log_decisoes_etapa',
        'log_alteracoes_horas','log_ratificacao_planejamento','log_retomada_hold',
        'log_aprovacao_mudanca_orcamento','golive_ocorrencias','golive_termo_aceite',
        'log_alteracao_vinculo_contrato','contratos_pagamentos','contratos_vinculos_projeto',
        'adhoc_aprovacoes','tradeoff_validacao_pendencias','fechamento_af_decisoes',
        'ajuste_orcamento_autorizacoes','log_fechamento_ano_fiscal','emails_pendentes',
        'projetos',
        -- ciclo / numeração
        'anos_fiscais_config','contadores_codigo_projeto',
        -- cadastros operacionais (pessoas antes de áreas por causa de FK)
        'pessoas_solicitantes','areas_solicitantes','portes','tipos_projeto',
        'tipos_return_benefit','iniciativas_estrategicas','pilares_estrategicos',
        -- contratos / empresas terceirizadas
        'contratos_projeto','empresas_terceirizadas',
        -- e-mail: só os templates (o fluxo é lista fixa do produto — fica)
        'email_templates',
        -- parâmetros que nascem sem valor
        'config_bloqueio_orcamento','config_periodo_ano_fiscal','config_controle_orcamento',
        -- empresa licenciada + logs de licença
        'empresa_licenciada','log_licenca_verificacao','log_renovacao_licenca',
        -- responsáveis por atividade
        'usuario_atividades_responsavel','responsaveis_atividades'
    ];
BEGIN
    -- guarda os ids dos usuários PROPRIETÁRIO (para não apagá-los)
    SELECT array_agg(DISTINCT uf.usuario_id) INTO v_prop
    FROM usuario_funcoes uf JOIN funcoes f ON f.id = uf.funcao_id
    WHERE f.eh_proprietario = true OR upper(f.nome) = 'PROPRIETARIO';

    IF v_prop IS NULL OR array_length(v_prop,1) IS NULL THEN
        RAISE EXCEPTION 'Nenhum usuário PROPRIETÁRIO encontrado — abortando para não travar o acesso.';
    END IF;

    FOREACH t IN ARRAY tabelas LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I', t);
            RAISE NOTICE 'limpa: %', t;
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'ignorada (não existe): %', t;
        END;
    END LOOP;

    -- produtos: mantém só o sentinela NAO_CLASSIFICADO (id 1, ships com o produto)
    BEGIN
        DELETE FROM produtos WHERE upper(coalesce(codigo,'')) <> 'NAO_CLASSIFICADO';
        RAISE NOTICE 'produtos: mantido só NAO_CLASSIFICADO';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): produtos';
    END;

    -- usuários e vínculos de função: mantém só o(s) PROPRIETÁRIO
    -- (o cadastro de usuário é perfis_usuarios.id = id do auth, um UUID —
    --  a mesma coluna que usuario_funcoes.usuario_id referencia)
    DELETE FROM usuario_funcoes  WHERE usuario_id <> ALL (v_prop);
    DELETE FROM perfis_usuarios  WHERE id         <> ALL (v_prop);

    -- cargos: apaga os que não são mais usados por nenhum usuário mantido
    -- (o PROPRIETÁRIO tem cargo obrigatório — não pode virar FK órfã)
    BEGIN
        DELETE FROM cargos
         WHERE id NOT IN (SELECT cargo_id FROM perfis_usuarios WHERE cargo_id IS NOT NULL);
        RAISE NOTICE 'cargos: mantidos só os do(s) usuário(s) preservado(s)';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): cargos';
    END;

    RAISE NOTICE 'Carga zero concluída. Usuários mantidos (PROPRIETÁRIO): %', v_prop;
END $$;

NOTIFY pgrst, 'reload schema';

-- Depois: logar como o PROPRIETÁRIO -> cai na tela de setup da empresa
-- licenciada -> cadastrar empresa + vigência -> abrir o Ano Fiscal ->
-- cadastrar áreas / pessoas / produtos / portes / tipos / pilares etc.
-- =========================================================================
