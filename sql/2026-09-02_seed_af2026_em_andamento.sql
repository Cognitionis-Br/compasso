-- =========================================================================
-- 2026-09-02_seed_af2026_em_andamento.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Cria (ou reabre) o registro do AF2026 como "Ano Fiscal em andamento":
--   orcamento_fechado  = true   (orçamento já fechado; projetos em execução)
--   ano_fiscal_fechado = false  (o ANO FISCAL ainda NÃO foi encerrado — é o
--                                que a tela "Fechamento Ano Fiscal" faz)
--   recebimento_demandas_aberto = false (não recebe demandas normais novas)
--
-- Com isso:
--   * A tela "Fechamento Ano Fiscal" (que hoje, no Q2, mira o AF anterior ao
--     corrente = AF2026) passa a ter um AF alvo válido.
--   * A "Abertura Ano Fiscal" bloqueia abrir o AF2028 enquanto o AF2026 não
--     for fechado (regra nova).
--
-- Rodar de novo REABRE o AF2026 (zera ano_fiscal_fechado / af_fechado_*),
-- útil para repetir os testes.
--
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

-- Defensivo: garante as colunas do fechamento do Ano Fiscal mesmo que o
-- script 2026-09-02_fechamento_ano_fiscal_v2.sql ainda não tenha rodado.
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS ano_fiscal_fechado    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_por        TEXT;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_em         TIMESTAMPTZ;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_observacao TEXT;

INSERT INTO anos_fiscais_config
    (ano_fiscal, recebimento_demandas_aberto, orcamento_fechado, ano_fiscal_fechado,
     fechado_por, fechado_em, valor_total_fechado, qtd_projetos_fechado, aberto_por, aberto_em)
VALUES
    ('AF2026', false, true, false,
     'CARGA TESTE', now() - INTERVAL '150 days', 0, 0, 'CARGA TESTE', now() - INTERVAL '330 days')
ON CONFLICT (ano_fiscal) DO UPDATE SET
    recebimento_demandas_aberto = false,
    orcamento_fechado           = true,
    ano_fiscal_fechado          = false,
    af_fechado_por              = NULL,
    af_fechado_em               = NULL,
    af_fechado_observacao       = NULL;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Conferência:
--   SELECT ano_fiscal, recebimento_demandas_aberto, orcamento_fechado,
--          ano_fiscal_fechado, af_fechado_por
--   FROM anos_fiscais_config ORDER BY ano_fiscal;
-- =========================================================================
