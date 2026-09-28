-- =============================================================================
-- V13: M15 W1-S20 — Licenciamento Entitlements: Histórico de Alterações
-- Tabela de auditoria imutável para cada mudança em licenca_modulos
-- (status, ativo, valid_from, valid_until, contractual_limit).
-- Trigger com SECURITY DEFINER: INSERTs do audit log sempre passam,
-- independente de RLS — clientes autenticados só leem (SELECT), nunca gravam.
-- =============================================================================

CREATE TABLE IF NOT EXISTS licenca_modulos_historico (
    id              SERIAL PRIMARY KEY,
    modulo_codigo   TEXT NOT NULL,
    campo_alterado  TEXT NOT NULL,
    valor_anterior  TEXT,
    valor_novo      TEXT,
    alterado_por    TEXT,
    alterado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenca_hist_modulo
    ON licenca_modulos_historico (modulo_codigo, alterado_em DESC);

-- RLS: só leitura para autenticados; gravação exclusiva via trigger (SECURITY DEFINER).
ALTER TABLE licenca_modulos_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'licenca_modulos_historico' AND policyname = 'licenca_hist_select'
    ) THEN
        CREATE POLICY licenca_hist_select
            ON licenca_modulos_historico FOR SELECT
            TO authenticated USING (true);
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- Trigger function: captura apenas os campos que mudaram de fato.
-- SECURITY DEFINER garante que o INSERT bypassa o RLS mesmo quando
-- disparado por um usuário autenticado comum.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_licenca_modulos_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO licenca_modulos_historico
            (modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por)
        VALUES (NEW.modulo_codigo, 'status', OLD.status, NEW.status, NEW.atualizado_por);
    END IF;

    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        INSERT INTO licenca_modulos_historico
            (modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por)
        VALUES (NEW.modulo_codigo, 'ativo', OLD.ativo::TEXT, NEW.ativo::TEXT, NEW.atualizado_por);
    END IF;

    IF OLD.valid_from IS DISTINCT FROM NEW.valid_from THEN
        INSERT INTO licenca_modulos_historico
            (modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por)
        VALUES (NEW.modulo_codigo, 'valid_from', OLD.valid_from::TEXT, NEW.valid_from::TEXT, NEW.atualizado_por);
    END IF;

    IF OLD.valid_until IS DISTINCT FROM NEW.valid_until THEN
        INSERT INTO licenca_modulos_historico
            (modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por)
        VALUES (NEW.modulo_codigo, 'valid_until', OLD.valid_until::TEXT, NEW.valid_until::TEXT, NEW.atualizado_por);
    END IF;

    IF OLD.contractual_limit IS DISTINCT FROM NEW.contractual_limit THEN
        INSERT INTO licenca_modulos_historico
            (modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por)
        VALUES (NEW.modulo_codigo, 'contractual_limit', OLD.contractual_limit::TEXT, NEW.contractual_limit::TEXT, NEW.atualizado_por);
    END IF;

    RETURN NEW;
END $$;

-- Trigger idempotente.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'tg_licenca_modulos_audit'
          AND tgrelid = 'licenca_modulos'::regclass
    ) THEN
        CREATE TRIGGER tg_licenca_modulos_audit
            AFTER UPDATE ON licenca_modulos
            FOR EACH ROW EXECUTE FUNCTION fn_licenca_modulos_audit();
    END IF;
END $$;
