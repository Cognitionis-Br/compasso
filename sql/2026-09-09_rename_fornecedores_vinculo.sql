-- =========================================================================
-- 2026-09-09_rename_fornecedores_vinculo.sql   (Release 1)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Renomeações de rótulo (a pedido do usuário). Só TEXTO — activity_key /
-- tabId / tabela física NÃO mudam (grants e código continuam válidos):
--
--   grupo "CONTRATOS E TERCEIROS"          -> "CONTRATOS E FORNECEDORES"
--   subgrupo/atividade "Empresas Terceirizadas" -> "Fornecedores"
--   subgrupo/atividade "Contratos por Projeto(s)" -> "Vincular Projeto e Contrato"
--   ("Contratos Terceirizados" permanece)
--
-- catalogo_atividades está sob RLS — rode DIRETO no SQL Editor (service_role
-- ignora RLS). Idempotente.
-- =========================================================================

UPDATE catalogo_atividades
   SET grupo = 'CONTRATOS E FORNECEDORES'
 WHERE grupo IN ('CONTRATOS E TERCEIROS', 'CONTRATO E TERCEIROS');

UPDATE catalogo_atividades
   SET subgrupo = 'Fornecedores'
 WHERE subgrupo IN ('Empresas Terceirizadas', 'Empresa Terceirizada');

UPDATE catalogo_atividades
   SET atividade = replace(replace(atividade, 'Empresas Terceirizadas', 'Fornecedores'), 'Empresa Terceirizada', 'Fornecedor')
 WHERE atividade ILIKE '%Empresa%Terceiriz%';

UPDATE catalogo_atividades
   SET subgrupo = 'Vincular Projeto e Contrato'
 WHERE subgrupo IN ('Contratos por Projeto', 'Contratos por Projetos');

UPDATE catalogo_atividades
   SET atividade = 'Vincular Projeto e Contrato'
 WHERE activity_key LIKE 'contratos_vinculos%'
   AND atividade IN ('Contratos por Projeto', 'Contratos por Projetos', 'Vincular Contratos');

-- descrição do módulo (só documentação)
UPDATE modulo_funcao
   SET observacao = replace(observacao, 'Contratos e Terceiros', 'Contratos e Fornecedores')
 WHERE observacao ILIKE '%Contratos e Terceiros%';

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT DISTINCT grupo FROM catalogo_atividades WHERE grupo ILIKE '%FORNECEDOR%';
--   SELECT activity_key, subgrupo, atividade FROM catalogo_atividades
--   WHERE activity_key LIKE 'empresas_terceirizadas%' OR activity_key LIKE 'contratos_vinculos%';
-- =========================================================================
