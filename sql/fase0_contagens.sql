-- fase0_contagens.sql
-- Compasso 2.0 — Auditoria Fase 0, Seção D5
-- Somente leitura. Execute e devolva o resultado.
-- Data de geração: 30/09/2026

-- ============================================================
-- Q01a · Business Cases por sub_status
-- ============================================================
SELECT
    COALESCE(sub_status, '(null)') AS sub_status,
    COUNT(*)                       AS qtd
FROM business_cases
GROUP BY sub_status
ORDER BY qtd DESC;

-- ============================================================
-- Q01b · Business Cases por is_adhoc
-- ============================================================
SELECT
    is_adhoc,
    COUNT(*) AS qtd
FROM business_cases
GROUP BY is_adhoc
ORDER BY is_adhoc;

-- ============================================================
-- Q02 · Exercícios Fiscais
-- ============================================================
SELECT
    ano_fiscal,
    COALESCE(ano_fiscal_fechado::TEXT, 'false')  AS fechado,
    is_orcamento_ativo,
    data_inicio,
    data_fim
FROM anos_fiscais_config
ORDER BY ano_fiscal;

-- ============================================================
-- Q03 · Tabelas legadas da ADM — contagem de linhas
-- ============================================================
SELECT 'areas'                AS tabela, COUNT(*) AS linhas FROM areas
UNION ALL
SELECT 'cargos',                           COUNT(*) FROM cargos
UNION ALL
SELECT 'produtos',                         COUNT(*) FROM produtos
UNION ALL
SELECT 'tipos_projeto',                    COUNT(*) FROM tipos_projeto
UNION ALL
SELECT 'pessoas_solicitantes',             COUNT(*) FROM pessoas_solicitantes
UNION ALL
SELECT 'funcoes',                          COUNT(*) FROM funcoes
UNION ALL
SELECT 'usuarios',                         COUNT(*) FROM usuarios
ORDER BY tabela;

-- ============================================================
-- Q04 · Usuários por função (perfil de acesso legado)
-- ============================================================
SELECT
    COALESCE(f.nome, '(sem função)') AS funcao,
    COUNT(u.id)                      AS qtd_usuarios
FROM usuarios u
LEFT JOIN funcoes f ON f.id = u.funcao_id
GROUP BY f.nome
ORDER BY qtd_usuarios DESC;

-- ============================================================
-- Q05 · modulo_funcao — linhas por módulo
-- ============================================================
SELECT
    modulo,
    COUNT(*) AS qtd_funcoes
FROM modulo_funcao
GROUP BY modulo
ORDER BY modulo;

-- ============================================================
-- Q06a · Baseline V1 — existe em pacote_fy_itens?
-- Verifica se a coluna valor_incluido existe e tem dados.
-- Conforme D-10: baseline V1 = valor aprovado no FY na criação do Project.
-- R-IN-03 especifica que o fechamento do pacote FY grava esse valor.
-- ============================================================
SELECT
    p.codigo                              AS project_codigo,
    p.nome                                AS project_nome,
    p.etapa_atual,
    pfi.valor_incluido                    AS baseline_v1_pacote_fy,
    bc.val_bc                             AS val_bc_business_case,
    CASE
        WHEN pfi.valor_incluido IS NOT NULL THEN 'EXISTE em pacote_fy_itens'
        WHEN bc.val_bc IS NOT NULL
             AND bc.val_bc > 0            THEN 'SÓ em business_cases.val_bc (aproximação)'
        ELSE                                   'AUSENTE'
    END                                   AS status_baseline_v1
FROM projects p
LEFT JOIN business_cases bc
       ON bc.codigo = p.business_case_codigo
LEFT JOIN pacote_fy_itens pfi
       ON pfi.business_case_codigo = p.business_case_codigo
WHERE p.etapa_atual IS NOT NULL
  AND p.etapa_atual <> 'BUSINESS CASE'
ORDER BY p.etapa_atual, p.codigo;

-- ============================================================
-- Q06b · Resumo: Projects sem baseline V1 em pacote_fy_itens
-- ============================================================
SELECT
    CASE
        WHEN pfi.valor_incluido IS NOT NULL THEN 'COM baseline em pacote_fy_itens'
        ELSE                                     'SEM baseline em pacote_fy_itens'
    END                         AS situacao,
    COUNT(p.codigo)             AS qtd
FROM projects p
LEFT JOIN pacote_fy_itens pfi
       ON pfi.business_case_codigo = p.business_case_codigo
WHERE p.etapa_atual IS NOT NULL
  AND p.etapa_atual <> 'BUSINESS CASE'
GROUP BY 1
ORDER BY 1;

-- ============================================================
-- Q07 · Confirma triggers append-only em registro_planejamento
-- (produção: verifica se os triggers existem no banco)
-- ============================================================
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'registro_planejamento'
  AND trigger_schema = current_schema()
ORDER BY trigger_name;

-- ============================================================
-- Q08 · codigo_formato — coluna existe em business_cases?
-- (D1: a ser adicionada; esta query confirma o estado atual)
-- ============================================================
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name   = 'business_cases'
  AND column_name  = 'codigo_formato';

-- ============================================================
-- Q09 · FKs que apontam para a view projetos ou tabela projetos
-- (confirma o estado pós-V3: FKs já retargetadas para projects/business_cases)
-- ============================================================
SELECT
    tc.table_name          AS tabela_dependente,
    kcu.column_name        AS coluna_fk,
    ccu.table_name         AS tabela_referenciada
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
     ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
     ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('projetos', 'business_cases', 'projects')
ORDER BY ccu.table_name, tc.table_name;

-- ============================================================
-- Q10 · pacotes_fy — histórico de pacotes fechados
-- ============================================================
SELECT
    pfy.id,
    pfy.ano_fiscal,
    pfy.status,
    pfy.qtd_projetos,
    pfy.valor_total,
    pfy.fechado_por,
    pfy.fechado_em
FROM pacotes_fy pfy
ORDER BY pfy.fechado_em DESC;
