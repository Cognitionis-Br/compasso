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
-- MANTÉM (estrutura do produto):
--   catalogo_atividades, modulo_funcao, licenca_modulos, fases_etapas,
--   sla_etapa_porte, produtos.NAO_CLASSIFICADO, email_templates (os
--   modelos cadastrados), as LINHAS de email_fluxo com a ASSOCIAÇÃO de
--   template preservada (destinatário/remetente zerados e todas
--   inativas — ver RESETA), config_email_geral (com envio desligado),
--   a função PROPRIETARIO, o cargo 'ANALISTA DE TECNOLOGIA' (exigido pelo
--   trigger handle_new_user), e o(s) usuário(s) PROPRIETÁRIO (+ vínculo).
--   Templates e associações ficam DE PROPÓSITO: servem de exemplo pronto
--   pro cliente usar/ajustar na instalação nova, em vez de partir do zero.
--
-- APAGA (todas as linhas):
--   projetos e todos os itens/logs de projeto; anos_fiscais_config;
--   contadores_codigo_projeto; áreas / pessoas / portes / tipos de projeto /
--   return-benefit / pilares / iniciativas / cargos; empresas terceirizadas
--   e contratos; config de bloqueio / período / controle de orçamento;
--   empresa_licenciada e seus logs; responsáveis por atividade; todos os
--   usuários que NÃO são PROPRIETÁRIO; e todas as funções que não a
--   PROPRIETARIO (+ a matriz funcao_atividades delas).
--
-- RESETA (mantém a linha, limpa o conteúdo):
--   email_fluxo (destinatário/remetente -> nulo; ativo -> false — o
--   template associado NÃO é zerado, ver acima);
--   config_email_geral (envio_ativo -> false);
--   catalogo_atividades.restricao_area -> false em todas;
--   perfis_usuarios.area do(s) PROPRIETÁRIO -> 'COGNITIONIS' (área
--   reservada, hardcode — não existe em areas_solicitantes).
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
        -- e-mail: email_templates e a associação template<->fluxo NÃO
        -- entram aqui de propósito — ver cabeçalho (ficam como exemplo).
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

    -- email_fluxo: a lista de gatilhos é fixa (fica), e a ASSOCIAÇÃO com o
    -- template (template_id) fica de propósito — serve de exemplo pronto
    -- na instalação nova. Só destinatário/remetente (dados específicos do
    -- cliente anterior) e o ativo/inativo voltam ao estado de instalação
    -- nova; sem remetente cadastrado a linha não pode realmente disparar,
    -- então mantê-la "ativa" seria um estado inconsistente — por isso
    -- ativo sempre volta a false, mesmo com o template já associado.
    BEGIN
        UPDATE email_fluxo SET
            tipo_destinatario       = 'RESPONSAVEL_TAREFA',
            email_destinatario_fixo = NULL,
            remetente               = NULL,
            ativo                   = false,
            atualizado_por          = NULL,
            atualizado_em           = NULL;
        RAISE NOTICE 'email_fluxo: destinatário/remetente zerados e todas inativas (template associado preservado)';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): email_fluxo';
    END;

    -- chave geral de e-mail: desligada numa instalação nova
    BEGIN
        UPDATE config_email_geral SET envio_ativo = false, atualizado_por = NULL, atualizado_em = NULL WHERE id = 1;
        RAISE NOTICE 'config_email_geral: envio desligado';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): config_email_geral';
    END;

    -- restrição de área por atividade: desmarca tudo (o catálogo em si fica)
    BEGIN
        UPDATE catalogo_atividades SET restricao_area = false
         WHERE restricao_area IS DISTINCT FROM false;
        RAISE NOTICE 'catalogo_atividades: restrição de área desmarcada em todas';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): catalogo_atividades';
    END;

    -- usuários e vínculos de função: mantém só o(s) PROPRIETÁRIO
    -- (o cadastro de usuário é perfis_usuarios.id = id do auth, um UUID —
    --  a mesma coluna que usuario_funcoes.usuario_id referencia)
    DELETE FROM usuario_funcoes  WHERE usuario_id <> ALL (v_prop);
    DELETE FROM perfis_usuarios  WHERE id         <> ALL (v_prop);

    -- o(s) PROPRIETÁRIO(s) preservado(s) ficam na área reservada da
    -- Cognitionis (não existe em areas_solicitantes — é hardcode, só para
    -- o cadastro de proprietário; ninguém mais pode escolhê-la).
    UPDATE perfis_usuarios SET area = 'COGNITIONIS' WHERE id = ANY (v_prop);

    -- funções e a matriz de permissões: mantém só PROPRIETARIO (e qualquer
    -- função que ainda esteja vinculada ao usuário preservado). Roda DEPOIS
    -- da limpeza de usuario_funcoes acima, então "in use" já só tem o prop.
    BEGIN
        DELETE FROM funcao_atividades
         WHERE funcao_id NOT IN (
             SELECT id FROM funcoes
              WHERE eh_proprietario = true
                 OR upper(nome) = 'PROPRIETARIO'
                 OR id IN (SELECT funcao_id FROM usuario_funcoes)
         );
        RAISE NOTICE 'funcao_atividades: mantida só a matriz da(s) função(ões) preservada(s)';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): funcao_atividades';
    END;

    BEGIN
        DELETE FROM funcoes
         WHERE eh_proprietario IS DISTINCT FROM true
           AND upper(nome) <> 'PROPRIETARIO'
           AND id NOT IN (SELECT funcao_id FROM usuario_funcoes);
        RAISE NOTICE 'funcoes: mantida só PROPRIETARIO (+ vínculos do usuário preservado)';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): funcoes';
    END;

    -- cargos: apaga os não usados por nenhum usuário mantido, MAS preserva
    -- 'ANALISTA DE TECNOLOGIA' — é o cargo que o trigger handle_new_user
    -- grava em todo usuário novo (perfis_usuarios.cargo_id é NOT NULL); sem
    -- ele, criar usuário falha com "Database error creating new user".
    BEGIN
        -- nome EXATO — o trigger faz `WHERE nome = 'ANALISTA DE TECNOLOGIA'`,
        -- sem upper()/trim(); uma variante de grafia não serve.
        INSERT INTO cargos (nome, criado_por)
        SELECT 'ANALISTA DE TECNOLOGIA', 'CARGA ZERO'
        WHERE NOT EXISTS (SELECT 1 FROM cargos WHERE nome = 'ANALISTA DE TECNOLOGIA');

        DELETE FROM cargos
         WHERE id NOT IN (SELECT cargo_id FROM perfis_usuarios WHERE cargo_id IS NOT NULL)
           AND nome <> 'ANALISTA DE TECNOLOGIA';
        RAISE NOTICE 'cargos: mantidos o(s) do usuário preservado + ANALISTA DE TECNOLOGIA (trigger de novo usuário)';
    EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'ignorada (não existe): cargos';
    END;

    RAISE NOTICE 'Carga zero concluída. Usuários mantidos (PROPRIETÁRIO): %', v_prop;
END $$;

NOTIFY pgrst, 'reload schema';

-- Depois: logar como o PROPRIETÁRIO -> cai na tela de setup da empresa
-- licenciada -> cadastrar empresa + vigência -> abrir o Ano Fiscal ->
-- cadastrar áreas / pessoas / produtos / portes / tipos / pilares etc.
-- =========================================================================
