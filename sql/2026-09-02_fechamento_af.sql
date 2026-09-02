-- =========================================================================
-- 2026-09-02_fechamento_af.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Épico "Fechamento de Ano Fiscal e Carryover de Projetos":
--   * Tabela de log das decisões de fechamento (Continuar / Hold / Cancelar).
--   * Duas atividades novas no catálogo (grupo ANO FISCAL):
--       - fechamento_projetos  -> tela "Decisão de Fechamento de Projetos"
--       - resultado_af         -> tela "Resultado do Ano Fiscal"
--   * Grants em funcao_atividades.
--
-- Sem RLS na tabela de log (mesmo tratamento de ajuste_orcamento_autorizacoes;
-- o app grava com a chave publishable). catalogo_atividades / funcao_atividades
-- têm RLS (Fase 4) — este script roda no SQL Editor, onde service_role bypassa.
--
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) Log das decisões de fechamento
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fechamento_af_decisoes (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_fiscal         TEXT NOT NULL,
    projeto_codigo     TEXT NOT NULL,
    decisao            TEXT NOT NULL,          -- 'CONTINUAR' | 'HOLD' | 'CANCELAR'
    valor_remanescente NUMERIC(15,2),
    observacao         TEXT,
    decidido_por       TEXT NOT NULL,
    decidido_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_af_decisoes_projeto
    ON fechamento_af_decisoes (projeto_codigo, decidido_em DESC);

ALTER TABLE fechamento_af_decisoes DISABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------------------
-- 2) Atividades no catálogo (grupo ANO FISCAL)
-- -------------------------------------------------------------------------
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Fechamento de Projetos', 'Decidir Fechamento de Projetos', 'fechamento_projetos', false, 4
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'fechamento_projetos');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Resultado do Ano Fiscal', 'Consultar Resultado do Ano Fiscal', 'resultado_af', false, 5
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'resultado_af');


-- -------------------------------------------------------------------------
-- 3) Grants (funcao_atividades)
--    Administrador / Proprietário não precisam de grant (bypass por
--    ehAdministrador / ehProprietario no front).
--    OBS: se o nome de alguma função não bater exatamente, o JOIN não gera
--    linha nenhuma para ela — confira no SELECT do fim.
-- -------------------------------------------------------------------------
WITH novas(funcao_nome, activity_key, c, i, a, d) AS (
    VALUES
      ('GOVERNANÇA', 'fechamento_projetos', true, true,  true,  false),
      ('GESTOR TI',  'fechamento_projetos', true, true,  true,  false),
      ('GOVERNANÇA', 'resultado_af',        true, false, false, false),
      ('GESTOR TI',  'resultado_af',        true, false, false, false),
      ('FINANCEIRO', 'resultado_af',        true, false, false, false)
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
--   SELECT grupo, subgrupo, atividade, activity_key, ordem
--   FROM catalogo_atividades WHERE activity_key IN ('fechamento_projetos','resultado_af');
--
--   SELECT f.nome, ca.activity_key, fa.pode_consultar, fa.pode_incluir, fa.pode_alterar, fa.pode_deletar
--   FROM funcao_atividades fa
--   JOIN funcoes f ON f.id = fa.funcao_id
--   JOIN catalogo_atividades ca ON ca.id = fa.atividade_id
--   WHERE ca.activity_key IN ('fechamento_projetos','resultado_af')
--   ORDER BY ca.activity_key, f.nome;
-- =========================================================================
