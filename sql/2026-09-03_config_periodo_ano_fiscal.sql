-- =========================================================================
-- 2026-09-03_config_periodo_ano_fiscal.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Feature 1.2 — Período do Ano Fiscal parametrizável.
-- Hoje getInfoAnoFiscal() (js/core/fiscal-year.js) tem abril–março fixo no
-- código. Passa a ler o mês de início daqui, COM VIGÊNCIA: cada linha vale
-- a partir de vigencia_de; datas anteriores à primeira vigência continuam
-- apuradas em abril (mês 4). Append-only — nunca UPDATE, sempre INSERT de
-- nova linha ao alterar o parâmetro.
--
-- SEM linha de catalogo_atividades: a tela "Período do Ano Fiscal" é
-- role-gated hardcoded (ehAdministrador || ehProprietario), no mesmo padrão
-- de Licenciamento de Módulos / Funções e Permissões.
--
-- Sem RLS (mesmo tratamento das demais tabelas de config do sistema).
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS config_periodo_ano_fiscal (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mes_inicio           SMALLINT NOT NULL DEFAULT 4 CHECK (mes_inicio BETWEEN 1 AND 12),
    vigencia_de          DATE NOT NULL DEFAULT CURRENT_DATE,
    alterado_por         TEXT,
    alterado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    mes_inicio_anterior  SMALLINT
);

ALTER TABLE config_periodo_ano_fiscal DISABLE ROW LEVEL SECURITY;

-- SEM seed: com a tabela vazia o app usa o fallback abril (mês 4) e o
-- comportamento fica idêntico ao de hoje até alguém cadastrar um período.

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM config_periodo_ano_fiscal ORDER BY vigencia_de;
-- =========================================================================
