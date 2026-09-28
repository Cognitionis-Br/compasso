-- =============================================================================
-- V11: M15 Licenciamento — Entitlements por módulo
-- Adiciona status/vigência/limite em licenca_modulos.
-- Idempotente via ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE licenca_modulos
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS valid_from DATE,
    ADD COLUMN IF NOT EXISTS valid_until DATE,
    ADD COLUMN IF NOT EXISTS contractual_limit INT;

-- Backfill: sincronizar status com ativo atual para filas existentes.
UPDATE licenca_modulos
SET status = CASE WHEN ativo = true THEN 'ACTIVE' ELSE 'SUSPENDED' END;

-- CHECK constraint idempotente.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'licenca_modulos_status_check'
    ) THEN
        ALTER TABLE licenca_modulos
            ADD CONSTRAINT licenca_modulos_status_check
            CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'));
    END IF;
END $$;
