-- ============================================================
-- 2026-10-09_adm_fase2_governanca.sql
-- Compasso — ADM Fase 2: Governança de Autoridade + Configurações
--
-- Tabelas novas (idempotente):
--   1. aptidoes               — catálogo de competências (SKILL)
--   2. usuario_aptidoes       — associação pessoa × competência (PERSON_SKILL)
--   3. authority_rules        — alçadas de decisão (AUTHORITY_RULE)
--   4. delegacoes             — delegações temporárias (DELEGATION)
--   5. sod_rules              — segregação de funções (SOD_RULE)
--   6. estimation_policies    — políticas do motor de estimativa (ESTIMATION_POLICY)
--   7. parametros_sistema     — parâmetros genéricos do sistema (GENERIC_PARAMETER)
--
-- Sem RLS (padrão Compasso). Idempotente.
-- Rode no SQL Editor do Supabase (projeto Compasso).
-- ============================================================

-- ============================================================
-- 1. APTIDOES — catálogo de competências
-- ============================================================
CREATE TABLE IF NOT EXISTS aptidoes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo        TEXT UNIQUE NOT NULL,
    nome          TEXT NOT NULL,
    categoria     TEXT NOT NULL DEFAULT 'GERAL',
    nivel_maximo  INT  NOT NULL DEFAULT 3 CHECK (nivel_maximo BETWEEN 1 AND 5),
    descricao     TEXT,
    ativo         BOOLEAN NOT NULL DEFAULT true,
    criado_por    TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por TEXT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE aptidoes DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. USUARIO_APTIDOES — associação pessoa × competência
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario_aptidoes (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  BIGINT NOT NULL REFERENCES perfis_usuarios(id) ON DELETE CASCADE,
    aptidao_id  BIGINT NOT NULL REFERENCES aptidoes(id) ON DELETE CASCADE,
    nivel       INT    NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
    validado_por TEXT,
    validado_em  TIMESTAMPTZ,
    atualizado_por TEXT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, aptidao_id)
);
ALTER TABLE usuario_aptidoes DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. AUTHORITY_RULES — alçadas de decisão
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_rules (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          TEXT UNIQUE NOT NULL,
    decision_type   TEXT NOT NULL CHECK (decision_type IN (
                        'BC_EXTRAORDINARY','FY_TRANSITION','FY_REOPENING',
                        'FY_PACKAGE','CONTRACT_APPROVAL','BUDGET_VARIATION',
                        'GENERIC'
                    )),
    descricao       TEXT NOT NULL,
    condicao        JSONB NOT NULL DEFAULT '{}',
    -- niveis: [{ordem, papel_ou_pessoa, quorum_minimo, descricao}]
    niveis          JSONB NOT NULL DEFAULT '[]',
    versao          INT  NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','INACTIVE')),
    vigencia_inicio DATE,
    vigencia_fim    DATE,
    criado_por      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por  TEXT,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE authority_rules DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. DELEGACOES — delegações temporárias de autoridade
-- ============================================================
CREATE TABLE IF NOT EXISTS delegacoes (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delegante_id      BIGINT NOT NULL REFERENCES perfis_usuarios(id),
    delegado_id       BIGINT NOT NULL REFERENCES perfis_usuarios(id),
    authority_rule_id BIGINT REFERENCES authority_rules(id),
    periodo_inicio    DATE NOT NULL,
    periodo_fim       DATE NOT NULL,
    motivo            TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
    revogado_por      TEXT,
    revogado_em       TIMESTAMPTZ,
    criado_por        TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por    TEXT,
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (periodo_fim > periodo_inicio),
    CHECK (delegante_id <> delegado_id)
);
ALTER TABLE delegacoes DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. SOD_RULES — segregação de funções
-- ============================================================
CREATE TABLE IF NOT EXISTS sod_rules (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      TEXT UNIQUE NOT NULL,
    descricao   TEXT NOT NULL,
    acao_a      TEXT NOT NULL,
    acao_b      TEXT NOT NULL,
    escopo      TEXT NOT NULL DEFAULT 'MESMO_OBJETO' CHECK (escopo IN ('MESMO_OBJETO','MESMO_PROCESSO','GLOBAL')),
    -- excecoes: [{motivo, vigencia_inicio, vigencia_fim, aprovado_por}]
    excecoes    JSONB NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','INACTIVE')),
    criado_por  TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por TEXT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sod_rules DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. ESTIMATION_POLICIES — políticas do motor de estimativa (EST-01)
-- ============================================================
CREATE TABLE IF NOT EXISTS estimation_policies (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    engine_version      TEXT NOT NULL DEFAULT 'v1.0',
    -- base_hours: [{tipo_entregavel, tamanho, horas_base}]
    base_hours          JSONB NOT NULL DEFAULT '[]',
    -- fatores_complexidade: [{chave, descricao, multiplicador}]
    fatores_complexidade JSONB NOT NULL DEFAULT '[]',
    contingencia_pct    NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    arredondamento_horas INT NOT NULL DEFAULT 1,
    vigencia_inicio     DATE,
    vigencia_fim        DATE,
    status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','INACTIVE')),
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE estimation_policies DISABLE ROW LEVEL SECURITY;

-- Seed: política inicial padrão
INSERT INTO estimation_policies (
    engine_version, base_hours, fatores_complexidade,
    contingencia_pct, arredondamento_horas, status, criado_por
)
SELECT
    'v1.0',
    '[
        {"tipo_entregavel":"Módulo de sistema","tamanho":"Pequeno","horas_base":40},
        {"tipo_entregavel":"Módulo de sistema","tamanho":"Médio","horas_base":120},
        {"tipo_entregavel":"Módulo de sistema","tamanho":"Grande","horas_base":280},
        {"tipo_entregavel":"Integração","tamanho":"Simples","horas_base":20},
        {"tipo_entregavel":"Integração","tamanho":"Complexa","horas_base":80},
        {"tipo_entregavel":"Relatório","tamanho":"Simples","horas_base":8},
        {"tipo_entregavel":"Relatório","tamanho":"Complexo","horas_base":24}
    ]'::jsonb,
    '[
        {"chave":"baixa","descricao":"Baixa complexidade","multiplicador":0.8},
        {"chave":"media","descricao":"Média complexidade","multiplicador":1.0},
        {"chave":"alta","descricao":"Alta complexidade","multiplicador":1.4},
        {"chave":"muito_alta","descricao":"Muito alta complexidade","multiplicador":2.0}
    ]'::jsonb,
    10.00,
    4,
    'PUBLISHED',
    'sistema'
WHERE NOT EXISTS (SELECT 1 FROM estimation_policies WHERE status = 'PUBLISHED');

-- ============================================================
-- 7. PARAMETROS_SISTEMA — parâmetros genéricos do sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS parametros_sistema (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave           TEXT UNIQUE NOT NULL,
    dominio         TEXT NOT NULL DEFAULT 'GERAL' CHECK (dominio IN (
                        'ACESSO','BUSINESS_CASE','ANO_FISCAL',
                        'DOCUMENTOS','RELATORIOS','GERAL'
                    )),
    tipo_dado       TEXT NOT NULL DEFAULT 'TEXT' CHECK (tipo_dado IN (
                        'TEXT','INTEGER','DECIMAL','BOOLEAN',
                        'PERCENTAGE','MONEY','DURATION','ENUM'
                    )),
    valor           TEXT NOT NULL,
    descricao       TEXT,
    unidade         TEXT,
    nivel_alteracao INT  NOT NULL DEFAULT 1 CHECK (nivel_alteracao BETWEEN 1 AND 4),
    valores_permitidos TEXT[],
    vigencia_inicio DATE,
    vigencia_fim    DATE,
    reservado       BOOLEAN NOT NULL DEFAULT false,
    atualizado_por  TEXT,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE parametros_sistema DISABLE ROW LEVEL SECURITY;

-- Seed: parâmetros padrão do sistema
INSERT INTO parametros_sistema (chave, dominio, tipo_dado, valor, descricao, unidade, nivel_alteracao, reservado)
VALUES
    ('bc_prazo_max_dias',      'BUSINESS_CASE', 'INTEGER',    '180',  'Prazo máximo de um Business Case em dias antes de expirar automaticamente', 'dias',         1, false),
    ('bc_alerta_vencimento',   'BUSINESS_CASE', 'INTEGER',    '15',   'Dias antes do vencimento para emitir alerta ao responsável',                'dias',         1, false),
    ('fy_closing_prep_days',   'ANO_FISCAL',    'INTEGER',    '30',   'Dias de preparação antes do fechamento do FY',                              'dias',         3, false),
    ('fy_closing_window_days', 'ANO_FISCAL',    'INTEGER',    '15',   'Janela de fechamento do FY em dias úteis',                                  'dias',         3, false),
    ('fy_reopening_max_days',  'ANO_FISCAL',    'INTEGER',    '10',   'Máximo de dias que um FY pode permanecer reaberto',                         'dias',         3, false),
    ('sessao_timeout_min',     'ACESSO',        'INTEGER',    '480',  'Tempo de inatividade em minutos antes de encerrar a sessão',                'minutos',      2, false),
    ('docs_tamanho_max_mb',    'DOCUMENTOS',    'INTEGER',    '20',   'Tamanho máximo de upload de documentos em MB',                              'MB',           2, false),
    ('relatorio_max_linhas',   'RELATORIOS',    'INTEGER',    '10000','Limite de linhas por exportação de relatório',                              'linhas',       1, false),
    ('moeda_padrao',           'GERAL',         'TEXT',       'BRL',  'Código ISO da moeda padrão do sistema',                                     null,           2, true),
    ('fuso_horario',           'GERAL',         'TEXT',       'America/Sao_Paulo', 'Fuso horário padrão do sistema (IANA)',                         null,           2, true)
ON CONFLICT (chave) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('aptidoes','usuario_aptidoes','authority_rules',
--                        'delegacoes','sod_rules','estimation_policies','parametros_sistema');
