-- =========================================================================
-- 2026-08-31_padronizacao_nomenclatura_catalogo.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Padronização de nomenclatura de telas/menus (de-para fornecido pelo
-- usuário). SÓ texto visível — colunas grupo_funcao / funcao / atividade
-- de catalogo_atividades, que alimentam o agrupamento das telas de
-- "Funções e Permissões" e "Restrição de Área por Atividade".
--
-- NÃO altera activity_key, nem projetos.etapa_atual, nem fases_etapas.fase,
-- nem os gatilhos de email_fluxo. Os identificadores internos de fase
-- (BUSINESS CASE / REQUIREMENTS / TECHNICAL / EXECUTION) ficam intactos.
--
-- Idempotente (WHERE pelo valor antigo; rodar de novo = 0 linhas).
-- Supabase → SQL Editor (projeto fytynjjvzecljmgbtwec).
-- =========================================================================

-- ---- grupo_funcao ----
UPDATE catalogo_atividades SET grupo_funcao = 'ANO FISCAL'                WHERE grupo_funcao = 'FISCAL YEAR';
UPDATE catalogo_atividades SET grupo_funcao = 'REQUERIMENTOS'            WHERE grupo_funcao = 'REQUERIMENTS';
UPDATE catalogo_atividades SET grupo_funcao = 'ESPECIFICAÇÃO'           WHERE grupo_funcao = 'TECNICAL';
UPDATE catalogo_atividades SET grupo_funcao = 'EXECUÇÃO - DESENVOLVIMENTO' WHERE grupo_funcao = 'EXECUTION';
UPDATE catalogo_atividades SET grupo_funcao = 'CONSULTA DE PROJETOS'      WHERE grupo_funcao = 'CONSULTAS';

-- ---- funcao (nome do item de menu / sub-bloco) ----
UPDATE catalogo_atividades SET funcao = 'Abertura Ano Fiscal'                       WHERE funcao = 'Abertura Fiscal Year';
UPDATE catalogo_atividades SET funcao = 'Gerar Requerimentos'                       WHERE funcao = 'Gerar Requeriments';
UPDATE catalogo_atividades SET funcao = 'Concluir Etapa de Requerimentos'           WHERE funcao = 'Concluir Etapa de Requeriments';
UPDATE catalogo_atividades SET funcao = 'Concluir Etapa de Especificação'           WHERE funcao = 'Concluir Etapa Tecnical';
UPDATE catalogo_atividades SET funcao = 'Execução - Desenvolvimento'                WHERE funcao = 'Execution';
UPDATE catalogo_atividades SET funcao = 'Aprovar Orçamento Ano Fiscal'              WHERE funcao = 'Aprovar Orçamento Fiscal Year';
UPDATE catalogo_atividades SET funcao = 'Envio de E-mail - Gestão de Templates'     WHERE funcao = 'Gestão de Templates';
UPDATE catalogo_atividades SET funcao = 'Envio de E-mail - Gestão do Fluxo'         WHERE funcao = 'Gestão do Fluxo de E-mail';
UPDATE catalogo_atividades SET funcao = 'Envio de E-mail - Gestão de Fila de Envio' WHERE funcao = 'Fila de E-mail';
UPDATE catalogo_atividades SET funcao = 'Retorno / Benefícios de Projeto'           WHERE funcao = 'Return / Benefit';
UPDATE catalogo_atividades SET funcao = 'Tipos de Projeto'                          WHERE funcao = 'Tipos de Projetos';
UPDATE catalogo_atividades SET funcao = 'Consulta de Projetos'                      WHERE funcao = 'Consultas';

-- ---- atividade (rótulo do checkbox / sub-aba), por activity_key ----
UPDATE catalogo_atividades SET atividade = 'Aprovar Orçamento Ano Fiscal'                  WHERE activity_key = 'aprov_orcamento_af';

UPDATE catalogo_atividades SET atividade = 'Planejar Orçamentação'                          WHERE activity_key = 'f1_orcamento:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Orçamentação'                          WHERE activity_key = 'f1_orcamento:em_andamento';
UPDATE catalogo_atividades SET atividade = 'Orçamentação Concluída'                         WHERE activity_key = 'f1_orcamento:concluidas';

UPDATE catalogo_atividades SET atividade = 'Planejar Requerimentos'                         WHERE activity_key = 'req_planejamento:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Requerimentos'                         WHERE activity_key = 'req_planejamento:em_andamento';
UPDATE catalogo_atividades SET atividade = 'Requerimentos Concluídos'                       WHERE activity_key = 'req_planejamento:concluidas';
UPDATE catalogo_atividades SET atividade = 'Concluir Etapa de Requerimentos'                WHERE activity_key = 'req_conclusao';
UPDATE catalogo_atividades SET atividade = 'Planejar Avaliação de Requerimentos - Negócios' WHERE activity_key = 'req_aprov_negocio:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Avaliação de Requerimentos - Negócios' WHERE activity_key = 'req_aprov_negocio:execucao';
UPDATE catalogo_atividades SET atividade = 'Planejar Avaliação de Requerimentos - TI'       WHERE activity_key = 'req_aprov_ti:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Avaliação de Requerimentos - TI'       WHERE activity_key = 'req_aprov_ti:execucao';

UPDATE catalogo_atividades SET atividade = 'Planejar Especificação'                         WHERE activity_key = 'fase_technical:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Especificação'                         WHERE activity_key = 'fase_technical:execucao';
UPDATE catalogo_atividades SET atividade = 'Planejar Especificação - Negócios'              WHERE activity_key = 'tech_aval_negocio:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Especificação - Negócios'              WHERE activity_key = 'tech_aval_negocio:execucao';
UPDATE catalogo_atividades SET atividade = 'Concluir Etapa de Especificação'                WHERE activity_key = 'tech_conclusao';

UPDATE catalogo_atividades SET atividade = 'Planejar Execução - Desenvolvimento'            WHERE activity_key = 'fase_execution:a_planejar';
UPDATE catalogo_atividades SET atividade = 'Executar Desenvolvimento'                       WHERE activity_key = 'fase_execution:em_andamento';
UPDATE catalogo_atividades SET atividade = 'Gerir Subprojetos'                              WHERE activity_key = 'fase_execution:subprojetos';
UPDATE catalogo_atividades SET atividade = 'Executar UAT'                                   WHERE activity_key = 'fase_uat:em_andamento';
UPDATE catalogo_atividades SET atividade = 'Executar Go-Live'                               WHERE activity_key = 'fase_golive:em_andamento';

UPDATE catalogo_atividades SET atividade = 'Consulta de Projetos'                           WHERE activity_key = 'consultas';

-- ---- atividade: telas de Parâmetros e Cadastros (alinha com os botões) ----
UPDATE catalogo_atividades SET atividade = 'Cadastrar Áreas Solicitantes'                   WHERE activity_key = 'areas:criar';
UPDATE catalogo_atividades SET atividade = 'Áreas Solicitantes Cadastradas'                 WHERE activity_key = 'areas:cadastrados';
UPDATE catalogo_atividades SET atividade = 'Cadastrar Porte de Projeto'                     WHERE activity_key = 'portes:criar';
UPDATE catalogo_atividades SET atividade = 'Portes de Projeto Cadastrados'                  WHERE activity_key = 'portes:cadastrados';
UPDATE catalogo_atividades SET atividade = 'Cadastrar Cargos'                               WHERE activity_key = 'cargos:criar';
UPDATE catalogo_atividades SET atividade = 'Cadastrar Retorno / Benefício de Projeto'       WHERE activity_key = 'return_benefit:criar';
UPDATE catalogo_atividades SET atividade = 'Retornos / Benefícios de Projeto Cadastrados'   WHERE activity_key = 'return_benefit:cadastrados';

NOTIFY pgrst, 'reload schema';

-- Conferência (opcional):
--   SELECT ordem, grupo_funcao, funcao, atividade, activity_key
--   FROM catalogo_atividades ORDER BY ordem, id;
-- =========================================================================
