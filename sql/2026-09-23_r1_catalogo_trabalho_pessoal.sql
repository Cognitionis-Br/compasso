-- =========================================================================
-- 2026-09-23_r1_catalogo_trabalho_pessoal.sql
-- Compasso 2.0 — Release 1. SÓ Compasso.
--
-- Catálogo das 4 telas novas do Release 1 (Home pessoal, Meu Trabalho,
-- Meus Projetos, Notificações) — grupo "TRABALHO PESSOAL". São telas do
-- núcleo do sistema (não um módulo comercial): concedidas por padrão a
-- TODAS as funções já cadastradas, porque a RLS de sql/2026-09-23_r1_
-- fundacao_trabalho_pessoal.sql já restringe cada usuário aos próprios
-- dados — não há necessidade de controle de acesso adicional por função.
--
-- Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Início', 'Início / Home', 'home', false, 1
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'home');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Meu Trabalho', 'Meu Trabalho (Lista/Kanban)', 'meu_trabalho', false, 2
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'meu_trabalho');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Meus Projetos', 'Meus Projetos', 'meus_projetos', false, 3
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'meus_projetos');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Notificações', 'Notificações', 'notificacoes', false, 4
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'notificacoes');

-- Grant pra TODAS as funções já cadastradas (core do sistema, não módulo
-- opcional — RLS por dono já protege os dados).
INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, true, true, true
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key IN ('home', 'meu_trabalho', 'meus_projetos', 'notificacoes')
  AND NOT EXISTS (
      SELECT 1 FROM funcao_atividades fa
      WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
  );

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM catalogo_atividades WHERE grupo = 'TRABALHO PESSOAL';
-- =========================================================================
