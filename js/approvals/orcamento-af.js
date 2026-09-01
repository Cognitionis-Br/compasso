// =========================================================================
// approvals/orcamento-af.js
// Aprovação/fechamento global do Orçamento do Ano Fiscal: consolida os
// projetos aprovados no comitê, bloqueia o fechamento se ainda houver
// projetos pendentes de avaliação, e promove os aprovados para a fase
// de Requerimentos.
// =========================================================================
async function renderAprovOrcamentoAFView() {
    // Mesma correção: mostra o AF que está de fato aberto, não o "próximo"
    // calculado cegamente pela data.
    const afAberto = await obterAFAbertoParaDemandas();
    const infoAF = getInfoAnoFiscal();
    const afStr = afAberto || infoAF.proximoAFStr;

    const elAfLabel = document.getElementById('afLabelDisplay');
    if (elAfLabel) elAfLabel.innerText = afAberto ? afStr : `${afStr} (nenhum AF aberto no momento)`;

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário): demandas Extraordinárias
    // não podem entrar na aprovação em lote do AF — elas têm seu próprio
    // fluxo de aprovação (simulação de trade-off, js/adhoc/tradeoff.js).
    // CORRIGIDO 2026-09-01: mesma coisa pra Carryover — tem processo
    // exclusivo (Projetos Carry Over) e o valor já entra pelo pool do AF
    // seguinte, não pela aprovação do AF corrente.
    const projsAprovados = projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        p.sub_status === 'APROVADO' &&
        p.is_adhoc !== true &&
        p.is_carryover !== true
    );

    const valorTotalAF = projsAprovados.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);

    // NOVO 10/08/2026 (itens 3/4/6 do relatório de testes): abre o total
    // em CAPEX/OPEX, além do total geral.
    const valorCapex = projsAprovados.filter(p => (p.tipo_orcamento || '').toUpperCase() === 'CAPEX').reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    const valorOpex = projsAprovados.filter(p => (p.tipo_orcamento || '').toUpperCase() === 'OPEX').reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);

    const elValTotal = document.getElementById('afValTotalDisplay');
    if (elValTotal) elValTotal.innerText = `R$ ${valorTotalAF.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    const elValCapex = document.getElementById('afValCapexDisplay');
    if (elValCapex) elValCapex.innerText = `R$ ${valorCapex.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    const elValOpex = document.getElementById('afValOpexDisplay');
    if (elValOpex) elValOpex.innerText = `R$ ${valorOpex.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    const tbody = document.getElementById('afOrcamentoTableBody');
    if (tbody) {
        if (projsAprovados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em Business Case com status APROVADO para compor o Orçamento ${afStr}</td></tr>`;
            return;
        }

        tbody.innerHTML = projsAprovados.map(p => {
            const qualif = (p.tipo_qualificacao || 'REG').toUpperCase();
            const badgeQualif = qualif === 'GROW' ? 'bg-purple-100 text-purple-800' : qualif === 'RUN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';

            return `
                <tr>
                    <td class="p-3 font-mono font-bold text-green-800">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                    <td class="p-3 font-bold">${p.area || '-'}</td>
                    <td class="p-3 font-bold text-blue-900">${p.tipo_orcamento || 'CAPEX'}</td>
                    <td class="p-3"><span class="text-[10px] px-2 py-0.5 rounded font-bold ${badgeQualif}">${qualif}</span></td>
                    <td class="p-3 font-mono">${p.dt_aprovacao || '<span class="text-gray-400 italic">Não informada</span>'}</td>
                    <td class="p-3 font-mono">${p.dt_comite || '<span class="text-gray-400 italic">Não informada</span>'}</td>
                    <td class="p-3 font-bold uppercase text-gray-700">${escapeHtml(p.aprovador_nome) || '<span class="text-gray-400 italic">Não informado</span>'}</td>
                    <td class="p-3 font-mono font-bold text-right text-green-700">R$ ${(Number(p.val_bc)||Number(p.previsto)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                </tr>
            `;
        }).join('');
    }
}

async function executarAprovacaoGlobalOrcamentoAF() {
    if (!usuarioPodeAlterarTela('aprov_orcamento_af')) return alert('Você não tem permissão para fechar o Orçamento do Ano Fiscal.');
    // CORRIGIDO 10/08/2026 (junto com G11): usa o AF que está de fato
    // aberto para demandas (mesma fonte de verdade do G10), não mais o
    // "próximo AF" calculado cegamente pela data — evita fechar o AF
    // errado quando o AF realmente aberto não coincide com o cálculo.
    const afStr = await obterAFAbertoParaDemandas();
    if (!afStr) {
        return alert('⛔ Nenhum Ano Fiscal está aberto para recebimento de demandas no momento — não há o que fechar.');
    }

    const projetosDoAno = projectsData.filter(p => p.ano_fiscal === afStr || !p.ano_fiscal);
    const pendentes = projetosDoAno.filter(p =>
        (!p.etapa_atual || p.etapa_atual === 'BUSINESS CASE') &&
        p.is_adhoc !== true &&
        p.is_carryover !== true &&
        ['A PLANEJAR', 'PLANEJADO', 'ORÇAMENTO REALIZADO'].includes(p.sub_status)
    );

    if (pendentes.length > 0) {
        alert(`⚠️ O orçamento não pode ser fechado!\n\nAinda existem projetos registrados na fase de Business Case que não foram totalmente avaliados.`);
        return;
    }

    // Mesma exclusão de Extraordinário + Carryover do renderAprovOrcamentoAFView acima.
    const projsAprovados = projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        p.sub_status === 'APROVADO' &&
        p.is_adhoc !== true &&
        p.is_carryover !== true
    );

    if (projsAprovados.length === 0) {
        return alert("Não há projetos qualificados com status 'APROVADO' para fechamento do orçamento!");
    }

    const valorTotalAF = projsAprovados.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    const dtAprovacaoHoje = new Date().toISOString().split('T')[0];

    const mensagemConfirmacao = `CONFIRMAÇÃO DE APROVAÇÃO DO ORÇAMENTO AF:\n\n` +
        `• Projetos Qualificados: ${projsAprovados.length}\n` +
        `• Valor Total do Orçamento Homologado: R$ ${valorTotalAF.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n\n` +
        `Ao confirmar, o orçamento será oficialmente FECHADO e novas demandas comuns serão bloqueadas (permitidas apenas via Extraordinário). Deseja prosseguir?`;

    if (!confirm(mensagemConfirmacao)) return;

    for (const prj of projsAprovados) {
        const diasSlaReq = obterSlaPorNomeEtapa('GERAR REQUERIMENTOS', prj.tamanho);
        const dt_limite_req = somarDiasUteis(dtAprovacaoHoje, diasSlaReq);

        const payloadUpdate = {
            etapa_atual: 'REQUIREMENTS',
            sub_status: 'A PLANEJAR',
            data_solicitacao_req: dtAprovacaoHoje,
            dt_limite_req: dt_limite_req
        };

        let { error } = await _supabase.from('projetos').update(payloadUpdate).eq('codigo', prj.codigo);
        if (error) {
            await _supabase.from('projetos').update({ etapa_atual: 'REQUIREMENTS', sub_status: 'A PLANEJAR' }).eq('codigo', prj.codigo);
        }

        prj.etapa_atual = 'REQUIREMENTS';
        prj.sub_status = 'A PLANEJAR';
        prj.data_solicitacao_req = dtAprovacaoHoje;
        prj.dt_limite_req = dt_limite_req;

        // NOVO (item 1, novos ajustes): disparo de e-mail — ponto 5
        // ("Após aprovar orçamento Fiscal Year"), um por projeto
        // promovido no fechamento em lote.
        await dispararEmailFluxo('BUSINESS CASE', 'APROVAR ORÇAMENTO ANO FISCAL', 'Após aprovar orçamento Fiscal Year', prj, {});
    }

    alert(`✅ Orçamento do Ano Fiscal APROVADO e FECHADO com sucesso!\n\n${projsAprovados.length} projetos promovidos para a fase de REQUERIMENTOS.`);

    // CORRIGIDO 10/08/2026 (G11): loga formalmente o fechamento do
    // orçamento do AF — quem fechou, quando, valor total e quantidade de
    // projetos — mesmo padrão de log já usado na abertura do próximo AF
    // (js/config/ano-fiscal.js).
    //
    // CORRIGIDO DE NOVO (bug reportado pelo usuário): fechar o orçamento
    // marcava orcamento_fechado=true, mas NUNCA desligava
    // recebimento_demandas_aberto — o AF continuava aparecendo como
    // "aberto pra demandas normais" em Formalizar Demanda, deixando
    // passar demandas comuns sem exigir o fluxo de Extraordinária.
    const { error: errorLogFechamento } = await _supabase.from('anos_fiscais_config').upsert({
        ano_fiscal: afStr,
        orcamento_fechado: true,
        recebimento_demandas_aberto: false,
        fechado_por: currentUser ? currentUser.nome : 'desconhecido',
        fechado_em: new Date().toISOString(),
        valor_total_fechado: valorTotalAF,
        qtd_projetos_fechado: projsAprovados.length
    }, { onConflict: 'ano_fiscal' });
    if (errorLogFechamento) console.error('Erro ao logar fechamento do AF:', errorLogFechamento.message);

    await loadProjects();
    switchTab('req_planejamento');
}
