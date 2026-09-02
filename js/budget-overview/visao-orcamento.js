// =========================================================================
// budget-overview/visao-orcamento.js
// Visão consolidada de orçamento por projeto: compara valor do Business
// Case com Requerimentos/Technical e aplica o semáforo de variação
// (verde <10%, amarelo 10–20%, vermelho >20%).
//
// NOTA: este semáforo de variação (10%/20%) é um cálculo de exibição
// diferente da "Trava de Tolerância de +10%" do Gate 3 mencionada na
// Auditoria_Tecnica.md (item da seção 5) — aqui é só informativo,
// não bloqueia nada. A trava de bloqueio de verdade continua no gap
// registrado na auditoria, ainda não implementada.
// =========================================================================
async function renderVisaoOrcamentoView() {
    const tbody = document.getElementById('visaoOrcamentoTableBody');
    if (!tbody) return;

    // AJUSTADO (a pedido do usuário): troca o filtro fixo de AF corrente
    // pelo seletor compartilhado (corrente/próximo/todos) — antes essa
    // tela sempre olhava só pro AF corrente e ignorava Carryover com
    // ano_fiscal diferente, mesmo modo antigo do bug já corrigido no
    // Dashboard e Roadmap.
    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista();
    if (typeof montarSeletorAF === 'function') modoAFVisaoOrcamento = montarSeletorAF('visaoOrcSeletorAF', modoAFVisaoOrcamento);
    renderFaixaAFSelecionado('visaoOrcFaixaAFSelecionado', modoAFVisaoOrcamento);
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    // NOVO (Agrupamento de Orçamento — item 5): 3º elo — agrupamento AF/Área/Produto.
    const baseAF = filtrarProjetosPorAgrupamento(
        filtrarProjetosPorArea(filtrarProjetosPorAnoFiscalSelecionado(projectsData, modoAFVisaoOrcamento), 'visao_orcamento'),
        modoAgrupamentoOrcamento, valorAgrupamentoSelecionado);
    renderSeletorAgrupamento('visaoSeletorAgrupamento', 'renderVisaoOrcamentoView');
    renderQuadroOrcamentoAgrupado('visao', baseAF);

    // CORRIGIDO 10/08/2026 (bug reportado): a lista usada pros KPIs e pro
    // CAPEX/OPEX era diferente da lista usada na tabela — o quadro de
    // valores contava projeto reprovado, Extraordinário ainda não aprovado, etc.
    // Agora usa a MESMA regra de elegibilidade em tudo: só quem já teve
    // orçamento aprovado (mesma lista de "projetosVisiveis" da tabela).
    const projsAF = baseAF.filter(p => {
        if (p.is_adhoc === true) return false;
        // NOVO (item 2 — subprojetos/conclusão): subprojeto não tem
        // orçamento próprio aprovado (herda do pai) — não entra no
        // orçamento por conta própria. Concluído sai de telas ativas.
        if (p.is_subprojeto === true) return false;
        if (p.projeto_concluido === true) return false;
        const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'CANCELADO' || sub === 'REPROVADO' || sub === 'HOLD') return false;
        if (etapa === 'BUSINESS CASE' && sub !== 'APROVADO') return false;
        return true;
    });

    const totOrcado = projsAF.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    const totRealizado = projsAF.reduce((acc, p) => acc + (Number(p.realizado) || 0), 0);

    // CORRIGIDO (a pedido do usuário — mesma causa raiz do Dashboard):
    // isOrcamentoGlobalFechado() checava todos os projetos do sistema
    // juntos, ignorando o Ano Fiscal de cada um. Agora usa o mesmo
    // helper por-AF do Dashboard.
    const isFechadoParaAF = await construirMapaFechamentoAF();
    const algumEmConstrucao = projsAF.some(p => !isFechadoParaAF(p.ano_fiscal));
    const elKpiOrc = document.getElementById('visaoKpiOrcAprovado');
    if (elKpiOrc) {
        elKpiOrc.innerHTML = !algumEmConstrucao
            ? `R$ ${totOrcado.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span class="text-[10px] bg-green-100 text-green-800 px-1 rounded block font-normal mt-1">Oficial Homologado</span>`
            : `R$ ${totOrcado.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span class="text-[10px] bg-amber-100 text-amber-800 px-1 rounded block font-normal mt-1">Em Construção (Informativo)</span>`;
    }
    const elKpiReal = document.getElementById('visaoKpiOrcUtilizado');
    if (elKpiReal) elKpiReal.innerText = `R$ ${totRealizado.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    const elKpiSaldo = document.getElementById('visaoKpiSaldo');
    if (elKpiSaldo) elKpiSaldo.innerText = `R$ ${(totOrcado - totRealizado).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // AJUSTADO (a pedido do usuário): a tabela agora respeita o mesmo
    // filtro de Ano Fiscal selecionado que os KPIs/CAPEX-OPEX acima —
    // antes ficava com escopo mais amplo (todo o histórico aprovado),
    // o que ficaria enganoso agora que a tela tem um seletor visível.
    const projetosVisiveis = baseAF.filter(p => {
        if (p.is_subprojeto === true) return false;
        if (p.projeto_concluido === true) return false;
        const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'CANCELADO' || sub === 'REPROVADO' || sub === 'HOLD') return false;
        if (etapa === 'BUSINESS CASE' && sub !== 'APROVADO') return false;
        return true;
    });

    if (projetosVisiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto com orçamento inicial aprovado</td></tr>`;
        const cardsVazio = document.getElementById('visaoOrcamentoCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">Nenhum projeto com orçamento inicial aprovado</div>`;
        return;
    }

    let linhasTabela = '';
    let cartoes = '';

    projetosVisiveis.forEach(p => {
        const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
        const valReq = Number(p.val_req) || 0;
        const valTech = Number(p.val_tech) || 0;

        const valFinal = valTech > 0 ? valTech : (valReq > 0 ? valReq : valBc);

        let diffPct = 0;
        if (valBc > 0) {
            diffPct = ((valFinal - valBc) / valBc) * 100;
        }

        const absDiffPct = Math.abs(diffPct);
        let semaforoHtml = '';
        let corCartao = '';

        if (absDiffPct < 10) {
            semaforoHtml = `<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> VERDE (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-emerald-500';
        } else if (absDiffPct >= 10 && absDiffPct <= 20) {
            semaforoHtml = `<span class="px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> AMARELO (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-amber-500';
        } else {
            semaforoHtml = `<span class="px-2 py-1 bg-red-100 text-red-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> VERMELHO (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-red-500';
        }

        const valBcFmt = valBc.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const valReqFmt = valReq > 0 ? 'R$ ' + valReq.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-';
        const valTechFmt = valTech > 0 ? 'R$ ' + valTech.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-';

        linhasTabela += `
            <tr>
                <td class="p-3 font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold text-gray-900">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-center font-bold">${p.tamanho || 'M'}<div class="text-[10px] font-normal text-gray-500">${horasAtuaisDoProjeto(p)}h</div></td>
                <td class="p-3 text-right">R$ ${valBcFmt}</td>
                <td class="p-3 text-right text-purple-800">${valReqFmt}</td>
                <td class="p-3 text-right text-blue-800">${valTechFmt}</td>
                <td class="p-3 text-right font-bold">${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%</td>
                <td class="p-3 text-center">${semaforoHtml}</td>
            </tr>
        `;

        cartoes += `
            <div class="bg-white border border-gray-200 ${corCartao} rounded-lg p-3 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-red-700 font-bold text-sm">${p.codigo}</span>
                    <span class="text-xs font-bold text-gray-500">Porte ${p.tamanho || 'M'} · ${horasAtuaisDoProjeto(p)}h</span>
                </div>
                <div class="font-semibold text-sm text-gray-800 mb-2">${escapeHtml(p.nome)}</div>
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-600 border-t pt-2 mb-2">
                    <div><span class="text-gray-400 block">BC</span><b>R$ ${valBcFmt}</b></div>
                    <div><span class="text-gray-400 block">Req</span><b class="text-purple-800">${valReqFmt}</b></div>
                    <div><span class="text-gray-400 block">Tech</span><b class="text-blue-800">${valTechFmt}</b></div>
                </div>
                <div class="text-xs">${semaforoHtml}</div>
            </div>
        `;
    });

    tbody.innerHTML = linhasTabela;
    const cardsBody = document.getElementById('visaoOrcamentoCardsBody');
    if (cardsBody) cardsBody.innerHTML = cartoes;
}
