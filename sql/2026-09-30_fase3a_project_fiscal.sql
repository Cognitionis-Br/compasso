-- ============================================================
-- Fase 3A: M12A Entidades Delta — PROJECT_FISCAL_PLAN,
--   PROJECT_FISCAL_YEAR, PROJECT_FISCAL_TRANSITION,
--   FISCAL_YEAR_CLOSING, FISCAL_YEAR_CLOSING_ITEM
--   + regime_fiscal em business_cases (BC-038)
-- 2026-09-30
-- Referência: M12 V1.1 delta D2/D3
--
-- Este script é APENAS estrutural (DDL + dados iniciais).
-- A integração das transições existentes (carryover.js,
-- retomar-hold.js) com PROJECT_FISCAL_TRANSITION é Fase 3B.
-- Idempotente: seguro re-executar.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. regime_fiscal em business_cases (BC-038)
--    FY_BOUND  — projeto nasce e termina no mesmo exercício
--    CROSS_FY  — projeto atravessa exercícios
-- ============================================================
ALTER TABLE business_cases
    ADD COLUMN IF NOT EXISTS regime_fiscal TEXT DEFAULT 'FY_BOUND'
        CHECK (regime_fiscal IN ('FY_BOUND','CROSS_FY'));

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS regime_fiscal TEXT DEFAULT 'FY_BOUND'
        CHECK (regime_fiscal IN ('FY_BOUND','CROSS_FY'));

-- ============================================================
-- 2. PROJECT_FISCAL_PLAN — planejamento fiscal plurianual
--    Um plano por Business Case; define regime e horizonte.
-- ============================================================
CREATE TABLE IF NOT EXISTS project_fiscal_plan (
    id                  SERIAL PRIMARY KEY,
    business_case_codigo TEXT NOT NULL
        REFERENCES business_cases(codigo) ON DELETE CASCADE,
    regime_fiscal       TEXT NOT NULL DEFAULT 'FY_BOUND'
        CHECK (regime_fiscal IN ('FY_BOUND','CROSS_FY')),
    fy_previsto_inicio  TEXT REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    fy_previsto_fim     TEXT REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    justificativa       TEXT,
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now(),
    atualizado_em       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (business_case_codigo)
);
CREATE INDEX IF NOT EXISTS idx_pfp_bc ON project_fiscal_plan(business_case_codigo);

-- ============================================================
-- 3. PROJECT_FISCAL_YEAR — participação do projeto por exercício
--    Criada automaticamente no fechamento do pacote FY
--    (orcamento-af.js Fase 3A) para cada BC aprovado.
-- ============================================================
CREATE TABLE IF NOT EXISTS project_fiscal_year (
    id                  SERIAL PRIMARY KEY,
    projeto_codigo      TEXT NOT NULL,
    fiscal_year_codigo  TEXT NOT NULL REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    status              TEXT NOT NULL DEFAULT 'ATIVO'
        CHECK (status IN ('ATIVO','HOLD','CONCLUIDO','CANCELADO','CROSS_FY_CONTINUA')),
    valor_alocado       NUMERIC(14,2),
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now(),
    UNIQUE (projeto_codigo, fiscal_year_codigo)
);
CREATE INDEX IF NOT EXISTS idx_pfy_projeto ON project_fiscal_year(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_pfy_fy     ON project_fiscal_year(fiscal_year_codigo);

-- ============================================================
-- 4. PROJECT_FISCAL_TRANSITION — decisão formal na fronteira
--    Substitui a decisão informal de carryover.js / retomar-hold.js
--    (integração em Fase 3B). Tipos mapeados ao caderno M12A D3.
-- ============================================================
CREATE TABLE IF NOT EXISTS project_fiscal_transition (
    id                  SERIAL PRIMARY KEY,
    projeto_codigo      TEXT NOT NULL,
    fiscal_year_origem  TEXT NOT NULL REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    fiscal_year_destino TEXT REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    tipo                TEXT NOT NULL
        CHECK (tipo IN (
            'CARRYOVER',        -- FY_BOUND: saldo vai pro próximo FY
            'HOLD',             -- pausa formal
            'CROSS_FY_CONTINUE',-- CROSS_FY: continuidade normal
            'COMPLETE',         -- encerrado com sucesso no FY
            'TERMINATE',        -- encerrado antecipadamente
            'CANCEL'            -- cancelado
        )),
    status              TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','EXECUTED','CANCELLED')),
    justificativa       TEXT,
    impacto             TEXT,
    decidido_por        TEXT,
    decidido_em         TIMESTAMPTZ,
    executado_por       TEXT,
    executado_em        TIMESTAMPTZ,
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pft_projeto ON project_fiscal_transition(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_pft_fy_orig ON project_fiscal_transition(fiscal_year_origem);

-- ============================================================
-- 5. FISCAL_YEAR_CLOSING — processo formal de fechamento do AF
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_year_closing (
    id                  SERIAL PRIMARY KEY,
    fiscal_year_codigo  TEXT NOT NULL UNIQUE
        REFERENCES fiscal_years(codigo) ON UPDATE CASCADE,
    status              TEXT NOT NULL DEFAULT 'PREPARANDO'
        CHECK (status IN ('PREPARANDO','BLOQUEADO','PRONTO','EXECUTADO')),
    total_projetos      INTEGER,
    total_blockers_hard INTEGER DEFAULT 0,
    total_blockers_soft INTEGER DEFAULT 0,
    iniciado_por        TEXT,
    iniciado_em         TIMESTAMPTZ DEFAULT now(),
    executado_por       TEXT,
    executado_em        TIMESTAMPTZ,
    -- Snapshot imutável do estado no momento do fechamento (AC-M12-D08)
    snapshot            JSONB,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. FISCAL_YEAR_CLOSING_ITEM — readiness/pendência por projeto
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_year_closing_item (
    id                  SERIAL PRIMARY KEY,
    closing_id          INTEGER NOT NULL
        REFERENCES fiscal_year_closing(id) ON DELETE CASCADE,
    projeto_codigo      TEXT NOT NULL,
    tipo_blocker        TEXT NOT NULL
        CHECK (tipo_blocker IN ('HARD','SOFT','INFO')),
    categoria           TEXT NOT NULL
        CHECK (categoria IN (
            'FY_BOUND_SEM_DESTINACAO',
            'CROSS_FY_SEM_CONTINUIDADE',
            'APROVACAO_PENDENTE',
            'TRANSICAO_NAO_EXECUTADA',
            'PENDENCIA_ORCAMENTARIA',
            'OUTRO'
        )),
    descricao           TEXT,
    resolvido           BOOLEAN NOT NULL DEFAULT false,
    resolvido_em        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fyci_closing  ON fiscal_year_closing_item(closing_id);
CREATE INDEX IF NOT EXISTS idx_fyci_projeto  ON fiscal_year_closing_item(projeto_codigo);

-- ============================================================
-- Verificação final
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='project_fiscal_plan')       AS t_pfp,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='project_fiscal_year')       AS t_pfy,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='project_fiscal_transition') AS t_pft,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='fiscal_year_closing')       AS t_fyc,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='fiscal_year_closing_item')  AS t_fyci,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='business_cases' AND column_name='regime_fiscal')      AS col_regime;

COMMIT;
