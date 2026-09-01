-- =========================================================================
-- 2026-09-01_reset_carryover_af2026_sem_fase_af2027.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Objetivo: deixar os 7 projetos marcados como Carry Over de volta ao
-- estado "demanda do AF2026, registrada como Carry Over, mas SEM nenhuma
-- fase iniciada no AF corrente (AF2027)", para que possam ser testados
-- do zero.
--
-- MANTÉM (não toca):
--   - ano_fiscal            (continua 'AF2026')
--   - is_carryover = true
--   - valor_carryover
--   - carryover_marcado_por / _em
--   - projeto_benefit_results (dados de objetivo/benefício do BC — igual ao
--     reset padrão da ferramenta de dev, que também não mexe nisso)
--
-- ZERA (mesma definição de "voltar pra Fase 1" da ferramenta de dev
-- js/dev-tools/reset.js — resetPayload), porém preservando os campos de
-- carryover acima:
--   - etapa_atual -> 'BUSINESS CASE', sub_status -> 'A PLANEJAR'
--   - valores / horas / alertas de variação / reprovações / trade-off /
--     validações TI-Negócio / conclusão final / mudança de orçamento
--   - registros de fase e execução no AF corrente (projeto_etapas etc.)
--
-- REALINHA o snapshot de marcação do Carryover
-- (carryover_etapa_marcacao / _sub_status_marcacao) para o estado pós-reset
-- ('BUSINESS CASE' / 'A PLANEJAR'). Sem isso, verificarElegibilidadeDesmarcar
-- (js/carryover/carryover.js) compara o sub_status atual contra um snapshot
-- NULL (esses 7 foram marcados por "AJUSTE DE BASE" antes do snapshot
-- existir) e conclui "já avançou de fase/status" — travando o botão
-- Desmarcar mesmo com o projeto zerado na Fase 1.
--
-- Só 2 dos 7 tinham registro de fase (projeto_etapas): PRJ-FY26-049-RCT e
-- PRJ-FY26-083-PRD. Para os outros 5 o efeito é praticamente nulo — o
-- script é idempotente e pode ser rodado de novo sem problema.
--
-- OBS: tipo_orcamento volta para 'A DEFINIR' (definição de Fase 1). Se
-- quiser manter o CAPEX/OPEX atual, remova a linha `tipo_orcamento` do
-- UPDATE antes de rodar.
--
-- Rode no Supabase → SQL Editor.
-- =========================================================================

DO $$
DECLARE
    v_codigos text[] := ARRAY[
        'PRJ-FY26-079-MKT',
        'PRJ-FY26-080-MKT',
        'PRJ-FY26-049-RCT',
        'PRJ-FY26-078-COL',
        'PRJ-FY26-083-PRD',
        'PRJ-FY26-082-PRD',
        'PRJ-FY26-081-TAC'
    ];
BEGIN
    -- 1) Superfície do projeto: volta para Fase 1 (Business Case, a planejar),
    --    preservando a identidade de Carry Over e o Ano Fiscal de origem.
    UPDATE projetos SET
        etapa_atual   = 'BUSINESS CASE',
        sub_status    = 'A PLANEJAR',
        status        = 'EM ANDAMENTO',
        status_comite = 'PENDENTE',
        tipo_orcamento = 'A DEFINIR',
        val_bc = 0, val_req = 0, val_tech = 0, previsto = 0, realizado = 0,
        horas_bc = 0, horas_req = 0, horas_tech = 0,
        dt_aprovacao = NULL, dt_comite = NULL, aprovador_nome = NULL,
        resp_cancelamento = NULL, dt_cancelamento = NULL, motivo_cancelamento = NULL,
        is_adhoc = false,
        req_alerta_variacao = NULL, req_variacao_percentual = NULL,
        req_concluido_por = NULL, req_concluido_em = NULL,
        tech_alerta_variacao = NULL, tech_variacao_percentual = NULL,
        tech_concluido_por = NULL, tech_concluido_em = NULL,
        req_alerta_variacao_horas = NULL, req_variacao_percentual_horas = NULL,
        tech_alerta_variacao_horas = NULL, tech_variacao_percentual_horas = NULL,
        ultima_reprovacao_por = NULL, ultima_reprovacao_em = NULL, ultima_reprovacao_etapa = NULL,
        qtd_reprovacoes = 0,
        tradeoff_por = NULL, tradeoff_em = NULL, tradeoff_observacao = NULL,
        data_solicitacao_req = NULL, dt_limite_req = NULL,
        dt_envio_av_tec = NULL, dt_limite_av_tec = NULL,
        projeto_concluido = false, data_conclusao_final = NULL,
        observacao_conclusao_final = NULL, concluido_final_por = NULL,
        observacao_comite = NULL, dt_reprovacao = NULL, resp_reprovacao = NULL,
        resp_validacao_ti_nome = NULL, resp_validacao_ti_email = NULL,
        resp_validacao_negocio_nome = NULL, resp_validacao_negocio_email = NULL,
        sub_status_antes_hold = NULL,
        bloqueado_mudanca_orcamento = false,
        mudanca_orcamento_aprovado_por = NULL,
        mudanca_orcamento_aprovado_em = NULL,
        mudanca_orcamento_motivo_aprovacao = NULL,
        -- Snapshot do Carryover realinhado ao estado pós-reset, senão o
        -- botão Desmarcar fica travado (ver cabeçalho).
        carryover_etapa_marcacao = 'BUSINESS CASE',
        carryover_sub_status_marcacao = 'A PLANEJAR'
    WHERE codigo = ANY(v_codigos);

    -- 2) Progresso granular de fase / execução no AF corrente.
    DELETE FROM projeto_etapas               WHERE projeto_codigo      = ANY(v_codigos);
    DELETE FROM adhoc_aprovacoes             WHERE projeto_adhoc_codigo = ANY(v_codigos);
    DELETE FROM log_alteracoes_horas         WHERE projeto_codigo      = ANY(v_codigos);
    DELETE FROM log_retomada_hold            WHERE projeto_codigo      = ANY(v_codigos);
    DELETE FROM log_ratificacao_planejamento WHERE projeto_codigo      = ANY(v_codigos);
    DELETE FROM golive_ocorrencias           WHERE projeto_codigo      = ANY(v_codigos);
    DELETE FROM golive_termo_aceite          WHERE projeto_codigo      = ANY(v_codigos);

    -- Contratos por projeto: pagamentos referenciam o vínculo sem cascade —
    -- apaga os pagamentos antes do vínculo.
    DELETE FROM contratos_pagamentos
        WHERE vinculo_id IN (SELECT id FROM contratos_vinculos_projeto WHERE projeto_codigo = ANY(v_codigos));
    DELETE FROM contratos_vinculos_projeto   WHERE projeto_codigo = ANY(v_codigos);
    DELETE FROM log_alteracao_vinculo_contrato WHERE projeto_codigo = ANY(v_codigos);

    -- Mudança de orçamento e autorizações de ajuste entre subgrupos.
    DELETE FROM log_aprovacao_mudanca_orcamento WHERE projeto_codigo = ANY(v_codigos);
    DELETE FROM ajuste_orcamento_autorizacoes
        WHERE projeto_origem_codigo = ANY(v_codigos)
           OR projeto_destino_codigo = ANY(v_codigos);

    -- Fila de e-mail: e-mails desses projetos (o código fica no JSON contexto).
    DELETE FROM emails_pendentes
        WHERE contexto->>'codigo_projeto' = ANY(v_codigos);
END $$;

NOTIFY pgrst, 'reload schema';
-- =========================================================================
