-- =========================================================================
-- 2026-09-04_log_percentual_bloqueio_orcamento.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- A pedido do usuário: a tela "Percentual de Bloqueio de Orçamento" salvava
-- mas não mostrava o percentual vigente nem histórico de alteração (só o
-- valor no próprio campo). Ajustada pra seguir o mesmo padrão de "Controle
-- Orçamentário" — linha de log com o valor vigente + tabela de histórico.
--
-- config_bloqueio_orcamento continua como HOJE (1 linha, id=1, UPDATE) —
-- é o valor lido em tempo real por confirmarConclusaoFaseGenerica
-- (js/requirements/requirements.js). Esta tabela nova é só o histórico,
-- append-only, gravada a cada save (js/config/bloqueio-orcamento.js).
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS log_percentual_bloqueio_orcamento (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    percentual_anterior NUMERIC,
    percentual_novo     NUMERIC,
    alterado_por        TEXT,
    alterado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE log_percentual_bloqueio_orcamento DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM log_percentual_bloqueio_orcamento ORDER BY alterado_em DESC;
-- =========================================================================
