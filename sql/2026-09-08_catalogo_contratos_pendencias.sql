-- =========================================================================
-- 2026-09-08_catalogo_contratos_pendencias.sql   (Release 1)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Atividades de catálogo da tela "Pendências de Contratos" (grupo
-- "CONTRATOS E TERCEIROS"). Três verbos, no mesmo padrão de
-- ajuste_orcamento / controle_orcamento:
--
--   contratos_pendencias:consultar  -> ver a lista de pendências
--   contratos_pendencias:importar   -> upload de planilha Excel / lançar manual
--   contratos_pendencias:aprovar    -> aprovar / rejeitar / corrigir / dispensar NF
--
-- Atividade DELEGÁVEL: Administrador/Proprietário entram por bypass
-- (acesso_irrestrito), e um Administrador pode conceder qualquer um dos
-- verbos a outro perfil em Funções e Permissões (§8.1 da spec). SEM grant
-- inicial.
--
-- catalogo_atividades / funcao_atividades estão sob RLS — rode DIRETO no
-- SQL Editor do Supabase (service_role ignora RLS). Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'CONTRATOS E TERCEIROS', 'Pendências de Contratos', 'Consultar pendências', 'contratos_pendencias:consultar', false, 70
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'contratos_pendencias:consultar');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'CONTRATOS E TERCEIROS', 'Pendências de Contratos', 'Importar / lançar manualmente', 'contratos_pendencias:importar', false, 71
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'contratos_pendencias:importar');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'CONTRATOS E TERCEIROS', 'Pendências de Contratos', 'Aprovar / Rejeitar / Corrigir', 'contratos_pendencias:aprovar', false, 72
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'contratos_pendencias:aprovar');

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT activity_key, grupo, subgrupo, ordem FROM catalogo_atividades
--   WHERE activity_key LIKE 'contratos_pendencias:%' ORDER BY ordem;
-- =========================================================================
