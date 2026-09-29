-- =========================================================================
-- Fase 2 — Business Case e Pacote FY (D-02 / D-05 / D-07 / D-10)
-- Rodar no Supabase SQL Editor ANTES do deploy do código.
-- Todos os ALTER são idempotentes (IF NOT EXISTS).
-- =========================================================================

-- D-10: baseline financeira V1 — valor aprovado pelo FY gravado no BC
ALTER TABLE business_cases
    ADD COLUMN IF NOT EXISTS val_aprovado_fy    NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS motivo_devolucao_fy TEXT,
    ADD COLUMN IF NOT EXISTS dt_devolucao_fy    DATE;

-- D-02: registro do motivo de devolução por item do pacote FY
ALTER TABLE pacote_fy_itens
    ADD COLUMN IF NOT EXISTS motivo_devolucao TEXT;
