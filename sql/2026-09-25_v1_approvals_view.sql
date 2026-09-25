-- =========================================================================
-- 2026-09-25_v1_approvals_view.sql
-- Compasso 2.0 — V1 do Plano de Evolução ("Compasso 2.0 — Avaliação
-- Cruzada e Plano de Evolução", aba Plano de Evolução): WORK_ITEM e
-- APPROVAL como objetos reais. Fecha WF-03 da Matriz de Gaps
-- ("Validação, Aprovação e Confirmação são objetos/atos distintos" —
-- hoje GAP porque "Minhas Aprovações" é 5 filtros ad-hoc sem objeto
-- unificado).
--
-- Cria v_approvals: VIEW (não tabela) que unifica as 5 fontes de
-- aprovação pendente já usadas em js/aprovacoes/minhas-aprovacoes.js
-- (obterMinhasAprovacoes), com o MESMO critério de "pendente" de cada
-- tela original. Puramente aditivo — nenhuma tabela, trigger ou dado
-- existente é alterado; zero risco às aprovações já em produção porque
-- a decisão continua acontecendo exatamente onde acontecia (comitê.js,
-- orcamento-af.js, tradeoff.js, mudanca-orcamento.js, generic-workflow-ui.js).
-- A view só torna "aprovação pendente" uma pergunta que dá pra fazer
-- direto no banco, em vez de só em memória no front.
--
-- Não inclui filtro de área/atividade do usuário (isso é RBAC de app,
-- não de linha — o Compasso não usa RLS, ver SEGURANCA.md) — quem
-- consome a view aplica filtrarProjetosPorArea()/usuarioTemAtividade()
-- por cima, exatamente como obterMinhasAprovacoes() já fazia.
--
-- Reversível: DROP VIEW v_approvals;
-- =========================================================================

CREATE OR REPLACE VIEW v_approvals AS

-- Comitê — aguardando 1ª decisão (js/approvals/comite.js)
SELECT
    p.codigo        AS projeto_codigo,
    'COMITE'        AS tipo,
    'Aprovar Orçamento por Projeto' AS origem,
    'aprov_comite'  AS tab,
    p.area          AS area,
    NULL::text      AS etapa
FROM projetos p
WHERE p.is_subprojeto IS NOT TRUE
  AND p.etapa_atual = 'BUSINESS CASE'
  AND p.is_adhoc IS NOT TRUE
  AND p.is_carryover IS NOT TRUE
  AND p.sub_status = 'ORÇAMENTO REALIZADO'

UNION ALL

-- Orçamento do Ano Fiscal — comitê já aprovou, falta consolidar no AF
-- (js/approvals/orcamento-af.js)
SELECT
    p.codigo, 'ORCAMENTO_AF', 'Aprovar Orçamento Ano Fiscal', 'aprov_orcamento_af', p.area, NULL
FROM projetos p
WHERE p.is_subprojeto IS NOT TRUE
  AND p.etapa_atual = 'BUSINESS CASE'
  AND p.is_adhoc IS NOT TRUE
  AND p.is_carryover IS NOT TRUE
  AND p.sub_status = 'APROVADO'

UNION ALL

-- Demanda Extraordinária / ad-hoc (js/adhoc/tradeoff.js e afins)
SELECT
    p.codigo, 'ADHOC', 'Aprovar Demanda Extraordinária', 'projetos_adhoc', p.area, NULL
FROM projetos p
WHERE p.is_adhoc IS TRUE
  AND p.etapa_atual = 'BUSINESS CASE'
  AND p.sub_status IN ('ORÇAMENTO REALIZADO', 'APROVADO')
  AND p.is_subprojeto IS NOT TRUE

UNION ALL

-- Mudança de orçamento bloqueada (js/governanca/mudanca-orcamento.js)
SELECT
    p.codigo, 'MUDANCA_ORCAMENTO', 'Aprovar Diferenças de Orçamento', 'mudanca_orcamento', p.area, NULL
FROM projetos p
WHERE p.bloqueado_mudanca_orcamento IS TRUE

UNION ALL

-- Etapas com decisão pendente — Requerimentos TI/Negócio, Especificação
-- Negócio (mesma consulta do KPI "Aprovações Pendentes" da Home e do
-- gate genérico em js/phases/generic-workflow-ui.js). A formatação do
-- rótulo replica exatamente charAt(0)+slice(1).toLowerCase() do JS
-- original (só a 1ª letra da string toda maiúscula, não Title Case).
SELECT
    pe.projeto_codigo,
    'ETAPA_DECISAO',
    upper(left(pe.etapa, 1)) || lower(substring(pe.etapa from 2)) AS origem,
    CASE pe.etapa
        WHEN 'APROVAR REQUERIMENTOS TI'        THEN 'req_aprov_ti'
        WHEN 'APROVAR REQUERIMENTOS NEGÓCIO'   THEN 'req_aprov_negocio'
        WHEN 'AVALIAR ESPECIFICAÇÃO NEGÓCIO'   THEN 'tech_aval_negocio'
    END AS tab,
    p.area,
    pe.etapa
FROM projeto_etapas pe
JOIN projetos p ON p.codigo = pe.projeto_codigo
JOIN fases_etapas fe ON fe.etapa = pe.etapa AND fe.requer_decisao_aprovacao = true
WHERE pe.percentual_evolucao = 100
  AND pe.decisao_resultado IS NULL
  AND pe.etapa IN ('APROVAR REQUERIMENTOS TI', 'APROVAR REQUERIMENTOS NEGÓCIO', 'AVALIAR ESPECIFICAÇÃO NEGÓCIO');

NOTIFY pgrst, 'reload schema';
-- =========================================================================
