-- =========================================================================
-- 2026-09-23_r4_catalogo.sql
-- Compasso 2.0 — Release 4. SÓ Compasso.
--
-- Catálogo das 3 telas novas (Busca Global, Relatórios, Configurações) —
-- mesmo raciocínio dos releases anteriores: concedidas por padrão a
-- todas as funções, porque cada uma só reaproveita RBAC/RLS que já
-- restringe os dados de verdade (busca nunca alcança nada fora do
-- escopo do usuário; relatórios exportam só o que a consulta de origem
-- já filtrava).
--
-- Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Busca', 'Busca Global', 'busca_global', false, 4
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'busca_global');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Relatórios', 'Relatórios', 'relatorios', false, 5
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'relatorios');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Configurações', 'Configurações', 'configuracoes', false, 6
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'configuracoes');

INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, true, true, true
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key IN ('busca_global', 'relatorios', 'configuracoes')
  AND NOT EXISTS (
      SELECT 1 FROM funcao_atividades fa
      WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
  );

NOTIFY pgrst, 'reload schema';
-- =========================================================================
