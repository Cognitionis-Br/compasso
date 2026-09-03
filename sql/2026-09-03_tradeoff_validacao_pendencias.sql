-- =========================================================================
-- 2026-09-03_tradeoff_validacao_pendencias.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Feature 1.1 — quando o modo de controle orçamentário é AREA ou PRODUTO e
-- a simulação de trade-off da Demanda Extraordinária inclui projetos de
-- OUTRO subgrupo (fora da área/produto do projeto extraordinário), a
-- aprovação na tela "Aprovar Demanda Extraordinária" NÃO aplica os efeitos
-- na hora: grava uma pendência aqui, para validação na tela nova
-- "Validação de Trade-off Extraordinário" (menu Ano Fiscal).
--
-- `simulacao` guarda a rodada inteira: [{codigo, acao, valor_parcial?}],
-- só das linhas com ação != MANTER. Ao APROVAR, a tela nova roda a mesma
-- lógica de aplicação de aprovarSimulacaoAdhoc (HOLD/Cancelar/Ceder Parte +
-- promoção do extraordinário para Requerimentos + adhoc_aprovacoes).
-- Ao REJEITAR, nada é aplicado.
--
-- Sem RLS. Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS tradeoff_validacao_pendencias (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_adhoc_codigo  TEXT NOT NULL,
    ano_fiscal            TEXT,
    modo_controle         TEXT NOT NULL,          -- 'AREA' | 'PRODUTO'
    valor_adhoc           NUMERIC(15,2),
    saldo_resultante      NUMERIC(15,2),
    simulacao             JSONB NOT NULL,         -- [{codigo, acao, valor_parcial}]
    status                TEXT NOT NULL DEFAULT 'PENDENTE'
                          CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA')),
    criado_por            TEXT,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    decidido_por          TEXT,
    decidido_em           TIMESTAMPTZ,
    motivo_decisao        TEXT
);

ALTER TABLE tradeoff_validacao_pendencias DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT id, projeto_adhoc_codigo, modo_controle, status, criado_em
--   FROM tradeoff_validacao_pendencias ORDER BY criado_em DESC;
-- =========================================================================
