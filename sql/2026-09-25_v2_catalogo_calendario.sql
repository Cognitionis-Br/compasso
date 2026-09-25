-- =========================================================================
-- 2026-09-25_v2_catalogo_calendario.sql
-- Compasso 2.0 — V2 do Plano de Evolução (Calendário Global, SCR-05).
--
-- Sem isso, o link "Calendário" da sidebar fica invisível pra todo mundo
-- que não é Administrador/Proprietário — aplicarVisibilidadeMenu()
-- (js/config/funcoes.js) só mostra um link-<tabId> se 'calendario' for um
-- activity_key existente em catalogo_atividades com grant pra função do
-- usuário logado (mesmo mecanismo usado pelas 4 telas do Release 1 em
-- sql/2026-09-23_r1_catalogo_trabalho_pessoal.sql, mesma justificativa:
-- tela do núcleo do sistema, cada usuário só vê o próprio recorte —
-- concedida por padrão a TODAS as funções já cadastradas.
--
-- Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'TRABALHO PESSOAL', 'Calendário', 'Calendário Global', 'calendario', false, 6
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'calendario');

INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, true, true, true
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key = 'calendario'
  AND NOT EXISTS (
      SELECT 1 FROM funcao_atividades fa
      WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
  );

NOTIFY pgrst, 'reload schema';
-- =========================================================================
