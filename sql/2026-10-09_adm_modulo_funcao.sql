-- =========================================================================
-- 2026-10-09_adm_modulo_funcao.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Registra os 30 VIEWs canônicos do Módulo ADM (D-13) + 3 homes de
-- superfície em modulo_funcao.
--
-- Os legacy tabIds correspondentes (fila_email, auditoria, responsaveis,
-- workflow_etapas, prazos, usuarios, funcoes_permissoes, gestao_fluxo_email,
-- gestao_templates, dados_empresa, licenciamento_modulos, periodo_ano_fiscal,
-- controle_orcamento, percentual_bloqueio_orcamento, areas, pessoas_solicitantes,
-- portes, tipos_projeto, return_benefit, cargos, empresas_terceirizadas,
-- planejamento_estrategico) já existem em 2026-09-03_modulo_funcao.sql e
-- são mantidos para compatibilidade retroativa — não removidos aqui.
--
-- Idempotente. modulo_funcao está sob RLS — rode DIRETO no SQL Editor do
-- Supabase (service_role ignora RLS).
-- =========================================================================

-- ---- Homes de superfície ----
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
    ('cadastros_home',      'NUCLEO', 'NUCLEO',      'Home da superfície Cadastros'),
    ('administracao_home',  'NUCLEO', 'NUCLEO',      'Home da superfície Administração'),
    ('configuracoes_home',  'NUCLEO', 'NUCLEO',      'Home da superfície Configurações')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo        = EXCLUDED.modulo,
        tipo          = EXCLUDED.tipo,
        observacao    = EXCLUDED.observacao,
        atualizado_em = now();

-- ---- SCR-23 Cadastros (7 VIEWs) ----
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
    ('cad_org',             'NUCLEO',                   'NUCLEO',       'Estrutura organizacional (ex: areas)'),
    ('cad_cargos',          'NUCLEO',                   'NUCLEO',       'Cargos (ex: cargos)'),
    ('cad_pessoas',         'NUCLEO',                   'NUCLEO',       'Pessoas solicitantes (ex: pessoas_solicitantes)'),
    ('cad_fornecedores',    'FINANCEIRO',               'LICENCIAVEL',  'Empresas terceirizadas / fornecedores (ex: empresas_terceirizadas)'),
    ('cad_portes',          'NUCLEO',                   'NUCLEO',       'Portes de projeto (ex: portes)'),
    ('cad_classificacoes',  'NUCLEO',                   'NUCLEO',       'Tipos, retornos e produtos (ex: tipos_projeto)'),
    ('cad_estrategia',      'PLANEJAMENTO_ESTRATEGICO', 'LICENCIAVEL',  'Planejamento estratégico (ex: planejamento_estrategico)')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo        = EXCLUDED.modulo,
        tipo          = EXCLUDED.tipo,
        observacao    = EXCLUDED.observacao,
        atualizado_em = now();

-- ---- SCR-24 Administração (12 VIEWs) ----
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
    ('adm_usuarios',        'NUCLEO',    'NUCLEO',       'Gestão de usuários (ex: usuarios)'),
    ('adm_perfis',          'NUCLEO',    'NUCLEO',       'Funções e permissões (ex: funcoes_permissoes)'),
    ('adm_sessoes',         'NUCLEO',    'NUCLEO',       'Sessões ativas'),
    ('adm_equipes',         'NUCLEO',    'NUCLEO',       'Responsáveis / equipes (ex: responsaveis)'),
    ('adm_aptidoes',        'NUCLEO',    'NUCLEO',       'Aptidões por responsável'),
    ('adm_alcadas',         'WORKFLOW',  'LICENCIAVEL',  'Alçadas de autoridade'),
    ('adm_delegacoes',      'WORKFLOW',  'LICENCIAVEL',  'Delegações temporárias'),
    ('adm_sod',             'WORKFLOW',  'LICENCIAVEL',  'Segregação de funções (SoD)'),
    ('adm_workflow',        'WORKFLOW',  'LICENCIAVEL',  'Etapas do workflow (ex: workflow_etapas)'),
    ('adm_sla',             'WORKFLOW',  'LICENCIAVEL',  'Prazos / SLA (ex: prazos)'),
    ('adm_integracoes',     'EMAIL',     'LICENCIAVEL',  'Fila de e-mail / integração (ex: fila_email)'),
    ('adm_auditoria',       'NUCLEO',    'NUCLEO',       'Log de auditoria do sistema')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo        = EXCLUDED.modulo,
        tipo          = EXCLUDED.tipo,
        observacao    = EXCLUDED.observacao,
        atualizado_em = now();

-- ---- SCR-25 Configurações (11 VIEWs) ----
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
    ('cfg_organizacao',     'NUCLEO',     'NUCLEO',       'Dados da empresa (ex: dados_empresa)'),
    ('cfg_licenca',         'NUCLEO',     'NUCLEO',       'Licenciamento de módulos (ex: licenciamento_modulos)'),
    ('cfg_fy',              'NUCLEO',     'NUCLEO',       'Período / ano fiscal (ex: periodo_ano_fiscal)'),
    ('cfg_estimativas',     'WORKFLOW',   'LICENCIAVEL',  'Parâmetros de estimativa (EST-01)'),
    ('cfg_ratecards',       'FINANCEIRO', 'LICENCIAVEL',  'Rate Card de papéis (valor/hora)'),
    ('cfg_financeiro',      'FINANCEIRO', 'LICENCIAVEL',  'Controle e bloqueio orçamentário (ex: controle_orcamento)'),
    ('cfg_notificacoes',    'EMAIL',      'LICENCIAVEL',  'Chave geral de notificações por e-mail'),
    ('cfg_eventos',         'EMAIL',      'LICENCIAVEL',  'Fluxo de e-mail / gatilhos (ex: gestao_fluxo_email)'),
    ('cfg_templates',       'EMAIL',      'LICENCIAVEL',  'Templates de e-mail (ex: gestao_templates)'),
    ('cfg_ia',              'IA',         'LICENCIAVEL',  'Configuração de IA (ex: ia_config)'),
    ('cfg_parametros',      'NUCLEO',     'NUCLEO',       'Parâmetros gerais do sistema')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo        = EXCLUDED.modulo,
        tipo          = EXCLUDED.tipo,
        observacao    = EXCLUDED.observacao,
        atualizado_em = now();

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT activity_key, modulo, tipo
--   FROM modulo_funcao
--   WHERE activity_key IN (
--     'cadastros_home','administracao_home','configuracoes_home',
--     'cad_org','cad_cargos','cad_pessoas','cad_fornecedores',
--     'cad_portes','cad_classificacoes','cad_estrategia',
--     'adm_usuarios','adm_perfis','adm_sessoes','adm_equipes',
--     'adm_aptidoes','adm_alcadas','adm_delegacoes','adm_sod',
--     'adm_workflow','adm_sla','adm_integracoes','adm_auditoria',
--     'cfg_organizacao','cfg_licenca','cfg_fy','cfg_estimativas',
--     'cfg_ratecards','cfg_financeiro','cfg_notificacoes',
--     'cfg_eventos','cfg_templates','cfg_ia','cfg_parametros'
--   )
--   ORDER BY activity_key;
--   -- deve retornar 33 linhas
-- =========================================================================
