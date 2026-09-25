-- =========================================================================
-- 2026-09-25_v2_gates.sql
-- Compasso 2.0 — V2 do Plano de Evolução: Gate/Exception formal.
-- Fecha (parcialmente) WF-04 e RAID-02 da Matriz de Gaps: hoje só existe
-- UM fluxo de exceção formal e auditado no sistema inteiro (bloqueio de
-- variação de orçamento, projetos.bloqueado_mudanca_orcamento +
-- log_aprovacao_mudanca_orcamento) — RAID crítico não tem nada
-- equivalente. Esta tabela generaliza o padrão pro resto do sistema.
--
-- Semântica igual à do Documento 02 (§3, tabela de conceitos):
--   GATE — condição de passagem; severidade BLOCKER/WARNING/INFORMATION;
--   resultado PASS/PASS_WITH_WARNING/BLOCKED.
--
-- Puramente aditivo — NÃO toca em projetos.bloqueado_mudanca_orcamento
-- nem em log_aprovacao_mudanca_orcamento; o fluxo de orçamento em
-- produção continua exatamente como está. Migrar esse fluxo pra usar
-- `gates` é uma decisão separada (risco médio — toca fluxo já em
-- produção), não incluída aqui de propósito.
--
-- Reversível: DROP TABLE gates;
-- =========================================================================

CREATE TABLE IF NOT EXISTS gates (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo  TEXT NOT NULL REFERENCES projetos(codigo),
    tipo            TEXT NOT NULL,                 -- ex.: 'VARIACAO_ORCAMENTO', 'RAID_CRITICO'
    origem_tabela   TEXT,                           -- ex.: 'raid_items' — de onde veio o gatilho, quando aplicável
    origem_id       BIGINT,                         -- id na origem_tabela, quando aplicável (ex.: raid_items.id)
    severidade      TEXT NOT NULL CHECK (severidade IN ('BLOCKER', 'WARNING', 'INFORMATION')),
    resultado       TEXT NOT NULL DEFAULT 'BLOCKED' CHECK (resultado IN ('PASS', 'PASS_WITH_WARNING', 'BLOCKED')),
    contexto        JSONB,                           -- dados livres do gatilho (percentual, valores, etc.)
    justificativa   TEXT,
    aprovado_por    UUID REFERENCES auth.users(id),
    aprovado_em     TIMESTAMPTZ,
    criado_por      UUID REFERENCES auth.users(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gates_projeto_codigo ON gates(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_gates_resultado ON gates(resultado) WHERE resultado = 'BLOCKED';

NOTIFY pgrst, 'reload schema';
-- =========================================================================
