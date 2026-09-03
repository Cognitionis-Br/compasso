-- =========================================================================
-- 2026-09-03_catalogo_admin_orcamento.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Atividades de catálogo das novas telas de orçamento:
--
--   controle_orcamento  -> grupo "ADMINISTRAÇÃO", subgrupo "Controle
--       Orçamentário". Atividade DELEGÁVEL: Administrador/Proprietário
--       entram por bypass (acesso_irrestrito), e um Administrador pode
--       conceder esta atividade a outro perfil em Funções e Permissões.
--       SEM grant inicial.
--
--   validacao_tradeoff  -> grupo "ANO FISCAL", subgrupo "Validação de
--       Trade-off Extraordinário". CRUD (consultar+alterar) para
--       GOVERNANÇA e GESTOR TI, além do bypass de Administrador/Proprietário.
--
-- A tela "Período do Ano Fiscal" NÃO entra no catálogo — é role-gated
-- hardcoded (ehAdministrador || ehProprietario), como Licenciamento de
-- Módulos.
--
-- catalogo_atividades / funcao_atividades estão sob RLS — rode DIRETO no
-- SQL Editor do Supabase (service_role ignora RLS). Idempotente.
-- =========================================================================

-- ---- 1. catalogo_atividades ----
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ADMINISTRAÇÃO', 'Controle Orçamentário', 'Modo de Controle Orçamentário', 'controle_orcamento', false, 60
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'controle_orcamento');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'ANO FISCAL', 'Validação de Trade-off Extraordinário', 'Validação de Trade-off Extraordinário', 'validacao_tradeoff', false, 5
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'validacao_tradeoff');

-- ---- 2. funcao_atividades ----
-- controle_orcamento: SEM grant inicial (só Admin/Proprietário por bypass).
-- validacao_tradeoff: consultar + alterar para GOVERNANÇA e GESTOR TI.
WITH novas(funcao_nome, activity_key, c, i, a, d) AS (
    VALUES
      ('GOVERNANÇA', 'validacao_tradeoff', true, false, true, false),
      ('GESTOR TI',  'validacao_tradeoff', true, false, true, false)
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
--   SELECT activity_key, grupo, subgrupo FROM catalogo_atividades
--   WHERE activity_key IN ('controle_orcamento','validacao_tradeoff');
--
--   SELECT f.nome, c.activity_key, fa.pode_consultar, fa.pode_alterar
--   FROM funcao_atividades fa
--   JOIN funcoes f ON f.id = fa.funcao_id
--   JOIN catalogo_atividades c ON c.id = fa.atividade_id
--   WHERE c.activity_key IN ('controle_orcamento','validacao_tradeoff')
--   ORDER BY f.nome, c.activity_key;
--   -- (validacao_tradeoff deve aparecer p/ GOVERNANÇA e GESTOR TI;
--   --  controle_orcamento não aparece pra ninguém — só Admin por bypass)
-- =========================================================================
