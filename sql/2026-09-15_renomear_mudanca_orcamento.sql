-- =========================================================================
-- 2026-09-15_renomear_mudanca_orcamento.sql
-- A pedido do usuário: renomeia a tela "Mudança de Orçamento" (menu,
-- catálogo de atividades, textos da UI) para "Aprovar Diferenças de
-- Orçamento" — só o NOME visível muda. O tabId/activity_key
-- (`mudanca_orcamento`), os nomes de tabela/coluna
-- (`log_aprovacao_mudanca_orcamento`, `bloqueado_mudanca_orcamento`,
-- `mudanca_orcamento_aprovado_por/_em/_motivo_aprovacao`) e os nomes de
-- função/arquivo em JS continuam iguais — só o texto exibido no catálogo
-- de atividades (usado nas telas de Funções e Permissões) muda aqui.
-- Idempotente — pode rodar de novo sem efeito colateral.
-- =========================================================================

UPDATE catalogo_atividades
SET atividade = 'Aprovar Diferenças de Orçamento'
WHERE activity_key = 'mudanca_orcamento';

NOTIFY pgrst, 'reload schema';
