-- =========================================================================
-- 2026-09-03_modulo_funcao.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- FASE 1 da preparação para licenciamento por módulo (ver
-- docs/AUDITORIA_MODULOS_LICENCIAMENTO.md).
--
-- Fonte ÚNICA de verdade "tela -> módulo de licença". Substitui o mapa
-- hardcoded TAB_MODULO_MAP de js/core/licenca.js como verdade em runtime
-- (o mapa hardcoded continua no código como default de emergência /
-- documentação). O gate de módulo é por TELA (tabId), não por
-- activity_key do catálogo — por isso a PK aqui é o tabId.
--
--   modulo IN ('NUCLEO','WORKFLOW','EMAIL','FINANCEIRO','PLANEJAMENTO_ESTRATEGICO')
--   tipo   = 'NUCLEO'  <=>  modulo = 'NUCLEO'   (sempre disponível, não licenciável)
--   tipo   = 'LICENCIAVEL'                        (atrás de licenca_modulos)
--
-- Realocações aplicadas por este seed (decididas com o usuário 03/09/2026):
--   ano_fiscal            WORKFLOW -> NUCLEO      (pré-requisito estrutural)
--   periodo_ano_fiscal    (omissão) -> NUCLEO    (idem)
--   ajuste_orcamento      WORKFLOW -> FINANCEIRO
--   validacao_tradeoff    WORKFLOW -> FINANCEIRO
--   controle_orcamento    (omissão) -> FINANCEIRO
--   projetos_adhoc        WORKFLOW -> FINANCEIRO (Autorização de Demanda Extraordinária)
--   workflow_etapas       (omissão) -> WORKFLOW  (config do motor de fases)
--   prazos                (omissão) -> WORKFLOW  (SLA do motor de fases)
--   cadastros mestres / perfis / dashboard / consultas -> NUCLEO explícito
--
-- Sem RLS (mesmo tratamento das demais tabelas de config). Idempotente.
-- Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS modulo_funcao (
    activity_key   TEXT PRIMARY KEY,   -- tabId (nível de tela)
    modulo         TEXT NOT NULL CHECK (modulo IN ('NUCLEO','WORKFLOW','EMAIL','FINANCEIRO','PLANEJAMENTO_ESTRATEGICO')),
    tipo           TEXT NOT NULL DEFAULT 'LICENCIAVEL' CHECK (tipo IN ('NUCLEO','LICENCIAVEL')),
    observacao     TEXT,
    atualizado_por TEXT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE modulo_funcao DISABLE ROW LEVEL SECURITY;

-- Seed / reconciliação: re-executa sem duplicar e CORRIGE o módulo de quem
-- já existir (ON CONFLICT DO UPDATE) — é assim que as realocações pegam
-- numa base que já tinha rodado uma versão anterior.
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
  -- ---------- NÚCLEO (sempre disponível) ----------
  ('ano_fiscal',                  'NUCLEO',     'NUCLEO', 'Abertura/fechamento do ciclo — pré-requisito estrutural'),
  ('periodo_ano_fiscal',          'NUCLEO',     'NUCLEO', 'Parâmetro do período do AF'),
  ('usuarios',                    'NUCLEO',     'NUCLEO', 'Perfis de acesso'),
  ('funcoes_permissoes',          'NUCLEO',     'NUCLEO', 'Perfis de acesso (role-gated hardcoded)'),
  ('atribuicao_funcoes',          'NUCLEO',     'NUCLEO', 'Perfis de acesso (role-gated hardcoded)'),
  ('restricao_area_atividades',   'NUCLEO',     'NUCLEO', 'Perfis de acesso (role-gated hardcoded)'),
  ('responsaveis',                'NUCLEO',     'NUCLEO', 'Responsáveis por atividade'),
  ('licenciamento_modulos',       'NUCLEO',     'NUCLEO', 'Controle do próprio licenciamento (só Proprietário)'),
  ('dev_tools',                   'NUCLEO',     'NUCLEO', 'Ferramentas de Dev (role-gated hardcoded)'),
  ('areas',                       'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('produtos',                    'NUCLEO',     'NUCLEO', 'Cadastro mestre (spec 1.3 — desacopla FINANCEIRO de PLANEJ_ESTRAT)'),
  ('pessoas_solicitantes',        'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('portes',                      'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('tipos_projeto',               'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('return_benefit',              'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('cargos',                      'NUCLEO',     'NUCLEO', 'Cadastro mestre'),
  ('dashboard',                   'NUCLEO',     'NUCLEO', 'Landing — degrada para vazio sem WORKFLOW'),
  ('consultas',                   'NUCLEO',     'NUCLEO', 'Busca base do portfólio'),
  ('controle_orcamento',          'FINANCEIRO', 'LICENCIAVEL', 'Modo do trade-off (realocado de NÚCLEO)'),
  -- ---------- WORKFLOW ----------
  ('fechamento_af',               'WORKFLOW',   'LICENCIAVEL', NULL),
  ('f1_formalizacao',             'WORKFLOW',   'LICENCIAVEL', NULL),
  ('f1_orcamento',                'WORKFLOW',   'LICENCIAVEL', NULL),
  ('req_planejamento',            'WORKFLOW',   'LICENCIAVEL', NULL),
  ('req_aprov_negocio',           'WORKFLOW',   'LICENCIAVEL', NULL),
  ('req_aprov_ti',                'WORKFLOW',   'LICENCIAVEL', NULL),
  ('req_conclusao',               'WORKFLOW',   'LICENCIAVEL', 'Trava de variação embute checagem de FINANCEIRO'),
  ('fase_technical',              'WORKFLOW',   'LICENCIAVEL', NULL),
  ('tech_aval_negocio',           'WORKFLOW',   'LICENCIAVEL', NULL),
  ('tech_conclusao',              'WORKFLOW',   'LICENCIAVEL', 'Trava de variação embute checagem de FINANCEIRO'),
  ('fase_execution',              'WORKFLOW',   'LICENCIAVEL', NULL),
  ('fase_uat',                    'WORKFLOW',   'LICENCIAVEL', NULL),
  ('fase_golive',                 'WORKFLOW',   'LICENCIAVEL', NULL),
  ('conclusao_projeto',           'WORKFLOW',   'LICENCIAVEL', NULL),
  ('retomar_hold',                'WORKFLOW',   'LICENCIAVEL', NULL),
  ('roadmap',                     'WORKFLOW',   'LICENCIAVEL', NULL),
  ('cronograma_evolucao',         'WORKFLOW',   'LICENCIAVEL', NULL),
  ('workflow_etapas',             'WORKFLOW',   'LICENCIAVEL', 'Config do motor de fases (realocado de NÚCLEO)'),
  ('prazos',                      'WORKFLOW',   'LICENCIAVEL', 'SLA do motor de fases (realocado de NÚCLEO)'),
  -- ---------- EMAIL ----------
  ('gestao_templates',            'EMAIL',      'LICENCIAVEL', NULL),
  ('gestao_fluxo_email',          'EMAIL',      'LICENCIAVEL', NULL),
  ('fila_email',                  'EMAIL',      'LICENCIAVEL', NULL),
  ('governanca',                  'EMAIL',      'LICENCIAVEL', 'Cobrança de ajustes = disparo de e-mail'),
  -- ---------- FINANCEIRO ----------
  ('ajuste_orcamento',            'FINANCEIRO', 'LICENCIAVEL', 'Realocado de WORKFLOW'),
  ('validacao_tradeoff',          'FINANCEIRO', 'LICENCIAVEL', 'Realocado de WORKFLOW'),
  ('projetos_adhoc',              'FINANCEIRO', 'LICENCIAVEL', 'Autorização de Demanda Extraordinária (realocado de WORKFLOW)'),
  ('empresas_terceirizadas',      'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('contratos_projeto',           'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('contratos_vinculos',          'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('registro_valores_contrato',   'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('relatorio_projetos_contratos','FINANCEIRO', 'LICENCIAVEL', NULL),
  ('visao_orcamento',             'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('alertas_orcamento',           'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('aprov_comite',                'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('aprov_orcamento_af',          'FINANCEIRO', 'LICENCIAVEL', NULL),
  ('percentual_bloqueio_orcamento','FINANCEIRO','LICENCIAVEL', NULL),
  ('mudanca_orcamento',           'FINANCEIRO', 'LICENCIAVEL', NULL),
  -- ---------- PLANEJAMENTO ESTRATÉGICO ----------
  ('planejamento_estrategico',    'PLANEJAMENTO_ESTRATEGICO', 'LICENCIAVEL', NULL)
ON CONFLICT (activity_key) DO UPDATE
  SET modulo = EXCLUDED.modulo,
      tipo   = EXCLUDED.tipo,
      observacao = EXCLUDED.observacao,
      atualizado_em = now();

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT modulo, tipo, count(*) FROM modulo_funcao GROUP BY 1,2 ORDER BY 1;
--   SELECT activity_key, modulo FROM modulo_funcao
--   WHERE activity_key IN ('ano_fiscal','ajuste_orcamento','validacao_tradeoff',
--     'controle_orcamento','projetos_adhoc','workflow_etapas','prazos','periodo_ano_fiscal');
-- =========================================================================
