-- =========================================================================
-- 2026-08-31_reorg_menus_cargos_responsaveis.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- NOVO (a pedido do usuário): reorganização de menus.
--   * "Cargos" sai do grupo ADMINISTRAÇÃO e vai pra PARÂMETROS E CADASTRO.
--   * "Responsáveis por Atividades" sai de PERFIS DE ACESSO e vai pra
--     ADMINISTRAÇÃO, logo antes de "Gestão de Templates".
--
-- O menu lateral em si é HTML (index.html) — este script só alinha o
-- catálogo (catalogo_atividades.grupo_funcao / ordem), que é o que
-- agrupa/ordena as telas de "Funções e Permissões" e "Restrição de Área
-- por Atividade". Sem isto, essas duas telas mostrariam o agrupamento
-- antigo.
--
-- ordem: valores repetidos são OK (o catálogo já tem outros — ex.: as
-- linhas :criar/:cadastrados criadas nas migrações anteriores compartilham
-- ordem). Cargos entra no fim de PARÂMETROS (ordem 59, junto de
-- Planejamento Estratégico); Responsáveis entra junto de "SLA e Prazos"
-- (ordem 61), antes de Gestão de Templates (62).
--
-- Idempotente. Rode no Supabase → SQL Editor (projeto fytynjjvzecljmgbtwec).
-- =========================================================================

UPDATE catalogo_atividades
   SET grupo_funcao = 'PARÂMETROS E CADASTRO', ordem = 59
 WHERE activity_key IN ('cargos:criar', 'cargos:cadastrados');

UPDATE catalogo_atividades
   SET grupo_funcao = 'ADMINISTRAÇÃO', ordem = 61
 WHERE activity_key IN ('responsaveis:criar', 'responsaveis:cadastrados');

NOTIFY pgrst, 'reload schema';

-- Conferência (opcional):
--   SELECT ordem, grupo_funcao, activity_key FROM catalogo_atividades
--   WHERE activity_key IN ('cargos:criar','cargos:cadastrados',
--                          'responsaveis:criar','responsaveis:cadastrados')
--   ORDER BY ordem, id;
-- =========================================================================
