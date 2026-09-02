-- =========================================================================
-- 2026-09-02_fechamento_ano_fiscal_v2.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Reorganiza o "Fechamento de Ano Fiscal":
--   * "Decisão de Fechamento de Projetos" e "Resultado do Ano Fiscal"
--     deixam de ser telas separadas — viram as 2 abas da tela única
--     "Fechamento Ano Fiscal" (tabId fechamento_af).
--   * A tela "Projetos Carry Over" (carry_over) deixa de existir — suas
--     ações foram para a aba "Avaliação Projetos Fechamento Ano Fiscal".
--   * Fechamento do ANO FISCAL (diferente do fechamento do ORÇAMENTO):
--     flag + log de quem/quando/comentário. Passa a ser pré-condição
--     para abrir o próximo Ano Fiscal.
--
-- Catálogo alvo (grupo ANO FISCAL):
--   ABERTURA ANO FISCAL   (ano_fiscal — inalterado)
--   FECHAMENTO ANO FISCAL -> AVALIAÇÃO E FECHAMENTO ANO FISCAL   (fechamento_af:avaliacao)
--                         -> AVALIAÇÃO PROJETOS FECHAMENTO ANO FISCAL (fechamento_af:projetos)
--   AJUSTE DE ORÇAMENTO   (ajuste_orcamento — inalterado)
--
-- Idempotente. Rode no Supabase → SQL Editor (catalogo_atividades /
-- funcao_atividades têm RLS — o SQL Editor roda como service_role).
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) anos_fiscais_config: flag e log do fechamento do ANO FISCAL
-- -------------------------------------------------------------------------
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS ano_fiscal_fechado    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_por        TEXT;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_em         TIMESTAMPTZ;
ALTER TABLE anos_fiscais_config ADD COLUMN IF NOT EXISTS af_fechado_observacao TEXT;

CREATE TABLE IF NOT EXISTS log_fechamento_ano_fiscal (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_fiscal  TEXT NOT NULL,
    acao        TEXT NOT NULL DEFAULT 'FECHAMENTO',   -- 'FECHAMENTO' | 'REABERTURA'
    fechado_por TEXT NOT NULL,
    fechado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    observacao  TEXT
);
ALTER TABLE log_fechamento_ano_fiscal DISABLE ROW LEVEL SECURITY;

-- Tabela de decisões por projeto (criada no script anterior; recriada aqui
-- por segurança caso este rode primeiro).
CREATE TABLE IF NOT EXISTS fechamento_af_decisoes (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_fiscal         TEXT NOT NULL,
    projeto_codigo     TEXT NOT NULL,
    decisao            TEXT NOT NULL,          -- 'CONTINUAR' | 'HOLD' | 'CANCELAR' | 'REVERTIDO'
    valor_remanescente NUMERIC(15,2),
    observacao         TEXT,
    decidido_por       TEXT NOT NULL,
    decidido_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fechamento_af_decisoes_projeto
    ON fechamento_af_decisoes (projeto_codigo, decidido_em DESC);
ALTER TABLE fechamento_af_decisoes DISABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------------------
-- 2) Catálogo — remove as atividades das telas que deixaram de existir
-- -------------------------------------------------------------------------
DELETE FROM funcao_atividades
WHERE atividade_id IN (
    SELECT id FROM catalogo_atividades
    WHERE activity_key IN ('carry_over', 'fechamento_projetos', 'resultado_af')
);
DELETE FROM catalogo_atividades
WHERE activity_key IN ('carry_over', 'fechamento_projetos', 'resultado_af');


-- -------------------------------------------------------------------------
-- 3) Catálogo — as 2 atividades da tela única "Fechamento Ano Fiscal"
-- -------------------------------------------------------------------------
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Fechamento Ano Fiscal', 'Avaliação e Fechamento Ano Fiscal', 'fechamento_af:avaliacao', false, 4
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'fechamento_af:avaliacao');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Fechamento Ano Fiscal', 'Avaliação Projetos Fechamento Ano Fiscal', 'fechamento_af:projetos', false, 4
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'fechamento_af:projetos');


-- -------------------------------------------------------------------------
-- 4) Grants (funcao_atividades)
--    GOVERNANÇA / GESTOR TI -> alteram (registram decisões / fecham o AF).
--    FINANCEIRO -> só consulta. Administrador / Proprietário por bypass.
--    OBS: confira no SELECT do fim se o nome de cada função bateu.
-- -------------------------------------------------------------------------
WITH novas(funcao_nome, activity_key, c, i, a, d) AS (
    VALUES
      ('GOVERNANÇA', 'fechamento_af:avaliacao', true, true,  true,  false),
      ('GESTOR TI',  'fechamento_af:avaliacao', true, true,  true,  false),
      ('FINANCEIRO', 'fechamento_af:avaliacao', true, false, false, false),
      ('GOVERNANÇA', 'fechamento_af:projetos',  true, true,  true,  false),
      ('GESTOR TI',  'fechamento_af:projetos',  true, true,  true,  false),
      ('FINANCEIRO', 'fechamento_af:projetos',  true, false, false, false)
)
INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, n.c, n.i, n.a, n.d
FROM novas n
JOIN funcoes f              ON f.nome = n.funcao_nome
JOIN catalogo_atividades ca ON ca.activity_key = n.activity_key
WHERE NOT EXISTS (
    SELECT 1 FROM funcao_atividades fa
    WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
);

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Conferência (rode separado):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'anos_fiscais_config' AND column_name LIKE 'af_fechado%' OR column_name = 'ano_fiscal_fechado';
--
--   SELECT grupo, subgrupo, atividade, activity_key, ordem
--   FROM catalogo_atividades WHERE grupo = 'ANO FISCAL' ORDER BY ordem, activity_key;
--
--   SELECT f.nome, ca.activity_key, fa.pode_consultar, fa.pode_incluir, fa.pode_alterar
--   FROM funcao_atividades fa
--   JOIN funcoes f ON f.id = fa.funcao_id
--   JOIN catalogo_atividades ca ON ca.id = fa.atividade_id
--   WHERE ca.activity_key LIKE 'fechamento_af:%' ORDER BY ca.activity_key, f.nome;
-- =========================================================================
