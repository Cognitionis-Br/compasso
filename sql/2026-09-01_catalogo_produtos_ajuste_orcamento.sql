-- =========================================================================
-- 2026-09-01_catalogo_produtos_ajuste_orcamento.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Item 9 da tarefa — cadastra as novas atividades no catálogo JÁ com CRUD
-- (as colunas pode_consultar/incluir/alterar/deletar de funcao_atividades
-- já existem — Fase 1 de segurança). Não é migração posterior: o INSERT
-- já preenche as 4 flags.
--
--   produtos:criar / produtos:cadastrados  -> grupo "PARÂMETROS E CADASTROS",
--       subgrupo "Cadastro de Produtos". CRUD completo para GOVERNANÇA
--       (mesmo papel que administra Tipos de Projeto / Áreas / etc).
--   ajuste_orcamento -> grupo "ANO FISCAL", subgrupo "Ajuste de Orçamento".
--       NÃO é um dos 4 itens blindados de Administrador/Proprietário —
--       é permissão normal do catálogo. CRUD completo para FINANCEIRO
--       (dono do orçamento) e GOVERNANÇA (já faz Mudança de Orçamento,
--       Carryover e Demanda Extraordinária).
--
-- catalogo_atividades e funcao_atividades estão sob RLS (escrita só
-- acesso_irrestrito / eh_proprietario) — por isso este script roda
-- DIRETO no SQL Editor do Supabase (service_role ignora RLS), fora do app.
--
-- Idempotente (NOT EXISTS por activity_key / par funcao+atividade).
-- =========================================================================

-- ---- 1. catalogo_atividades ----
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'PARÂMETROS E CADASTROS', 'Cadastro de Produtos', 'Cadastrar Produto', 'produtos:criar', false, 57
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'produtos:criar');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'PARÂMETROS E CADASTROS', 'Cadastro de Produtos', 'Produtos Cadastrados', 'produtos:cadastrados', false, 57
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'produtos:cadastrados');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Ajuste de Orçamento', 'Ajuste de Orçamento', 'ajuste_orcamento', false, 3
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'ajuste_orcamento');

-- ---- 2. funcao_atividades (CRUD já preenchido) ----
-- helper: (funcao_nome, activity_key, C, I, A, D)
WITH novas(funcao_nome, activity_key, c, i, a, d) AS (
    VALUES
      ('GOVERNANÇA',  'produtos:criar',        true, true,  true,  true),
      ('GOVERNANÇA',  'produtos:cadastrados',  true, true,  true,  true),
      ('FINANCEIRO',  'ajuste_orcamento',      true, true,  true,  true),
      ('GOVERNANÇA',  'ajuste_orcamento',      true, true,  true,  true)
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

-- Conferência:
--   SELECT f.nome, c.activity_key, fa.pode_consultar, fa.pode_incluir, fa.pode_alterar, fa.pode_deletar
--   FROM funcao_atividades fa
--   JOIN funcoes f ON f.id = fa.funcao_id
--   JOIN catalogo_atividades c ON c.id = fa.atividade_id
--   WHERE c.activity_key IN ('produtos:criar','produtos:cadastrados','ajuste_orcamento')
--   ORDER BY f.nome, c.activity_key;
-- =========================================================================
