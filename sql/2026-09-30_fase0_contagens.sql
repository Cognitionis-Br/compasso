-- =============================================================================
-- COMPASSO 2.0 — fase0_contagens.sql
-- Data: 2026-09-30
-- Propósito: contagens reais do banco para fechar o A0 (RESPOSTA_AUDITORIA_FASE0
--            seção D5). SOMENTE LEITURA — todas as queries são SELECT.
--            Rodar no SQL Editor do Supabase e devolver o resultado.
-- =============================================================================

-- ─── FISCAL YEARS ────────────────────────────────────────────────────────────
-- FYs por ano_fiscal e ano_fiscal_fechado
SELECT
    ano_fiscal,
    ano_fiscal_fechado,
    status,
    bc_package_status
FROM fiscal_years
ORDER BY ano_fiscal;

-- ─── BUSINESS CASES ──────────────────────────────────────────────────────────
-- BCs por sub_status e adhoc
SELECT
    sub_status,
    COALESCE(adhoc, false) AS adhoc,
    COUNT(*) AS qtd
FROM business_cases
GROUP BY sub_status, adhoc
ORDER BY sub_status;

-- O que é ORÇAMENTO REALIZADO e em qual estado ele entra:
-- (RESPOSTA 2.1 — identifica o sub_status 'ORCAMENTO REALIZADO' se existir)
SELECT sub_status, COUNT(*) AS qtd
FROM business_cases
WHERE sub_status ILIKE '%REALIZADO%' OR sub_status ILIKE '%ORCAMENTO%'
GROUP BY sub_status;

-- Mapeamento sub_status real → estado do caderno M05
-- (RESPOSTA 2.1 — lista todos os sub_status distintos)
SELECT DISTINCT sub_status, COUNT(*) AS qtd
FROM business_cases
GROUP BY sub_status
ORDER BY sub_status;

-- Projects sem baseline financeira (D5 — valor aprovado no FY gravado na criação)
-- Nota: D5 diz que business_case_estimativas NÃO serve como proxy.
-- Verificar se a coluna val_bc (campo do caderno M05) está preenchida:
SELECT
    COUNT(*) AS total_projects,
    SUM(CASE WHEN val_bc IS NULL OR val_bc = 0 THEN 1 ELSE 0 END) AS sem_baseline_val_bc,
    SUM(CASE WHEN horas_bc IS NULL OR horas_bc = 0 THEN 1 ELSE 0 END) AS sem_baseline_horas
FROM business_cases
WHERE etapa_atual <> 'BUSINESS CASE';

-- ─── ADM — TABELAS LEGADAS ────────────────────────────────────────────────────
-- Áreas
SELECT COUNT(*) AS total_areas, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativas
FROM areas_solicitantes;

-- Cargos
SELECT COUNT(*) AS total_cargos, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativos
FROM cargos;

-- Produtos
SELECT COUNT(*) AS total_produtos, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativos
FROM produtos;

-- Tipos de projeto
SELECT COUNT(*) AS total_tipos, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativos
FROM tipos_projeto;

-- Pessoas solicitantes
SELECT COUNT(*) AS total_pessoas, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativas
FROM pessoas_solicitantes;

-- Funções e atribuições
SELECT
    (SELECT COUNT(*) FROM funcoes) AS total_funcoes,
    (SELECT COUNT(*) FROM usuario_funcoes) AS total_atribuicoes,
    (SELECT COUNT(*) FROM perfis_usuarios) AS total_usuarios;

-- Usuários por função
SELECT f.nome AS funcao, COUNT(uf.usuario_id) AS qtd
FROM funcoes f
LEFT JOIN usuario_funcoes uf ON uf.funcao_id = f.id
GROUP BY f.nome ORDER BY f.nome;

-- ─── MODULO_FUNCAO ────────────────────────────────────────────────────────────
-- Linhas de modulo_funcao por módulo (D5)
SELECT modulo, COUNT(*) AS qtd_funcoes
FROM modulo_funcao
GROUP BY modulo ORDER BY modulo;

-- Total
SELECT COUNT(*) AS total_modulo_funcao FROM modulo_funcao;

-- ─── TABELAS M12A (verificação do que foi criado pela Fase 2A/3A) ─────────────
-- fiscal_years
SELECT COUNT(*) AS total_fy FROM fiscal_years;

-- project_fiscal_transition
SELECT tipo, status, COUNT(*) AS qtd
FROM project_fiscal_transition
GROUP BY tipo, status ORDER BY tipo, status;

-- fiscal_year_closing
SELECT COUNT(*) AS total_closings FROM fiscal_year_closing;

-- project_fiscal_plan
SELECT COUNT(*) AS total_plans, COUNT(DISTINCT business_case_codigo) AS distinct_bcs
FROM project_fiscal_plan;

-- ─── REGISTRO DE PLANEJAMENTO (RESPOSTA 2.4) ─────────────────────────────────
-- Verificar se há trigger/policy bloqueando UPDATE e DELETE
-- (retorna as policies RLS ativas na tabela)
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'registro_planejamento'
ORDER BY policyname;

-- Verificar triggers na tabela
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'registro_planejamento'
ORDER BY trigger_name;
