-- =============================================================================
-- V15: M12 FY-02 — Absorção de Carryover (carryover operacional)
-- Adiciona campo de rastreabilidade do AF de origem em business_cases,
-- preenchido no momento da absorção (transição de carryover para o novo AF).
-- Idempotente via ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE business_cases
    ADD COLUMN IF NOT EXISTS carryover_ano_origem TEXT;
