-- =========================================================================
-- 2026-09-16_catalogo_pagamentos_pendentes_nf.sql
-- Nova tela "Pagamentos Pendentes de NF" (Contratos e Fornecedores) — a
-- pedido do usuário: lista dedicada de pagamentos aguardando Nota Fiscal,
-- com o alerta de mais de 5 dias úteis e um botão de envio manual da
-- cobrança (js/contratos/pagamentos-pendentes-nf.js).
--
-- Só precisa de UM activity_key novo pra aparecer no menu (o botão
-- "Cobrar" reaproveita a permissão já existente contratos_pendencias:aprovar
-- via _pendPodeAprovar(), sem key própria). Módulo: FINANCEIRO (mesmo de
-- Pendências de Contratos — ver TAB_MODULO_MAP em js/core/licenca.js).
-- Idempotente.
-- =========================================================================

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'CONTRATOS E TERCEIROS', 'Pagamentos Pendentes de NF', 'Consultar e enviar cobrança', 'pagamentos_pendentes_nf:consultar', false, 73
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'pagamentos_pendentes_nf:consultar');

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT grupo, subgrupo, atividade, activity_key, ordem
--   FROM catalogo_atividades WHERE activity_key LIKE 'pagamentos_pendentes_nf:%';
-- =========================================================================
