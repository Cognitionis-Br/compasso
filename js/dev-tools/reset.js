// =========================================================================
// dev-tools/reset.js
// FERRAMENTA DE DESENVOLVIMENTO — reseta todos os projetos cadastrados de
// volta para a Fase 1 (Business Case), como demanda apenas incluída,
// antes de qualquer orçamento ou aprovação. Não apaga os projetos, apenas
// zera o progresso de workflow deles. Grava direto no Supabase (não é um
// reset só local).
//
// CORRIGIDO 10/08/2026 (bug reportado pelo usuário): esta ferramenta foi
// escrita bem no início do projeto e nunca foi atualizada — não limpava
// is_adhoc, os alertas de variação (req/tech_alerta_variacao), carryover,
// histórico de reprovação, nem dados de trade-off. Isso deixava "fantasmas"
// em várias telas depois do reset: Dashboard mostrando total Extraordinário que
// não devia mais existir, Alertas de Orçamento mostrando projeto que já
// tinha sido resetado. Também nunca limpava projeto_etapas — o progresso
// granular (planejamento, % evolução, decisões, contratos) continuava lá
// mesmo com o projeto "resetado" pra fase 1. Agora limpa tudo.
//
// ATENÇÃO: sem controle de acesso ainda — qualquer usuário logado pode
// executar. Isso será restringido quando implementarmos autenticação/RBAC
// (ver Auditoria_Tecnica.md, item 2). Até lá, esta ferramenta não
// deveria ser usada em produção — apenas em ambiente de desenvolvimento.
// =========================================================================
// CORRIGIDO (novamente — a pedido do usuário, antes de um novo reset de
// teste geral): faltavam limpar os campos adicionados desde a última
// atualização — conclusão final de projeto, dados de reprovação do
// Comitê, responsáveis de validação TI/Negócio, e sobretudo os
// SUBPROJETOS, que agora são apagados por completo (não fazem sentido
// "voltar pra fase 1" — nasceram direto em Execution, então voltam a
// não existir, exatamente como antes de terem sido criados).
async function resetarBaseParaFase1() {
    // Checagem client-side (UX apenas — ver nota no topo de js/config/funcoes.js).
    // Restrito a ADMINISTRADOR por ser uma ação destrutiva.
    if (!ehAdministrador) {
        return alert('⛔ Esta ferramenta é restrita a usuários com a função ADMINISTRADOR.');
    }

    if (!projectsData || projectsData.length === 0) {
        alert('Nenhum projeto cadastrado para resetar.');
        return;
    }

    const subprojetos = projectsData.filter(p => p.is_subprojeto === true);
    const principais = projectsData.filter(p => p.is_subprojeto !== true);

    const confirmacao = confirm(
        `⚠️ FERRAMENTA DE DESENVOLVIMENTO\n\n` +
        `Isso vai resetar TODOS os ${principais.length} projeto(s) principais cadastrados de volta para a Fase 1 (Business Case), ` +
        `como demandas incluídas — antes de orçamento, comitê ou aprovação.\n\n` +
        `${subprojetos.length > 0 ? `Os ${subprojetos.length} SUBPROJETO(S) existentes serão APAGADOS por completo (não fazem sentido "voltar pra fase 1" — nascem direto em Execution).\n\n` : ''}` +
        `Serão apagados: orçamento e horas (BC/Req/Tech), status de comitê, datas e nome de aprovador, dados de cancelamento, ` +
        `marcação Extraordinário, alertas de variação (orçamento e horas), carryover, histórico de reprovação (Requerimentos e Comitê), ` +
        `dados de trade-off (incluindo histórico de cessão de horas e de retomada de Hold), conclusão final, responsáveis de validação TI/Negócio, ` +
        `e TODO o progresso granular de etapas (planejamento, % evolução, decisões, contratos). A fila de e-mail também é limpa.\n` +
        `Serão mantidos: código, nome, área, solicitante, tamanho, ano fiscal e qualificação da demanda.\n\n` +
        `Esta ação grava direto no banco de dados (Supabase) e NÃO pode ser desfeita.\n\n` +
        `Deseja continuar?`
    );
    if (!confirmacao) return;

    // Apaga subprojetos primeiro — a lista de "códigos" usada daqui pra
    // frente é só dos projetos principais.
    if (subprojetos.length > 0) {
        const codigosSub = subprojetos.map(p => p.codigo);

        // NOVO (Objetivo/Key Results/Benefit Results): projeto_benefit_results
        // referencia projeto_codigo sem ON DELETE CASCADE — precisa limpar
        // ANTES de apagar o subprojeto, senão o delete abaixo falha por
        // violação de chave estrangeira (mesma exigência de
        // js/dev-tools/limpeza-base.js).
        const { error: errorBeneficiosSub } = await _supabase.from('projeto_benefit_results').delete().in('projeto_codigo', codigosSub);
        if (errorBeneficiosSub) console.error('Erro ao limpar benefit results dos subprojetos:', errorBeneficiosSub.message);

        const { error: errorSub } = await _supabase.from('projetos').delete().in('codigo', codigosSub);
        if (errorSub) {
            alert('❌ Erro ao apagar os subprojetos: ' + errorSub.message);
            return;
        }
        const { error: errorEtapasSub } = await _supabase.from('projeto_etapas').delete().in('projeto_codigo', codigosSub);
        if (errorEtapasSub) console.error('Erro ao limpar etapas dos subprojetos:', errorEtapasSub.message);
    }

    const codigos = principais.map(p => p.codigo);

    const resetPayload = {
        etapa_atual: 'BUSINESS CASE',
        sub_status: 'A PLANEJAR',
        status: 'EM ANDAMENTO',
        status_comite: 'PENDENTE',
        tipo_orcamento: 'A DEFINIR',
        val_bc: 0,
        val_req: 0,
        val_tech: 0,
        previsto: 0,
        realizado: 0,
        dt_aprovacao: null,
        dt_comite: null,
        aprovador_nome: null,
        resp_cancelamento: null,
        dt_cancelamento: null,
        motivo_cancelamento: null,
        is_adhoc: false,
        is_carryover: false,
        valor_carryover: null,
        carryover_marcado_por: null,
        carryover_marcado_em: null,
        carryover_etapa_marcacao: null,
        carryover_sub_status_marcacao: null,
        req_alerta_variacao: null,
        req_variacao_percentual: null,
        req_concluido_por: null,
        req_concluido_em: null,
        tech_alerta_variacao: null,
        tech_variacao_percentual: null,
        tech_concluido_por: null,
        tech_concluido_em: null,
        ultima_reprovacao_por: null,
        ultima_reprovacao_em: null,
        ultima_reprovacao_etapa: null,
        qtd_reprovacoes: 0,
        tradeoff_por: null,
        tradeoff_em: null,
        tradeoff_observacao: null,
        data_solicitacao_req: null,
        dt_limite_req: null,
        dt_envio_av_tec: null,
        dt_limite_av_tec: null,
        // NOVOS (desde o último ajuste desta ferramenta):
        projeto_concluido: false,
        data_conclusao_final: null,
        observacao_conclusao_final: null,
        concluido_final_por: null,
        observacao_comite: null,
        dt_reprovacao: null,
        resp_reprovacao: null,
        resp_validacao_ti_nome: null,
        resp_validacao_ti_email: null,
        resp_validacao_negocio_nome: null,
        resp_validacao_negocio_email: null,
        // NOVOS (a pedido do usuário 24/08/2026 — Porte por Horas e
        // cessão parcial de trade-off): mesmo tratamento dos campos de
        // valor equivalentes (val_bc/req/tech zerados, alertas de
        // variação e dados de trade-off nulos).
        horas_bc: 0,
        horas_req: 0,
        horas_tech: 0,
        req_alerta_variacao_horas: null,
        req_variacao_percentual_horas: null,
        tech_alerta_variacao_horas: null,
        tech_variacao_percentual_horas: null,
        sub_status_antes_hold: null,
        // NOVO (Mudança de Orçamento, 27/08/2026)
        bloqueado_mudanca_orcamento: false,
        mudanca_orcamento_aprovado_por: null,
        mudanca_orcamento_aprovado_em: null,
        mudanca_orcamento_motivo_aprovacao: null
    };

    const { error } = await _supabase.from('projetos').update(resetPayload).in('codigo', codigos);

    if (error) {
        alert(
            '❌ Erro ao resetar a base no Supabase: ' + error.message +
            '\n\nSe o erro mencionar uma coluna inexistente, o schema da tabela "projetos" ' +
            'precisa ganhar essa coluna antes do reset funcionar.'
        );
        return;
    }

    const { error: errorEtapas } = await _supabase.from('projeto_etapas').delete().in('projeto_codigo', codigos);
    if (errorEtapas) {
        console.error('Reset dos projetos concluído, mas houve erro ao limpar projeto_etapas:', errorEtapas.message);
    }

    const { error: errorAdhoc } = await _supabase.from('adhoc_aprovacoes').delete().in('projeto_adhoc_codigo', codigos);
    if (errorAdhoc) {
        console.error('Reset concluído, mas houve erro ao limpar adhoc_aprovacoes:', errorAdhoc.message);
    }

    // NOVOS (a pedido do usuário 24/08/2026): logs dedicados criados
    // junto com Porte por Horas (cessão parcial) e a tela de Retomar
    // Projetos em Hold — mesmo tratamento de adhoc_aprovacoes acima.
    const { error: errorLogHoras } = await _supabase.from('log_alteracoes_horas').delete().in('projeto_codigo', codigos);
    if (errorLogHoras) {
        console.error('Reset concluído, mas houve erro ao limpar log_alteracoes_horas:', errorLogHoras.message);
    }
    const { error: errorLogHold } = await _supabase.from('log_retomada_hold').delete().in('projeto_codigo', codigos);
    if (errorLogHold) {
        console.error('Reset concluído, mas houve erro ao limpar log_retomada_hold:', errorLogHold.message);
    }
    // NOVO (a pedido do usuário 25/08/2026): voltar pra fase 1 apaga
    // também o histórico de Ratificação/Retificação de UAT/Go-Live — o
    // projeto vai reviver essas fases do zero.
    const { error: errorLogRatif } = await _supabase.from('log_ratificacao_planejamento').delete().in('projeto_codigo', codigos);
    if (errorLogRatif) {
        console.error('Reset concluído, mas houve erro ao limpar log_ratificacao_planejamento:', errorLogRatif.message);
    }
    // NOVOS (a pedido do usuário 25/08/2026): voltar pra fase 1 apaga
    // também as Ocorrências de Erro e o Termo de Aceite de Go-Live — o
    // projeto vai reviver essa fase do zero.
    const { error: errorGoliveOcorrencias } = await _supabase.from('golive_ocorrencias').delete().in('projeto_codigo', codigos);
    if (errorGoliveOcorrencias) {
        console.error('Reset concluído, mas houve erro ao limpar golive_ocorrencias:', errorGoliveOcorrencias.message);
    }
    const { error: errorGoliveTermo } = await _supabase.from('golive_termo_aceite').delete().in('projeto_codigo', codigos);
    if (errorGoliveTermo) {
        console.error('Reset concluído, mas houve erro ao limpar golive_termo_aceite:', errorGoliveTermo.message);
    }
    // NOVOS (a pedido do usuário 25/08/2026 — Fase 3): vínculos de
    // Contrato por Projeto e o log de alterações deles. NOVO (Fase 4):
    // apaga os pagamentos do vínculo antes do vínculo em si (vinculo_id
    // sem cascade).
    const { data: vinculosParaApagarReset } = await _supabase.from('contratos_vinculos_projeto').select('id').in('projeto_codigo', codigos);
    const idsVinculosParaApagarReset = (vinculosParaApagarReset || []).map(v => v.id);
    if (idsVinculosParaApagarReset.length > 0) {
        const { error: errorPagamentosVinculoReset } = await _supabase.from('contratos_pagamentos').delete().in('vinculo_id', idsVinculosParaApagarReset);
        if (errorPagamentosVinculoReset) {
            console.error('Reset concluído, mas houve erro ao limpar contratos_pagamentos (por vínculo):', errorPagamentosVinculoReset.message);
        }
    }
    const { error: errorVinculosContrato } = await _supabase.from('contratos_vinculos_projeto').delete().in('projeto_codigo', codigos);
    if (errorVinculosContrato) {
        console.error('Reset concluído, mas houve erro ao limpar contratos_vinculos_projeto:', errorVinculosContrato.message);
    }
    const { error: errorLogVinculos } = await _supabase.from('log_alteracao_vinculo_contrato').delete().in('projeto_codigo', codigos);
    if (errorLogVinculos) {
        console.error('Reset concluído, mas houve erro ao limpar log_alteracao_vinculo_contrato:', errorLogVinculos.message);
    }
    // NOVO (Mudança de Orçamento, 27/08/2026)
    const { error: errorLogMudancaOrcamento } = await _supabase.from('log_aprovacao_mudanca_orcamento').delete().in('projeto_codigo', codigos);
    if (errorLogMudancaOrcamento) {
        console.error('Reset concluído, mas houve erro ao limpar log_aprovacao_mudanca_orcamento:', errorLogMudancaOrcamento.message);
    }

    // NOVO: limpa a fila de e-mail também — sem isso, o teste geral
    // começaria com e-mails "fantasma" de projetos que já não existem
    // mais do jeito que existiam.
    const { error: errorEmails } = await _supabase.from('emails_pendentes').delete().neq('id', 0);
    if (errorEmails) {
        console.error('Reset concluído, mas houve erro ao limpar a fila de e-mail:', errorEmails.message);
    }

    // NOVO (bug reportado pelo usuário: Extraordinário sendo aceito mesmo com o
    // AF "aberto"): a ferramenta nunca tocava em anos_fiscais_config —
    // se o orçamento tinha sido fechado num teste anterior, ficava
    // fechado depois do reset, permitindo Extraordinário mesmo quando o usuário
    // esperava um AF limpo e aberto pra demandas normais.
    const infoAFReset = getInfoAnoFiscal();
    const { error: errorAF } = await _supabase.from('anos_fiscais_config').update({ orcamento_fechado: false }).eq('ano_fiscal', infoAFReset.afAtualStr);
    if (errorAF) {
        console.error('Reset concluído, mas houve erro ao reabrir o orçamento do AF:', errorAF.message);
    }

    alert(`✅ ${codigos.length} projeto(s) principais resetado(s) para a Fase 1${subprojetos.length > 0 ? `, e ${subprojetos.length} subprojeto(s) apagado(s)` : ''} — incluindo progresso de etapas, fila de e-mail, reabertura do orçamento do AF, e todos os campos adicionados até agora.`);
    await loadProjects();
    switchTab('f1_formalizacao');
}
