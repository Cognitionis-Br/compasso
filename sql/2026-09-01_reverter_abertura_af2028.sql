-- =========================================================================
-- 2026-09-01_reverter_abertura_af2028.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- A abertura do AF2028 foi feita em teste ("Abrir Recebimento de Demandas").
-- Isso criou:
--   - uma linha em anos_fiscais_config para AF2028 (com totais de fechamento
--     de teste: valor_total_fechado / qtd_projetos_fechado);
--   - uma linha em contadores_codigo_projeto para AF2028 (ultimo_numero = 1).
-- Nenhum projeto real está no AF2028 (verificado: 0 projetos ano_fiscal='AF2028').
--
-- Este script REVERTE a abertura, devolvendo o AF2028 ao estado "nunca aberto"
-- (= o painel Ano Fiscal volta a mostrar "⚪ Ainda fechado" para o próximo AF,
-- com o botão de abrir disponível de novo). Não toca no AF2027.
--
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

DELETE FROM anos_fiscais_config      WHERE ano_fiscal = 'AF2028';
DELETE FROM contadores_codigo_projeto WHERE ano_fiscal = 'AF2028';

NOTIFY pgrst, 'reload schema';
-- =========================================================================
