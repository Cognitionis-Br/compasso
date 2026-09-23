-- =========================================================================
-- 2026-09-23_r3_catalogo.sql
-- Compasso 2.0 — Release 3. SÓ Compasso.
--
-- Catálogo das 4 telas novas do Release 3 (Portfólio Executivo,
-- Financeiro Corporativo, Minhas Aprovações, Governança unificada) —
-- grupo "GESTÃO E GOVERNANÇA". Concedidas por padrão a todas as funções
-- já cadastradas (mesmo raciocínio do R1: cada tela já reaproveita as
-- regras de RBAC/área das telas originais que ela agrega — não introduz
-- nenhum acesso nem dado que o usuário não pudesse ver antes).
--
-- Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Portfólio', 'Portfólio Executivo', 'portfolio_executivo', false, 1
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'portfolio_executivo');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Financeiro', 'Financeiro Corporativo', 'financeiro_corporativo', false, 2
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'financeiro_corporativo');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Minhas Aprovações', 'Minhas Aprovações', 'minhas_aprovacoes', false, 5
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'minhas_aprovacoes');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Governança', 'Fila de Governança', 'governanca_unificada', false, 3
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'governanca_unificada');

INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, true, true, true
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key IN ('portfolio_executivo', 'financeiro_corporativo', 'minhas_aprovacoes', 'governanca_unificada')
  AND NOT EXISTS (
      SELECT 1 FROM funcao_atividades fa
      WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
  );

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM catalogo_atividades WHERE activity_key IN ('portfolio_executivo','financeiro_corporativo','minhas_aprovacoes','governanca_unificada');
-- =========================================================================
