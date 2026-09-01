-- =========================================================================
-- 2026-09-01_fase3_telas_admin_fora_do_catalogo.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- FASE 3 do endurecimento de RBAC/RLS (ver SEGURANCA.md).
-- Remove PERMANENTEMENTE do catálogo comum (catalogo_atividades) as telas
-- que passam a ser governadas só por papel (flags em `funcoes`):
--
--   funcoes_permissoes:criar / funcoes_permissoes:cadastradas
--   atribuicao_funcoes
--   restricao_area_atividades
--       -> visíveis/acessíveis só p/ ehAdministrador OU ehProprietario
--          (checado em js/ui/navigation.js e js/config/funcoes.js)
--   licenciamento_modulos
--       -> segue exclusivo de ehProprietario (já era; a linha do catálogo
--          era vestigial, sem concessões)
--
-- Concessões afetadas hoje: função GOVERNANÇA (id 9) tinha as 4 primeiras.
-- Elas são apagadas — usuários só com GOVERNANÇA deixam de ver essas 3
-- telas (comportamento pretendido pelo endurecimento).
--
-- Este é o único ponto da especificação que autoriza DELETE nessas linhas.
-- Idempotente (re-rodar = 0 linhas). Supabase -> SQL Editor.
-- =========================================================================

-- 1. Remove as concessões dessas atividades em funcao_atividades.
DELETE FROM funcao_atividades
 WHERE atividade_id IN (
   SELECT id FROM catalogo_atividades
    WHERE activity_key IN (
      'funcoes_permissoes:criar', 'funcoes_permissoes:cadastradas',
      'atribuicao_funcoes', 'restricao_area_atividades', 'licenciamento_modulos'));

-- 2. Remove as 5 linhas do catálogo comum.
DELETE FROM catalogo_atividades
 WHERE activity_key IN (
   'funcoes_permissoes:criar', 'funcoes_permissoes:cadastradas',
   'atribuicao_funcoes', 'restricao_area_atividades', 'licenciamento_modulos');

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT activity_key FROM catalogo_atividades
--   WHERE activity_key LIKE 'funcoes_permissoes%'
--      OR activity_key IN ('atribuicao_funcoes','restricao_area_atividades','licenciamento_modulos');
--   -- deve voltar 0 linhas
-- =========================================================================
