-- =========================================================================
-- 2026-09-08_modulo_funcao_bc_para_workflow.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- A pedido do usuário: no Licenciamento de Módulos, inativar "Financeiro &
-- Contratos" escondia as etapas de APROVAÇÃO do Business Case e a trava de
-- variação de orçamento — deixando o projeto sem como ser aprovado pelo
-- Comitê nem ter o orçamento do Ano Fiscal fechado. Esses passos são do
-- WORKFLOW desenhado, não do módulo financeiro.
--
-- Move de FINANCEIRO -> WORKFLOW no modulo_funcao (fonte de verdade em
-- runtime; o TAB_MODULO_MAP hardcoded de js/core/licenca.js já foi
-- alinhado):
--   aprov_comite                   Aprovar Orçamento por Projeto (Comitê)
--   aprov_orcamento_af             Aprovar Orçamento Ano Fiscal (fechamento)
--   mudanca_orcamento              Mudança de Orçamento (libera projeto travado)
--   percentual_bloqueio_orcamento  Parâmetro da trava de variação
--
-- Ficam em FINANCEIRO: contratos/terceiros, Visão de Orçamento, Alertas,
-- Ajuste de Orçamento, Controle Orçamentário, Validação de Trade-off,
-- Aprovar Demanda Extraordinária.
--
-- Idempotente. Supabase → SQL Editor. (Alternativa equivalente: re-rodar
-- sql/2026-09-03_modulo_funcao.sql, que agora já traz esses 4 em WORKFLOW.)
-- =========================================================================

UPDATE modulo_funcao
   SET modulo = 'WORKFLOW', atualizado_em = now()
 WHERE activity_key IN (
   'aprov_comite',
   'aprov_orcamento_af',
   'mudanca_orcamento',
   'percentual_bloqueio_orcamento'
 );

-- garante as linhas caso a base não tenha o seed completo
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
  ('aprov_comite',                 'WORKFLOW', 'LICENCIAVEL', 'Aprovar Orçamento por Projeto — Comitê'),
  ('aprov_orcamento_af',           'WORKFLOW', 'LICENCIAVEL', 'Aprovar Orçamento Ano Fiscal — fechamento'),
  ('mudanca_orcamento',            'WORKFLOW', 'LICENCIAVEL', 'Libera projeto travado por variação de orçamento'),
  ('percentual_bloqueio_orcamento','WORKFLOW', 'LICENCIAVEL', 'Parâmetro da trava de variação de orçamento')
ON CONFLICT (activity_key) DO UPDATE
  SET modulo = EXCLUDED.modulo, tipo = EXCLUDED.tipo,
      observacao = EXCLUDED.observacao, atualizado_em = now();

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT activity_key, modulo FROM modulo_funcao
--   WHERE activity_key IN ('aprov_comite','aprov_orcamento_af','mudanca_orcamento','percentual_bloqueio_orcamento');
-- =========================================================================
