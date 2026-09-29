-- ==========================================================================
-- Fase 1 — D-05: adiciona colunas faltantes em pacote_fy_itens
--           (status_fy, situacao, provisioning) identificadas na auditoria
-- ==========================================================================

ALTER TABLE pacote_fy_itens
    ADD COLUMN IF NOT EXISTS status_fy    TEXT    NOT NULL DEFAULT 'INCLUIDO',
    ADD COLUMN IF NOT EXISTS situacao     TEXT    NOT NULL DEFAULT 'ATIVO',
    ADD COLUMN IF NOT EXISTS provisioning BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pacote_fy_itens.status_fy    IS 'Status do item dentro do pacote FY: INCLUIDO | SUSPENSO | CANCELADO';
COMMENT ON COLUMN pacote_fy_itens.situacao     IS 'Situação operacional: ATIVO | CONCLUIDO | CANCELADO';
COMMENT ON COLUMN pacote_fy_itens.provisioning IS 'true = item ainda em provisioning (valor reservado, não confirmado)';
