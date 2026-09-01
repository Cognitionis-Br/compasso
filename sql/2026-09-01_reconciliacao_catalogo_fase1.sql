-- =========================================================================
-- 2026-09-01_reconciliacao_catalogo_fase1.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- FASE 1 do endurecimento de RBAC/RLS (ver SEGURANCA.md). Aplica a
-- reconciliação aprovada de catalogo_atividades com
-- docs/CONTROLE DE ACESSO - FUNÇÕES.xlsx (ver RECONCILIACAO_CATALOGO.md).
--
-- NÃO remove nem renomeia nenhuma linha que quebre concessões — só
-- UPDATE de texto (funcao_atividades aponta por id, não por texto) e o
-- RENAME das 2 colunas de hierarquia. ZERO DELETE. ZERO INSERT.
--
-- Decisões incorporadas (RECONCILIACAO_CATALOGO.md §4):
--   1. Colunas: Opção A — grupo_funcao -> grupo, funcao -> subgrupo.
--   2. Conflitos C1–C8: MANTIDO o que já estava aplicado (planilha
--      desatualizada nesses pontos) — nenhum statement aqui.
--   3. Renomes: R1, R2, R7, R8 aplicados. R3/R4 aplicados após correção da
--      planilha pelo usuário (2026-09-01): subgrupo de "usuarios" é
--      "Usuários" (não "Cadastrar Novo Usuário"). R5/R6 não aplicados:
--      telas saem do catálogo comum na Fase 3.
--   4. Menores: M1, M2, M4 aplicados. M3 é tela da Fase 3. M5 (grafia
--      "Golive") não aplicado — mantém "Go-Live".
--   5. Grupos: G1, G2, G3 aplicados (só a diferença substantiva; grupo
--      segue MAIÚSCULO como o resto). G4 não aplicado: item sai na Fase 3.
--   6. Casing: grupo em MAIÚSCULO, subgrupo/atividade em Title Case — como já está.
--   §3 (órfãos): mudanca_orcamento, percentual_bloqueio_orcamento e
--      responsaveis:criar MANTIDOS. Nada removido.
--
-- Idempotente (RENAME condicional; UPDATE por valor antigo / activity_key).
-- Supabase -> SQL Editor.
-- =========================================================================

-- ---- 1. Colunas explícitas grupo / subgrupo (renomeia grupo_funcao / funcao) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'catalogo_atividades' AND column_name = 'grupo_funcao') THEN
    ALTER TABLE catalogo_atividades RENAME COLUMN grupo_funcao TO grupo;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'catalogo_atividades' AND column_name = 'funcao') THEN
    ALTER TABLE catalogo_atividades RENAME COLUMN funcao TO subgrupo;
  END IF;
END $$;

-- ---- 2. Renomes de ATIVIDADE (por activity_key) ----
-- R1
UPDATE catalogo_atividades SET atividade = 'Vincular Contratos',
       subgrupo = 'Contratos por Projetos'
 WHERE activity_key = 'contratos_vinculos';
-- R2
UPDATE catalogo_atividades SET atividade = 'Registrar Pagamento'
 WHERE activity_key = 'registro_valores_contrato';
-- R7
UPDATE catalogo_atividades SET atividade = 'Atribuições Cadastradas'
 WHERE activity_key = 'responsaveis:cadastrados';
-- R8
UPDATE catalogo_atividades SET atividade = 'Termo de Aceite'
 WHERE activity_key = 'fase_golive:termo_aceite';
-- M1
UPDATE catalogo_atividades SET atividade = 'Cadastrar Nova Empresa'
 WHERE activity_key = 'empresas_terceirizadas:criar';
-- M2
UPDATE catalogo_atividades SET atividade = 'Novo Contrato'
 WHERE activity_key = 'contratos_projeto:criar';
-- M4
UPDATE catalogo_atividades SET atividade = 'Incluir Template'
 WHERE activity_key = 'gestao_templates:incluir';
-- R3 / R4 (planilha corrigida 2026-09-01: subgrupo = "Usuários")
UPDATE catalogo_atividades SET subgrupo = 'Usuários'
 WHERE activity_key IN ('usuarios:criar', 'usuarios:cadastrados');
UPDATE catalogo_atividades SET atividade = 'Cadastrar Novo Usuário'
 WHERE activity_key = 'usuarios:criar';

-- ---- 3. Renomes de GRUPO (só a diferença substantiva; segue MAIÚSCULO) ----
-- G1
UPDATE catalogo_atividades SET grupo = 'CONTRATOS E TERCEIROS' WHERE grupo = 'CONTRATO E TERCEIROS';
-- G2
UPDATE catalogo_atividades SET grupo = 'PARÂMETROS E CADASTROS' WHERE grupo = 'PARÂMETROS E CADASTRO';
-- G3
UPDATE catalogo_atividades SET grupo = 'FERRAMENTAS DEV' WHERE grupo = 'FERRAMENTAS DO DEV';
UPDATE catalogo_atividades SET subgrupo = 'Ferramentas Dev' WHERE subgrupo = 'Ferramentas do Dev';
UPDATE catalogo_atividades SET atividade = 'Ferramentas Dev' WHERE activity_key = 'dev_tools';

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT ordem, grupo, subgrupo, atividade, activity_key
--   FROM catalogo_atividades ORDER BY ordem, id;
-- =========================================================================
