-- =========================================================================
-- 2026-09-03_preparar_base_testes.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Prepara a base ATUAL para uma rodada limpa de testes de Workflow e
-- Controles de Orçamento, a partir dos dados já existentes.
--
-- O QUE FAZ:
--   1. Ano Fiscal: AF2026 = "em andamento" (orçamento fechado, ainda não
--      encerrado); AF2027 = "pipeline" recebendo demandas normais.
--   2. Apaga TODOS os projetos e todos os seus itens/logs (a base é 100%
--      teste). Os cadastros (áreas, pessoas, produtos, portes, tipos,
--      pilares/iniciativas, contratos/empresas, funções, usuários, empresa
--      licenciada) NÃO são tocados.
--   3. Zera o contador de código de projeto de AF2026 e AF2027.
--
-- DEPOIS DESTE SCRIPT, rode NA ORDEM:
--   a) sql/2026-09-11_seed_49_projetos_af2027.sql
--      (substitui o antigo sql/2026-09-02_seed_49_projetos_teste CARGA DE 49
--       PROJETOS PARA TESTES.sql — agora auto-adaptável ao cadastro atual;
--       já sai com pilar/iniciativa, então o antigo passo opcional (c),
--       sql/2026-09-02_update_pilar_iniciativa_projetos_teste.sql, não é
--       mais necessário)
--   b) sql/2026-09-10_seed_12_projetos_af2026.sql
--      (substitui o antigo sql/2026-09-02_seed_12_projetos_carryover_af2026.sql —
--       agora auto-adaptável ao conteúdo das tabelas de cadastro)
--
-- Resultado final: exatamente 49 (AF2027, Business Case / A Planejar) + 12
-- (AF2026, distribuídos por fase, NÃO carryover) = 61 projetos, no estado
-- original das cargas. Qualquer projeto criado durante os testes some.
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================


-- =========================================================================
-- 1. ANO FISCAL
-- =========================================================================
INSERT INTO anos_fiscais_config (ano_fiscal, orcamento_fechado, recebimento_demandas_aberto, ano_fiscal_fechado)
VALUES ('AF2026', true, false, false)
ON CONFLICT (ano_fiscal) DO UPDATE SET
    orcamento_fechado            = true,
    recebimento_demandas_aberto  = false,
    ano_fiscal_fechado           = false,
    af_fechado_por               = NULL,
    af_fechado_em                = NULL,
    af_fechado_observacao        = NULL;

INSERT INTO anos_fiscais_config (ano_fiscal, orcamento_fechado, recebimento_demandas_aberto, ano_fiscal_fechado)
VALUES ('AF2027', false, true, false)
ON CONFLICT (ano_fiscal) DO UPDATE SET
    orcamento_fechado            = false,
    recebimento_demandas_aberto  = true,
    ano_fiscal_fechado           = false,
    af_fechado_por               = NULL,
    af_fechado_em                = NULL,
    af_fechado_observacao        = NULL;


-- =========================================================================
-- 2. PROJETOS + ITENS/LOGS  (tudo — a base é 100% teste)
--    Ordem: filhos/transacionais primeiro, projetos por último (FKs).
-- =========================================================================

-- 2.1 — itens de fase / avaliação / conclusão
DELETE FROM projeto_etapas;
DELETE FROM projeto_benefit_results;
DELETE FROM log_decisoes_etapa;
DELETE FROM log_alteracoes_horas;
DELETE FROM log_ratificacao_planejamento;
DELETE FROM log_retomada_hold;
DELETE FROM log_aprovacao_mudanca_orcamento;

-- 2.2 — Go-Live
DELETE FROM golive_ocorrencias;
DELETE FROM golive_termo_aceite;

-- 2.3 — contratos (vínculos e pagamentos são transacionais; empresas e
--        contratos-base ficam como cadastro)
DELETE FROM log_alteracao_vinculo_contrato;
DELETE FROM contratos_pagamentos;
DELETE FROM contratos_vinculos_projeto;

-- 2.4 — extraordinária / carryover / fechamento de AF / ajuste de orçamento
DELETE FROM adhoc_aprovacoes;
DELETE FROM tradeoff_validacao_pendencias;
DELETE FROM fechamento_af_decisoes;
DELETE FROM ajuste_orcamento_autorizacoes;
DELETE FROM log_fechamento_ano_fiscal;

-- 2.5 — fila de e-mail
DELETE FROM emails_pendentes;

-- 2.6 — os projetos
DELETE FROM projetos;


-- =========================================================================
-- 3. CONTADOR DE CÓDIGO DE PROJETO — zera AF2026 e AF2027
--    (a próxima demanda real nova sai como PRJ-FYxx-001)
-- =========================================================================
UPDATE contadores_codigo_projeto SET ultimo_numero = 0
 WHERE ano_fiscal IN ('AF2026', 'AF2027');
-- garante a linha se não existir
INSERT INTO contadores_codigo_projeto (ano_fiscal, ultimo_numero)
SELECT x.af, 0 FROM (VALUES ('AF2026'), ('AF2027')) AS x(af)
WHERE NOT EXISTS (SELECT 1 FROM contadores_codigo_projeto c WHERE c.ano_fiscal = x.af);


NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Conferência:
--   SELECT ano_fiscal, orcamento_fechado, recebimento_demandas_aberto, ano_fiscal_fechado
--   FROM anos_fiscais_config ORDER BY ano_fiscal;
--   SELECT count(*) AS projetos FROM projetos;                     -- esperado 0 (antes das cargas a/b)
--   SELECT ano_fiscal, ultimo_numero FROM contadores_codigo_projeto;
--
-- Depois de rodar as cargas a) e b):
--   SELECT ano_fiscal, etapa_atual, sub_status, count(*)
--   FROM projetos GROUP BY 1,2,3 ORDER BY 1,2,3;
-- =========================================================================
