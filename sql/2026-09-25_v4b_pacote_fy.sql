-- =========================================================================
-- 2026-09-25_v4b_pacote_fy.sql
-- Compasso 2.0 — V4 (Estimation), parte B: Pacote FY persistido.
--
-- Hoje "Aprovar Orçamento Ano Fiscal" (js/approvals/orcamento-af.js)
-- calcula o pacote como um filtro ao vivo sobre projectsData e nunca
-- grava um registro do fechamento em si (só atualiza flags soltas em
-- anos_fiscais_config). Este script cria as duas tabelas que passam a
-- registrar "este pacote, com estes Business Cases, fechado nesta data,
-- por este valor" de forma permanente — puramente aditivo, não altera
-- anos_fiscais_config nem o loop de UPDATE que já promove os projetos.
--
-- Reversível: DROP TABLE pacote_fy_itens; DROP TABLE pacotes_fy;
-- =========================================================================

CREATE TABLE IF NOT EXISTS pacotes_fy (
    id SERIAL PRIMARY KEY,
    ano_fiscal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'FECHADO',
    valor_total NUMERIC(14,2) NOT NULL,
    qtd_projetos INT NOT NULL,
    fechado_por TEXT,
    fechado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pacotes_fy_ano ON pacotes_fy (ano_fiscal);

CREATE TABLE IF NOT EXISTS pacote_fy_itens (
    id SERIAL PRIMARY KEY,
    pacote_fy_id INT NOT NULL REFERENCES pacotes_fy(id),
    business_case_codigo TEXT NOT NULL,
    valor_incluido NUMERIC(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pacote_fy_itens_pacote ON pacote_fy_itens (pacote_fy_id);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM pacotes_fy ORDER BY id DESC;
--   SELECT * FROM pacote_fy_itens WHERE pacote_fy_id = <id>;
-- =========================================================================
