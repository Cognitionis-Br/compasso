// =========================================================================
// budget-overview/alertas-orcamento.js
// Lista consolidada de projetos com alerta de variação de orçamento
// (Especificacao_Workflow_v4.md, seção 5.2/5.3 — G7), reunindo os
// alertas gravados na conclusão de Requerimentos (req_alerta_variacao) e
// de Technical (tech_alerta_variacao).
// =========================================================================
function renderAlertasOrcamentoView() {
    const tbody = document.getElementById('alertasOrcamentoTableBody');
    if (!tbody) return;

    const linhas = [];

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    filtrarProjetosPorArea(projectsData, 'alertas_orcamento').forEach(p => {
        // NOVO (item 2 — subprojetos/conclusão): projeto já concluído sai
        // de telas de acompanhamento ativo (subprojeto nunca aparece aqui
        // de qualquer forma, já que não passa por Requerimentos/Technical).
        if (p.projeto_concluido === true) return;
        if (p.req_alerta_variacao && p.req_alerta_variacao !== 'ok') {
            linhas.push({ p, fase: 'Requerimentos', nivel: p.req_alerta_variacao, percentual: p.req_variacao_percentual });
        }
        if (p.tech_alerta_variacao && p.tech_alerta_variacao !== 'ok') {
            linhas.push({ p, fase: 'Technical', nivel: p.tech_alerta_variacao, percentual: p.tech_variacao_percentual });
        }
    });

    if (linhas.length === 0) {
        const msgVazia = 'Nenhum alerta de variação de orçamento no momento';
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        const cardsVazio = document.getElementById('alertasOrcamentoCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        return;
    }

    // Vermelho primeiro, depois amarelo.
    linhas.sort((a, b) => (a.nivel === 'vermelho' ? 0 : 1) - (b.nivel === 'vermelho' ? 0 : 1));

    let linhasTabela = '';
    let cartoes = '';

    linhas.forEach(({ p, fase, nivel, percentual }) => {
        const cor = nivel === 'vermelho' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
        const icone = nivel === 'vermelho' ? '🔴' : '🟡';
        const corCartao = nivel === 'vermelho' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-500';
        // AJUSTADO 10/08/2026 (item 13 do relatório de testes): mesmos
        // campos de valor (porte, BC, Req, Tech) da tela de Visão de
        // Orçamento, pra manter consistência entre as duas telas.
        const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
        const valReq = Number(p.val_req) || 0;
        const valTech = Number(p.val_tech) || 0;
        const valBcFmt = valBc.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const valReqFmt = valReq > 0 ? 'R$ ' + valReq.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-';
        const valTechFmt = valTech > 0 ? 'R$ ' + valTech.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-';

        linhasTabela += `
            <tr>
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-center font-bold">${p.tamanho || 'M'}<div class="text-[10px] font-normal text-gray-500">${horasAtuaisDoProjeto(p)}h</div></td>
                <td class="p-3 text-right">R$ ${valBcFmt}</td>
                <td class="p-3 text-right text-purple-800">${valReqFmt}</td>
                <td class="p-3 text-right text-blue-800">${valTechFmt}</td>
                <td class="p-3 text-xs font-bold">${fase}</td>
                <td class="p-3 text-right font-mono font-bold">${percentual}%</td>
                <td class="p-3 text-center"><span class="${cor} font-bold px-2 py-0.5 rounded text-[10px]">${icone} ${nivel.toUpperCase()}</span></td>
            </tr>
        `;

        cartoes += `
            <div class="bg-white border border-gray-200 ${corCartao} rounded-lg p-3 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-red-700 font-bold text-sm">${p.codigo}</span>
                    <span class="${cor} font-bold px-2 py-0.5 rounded text-[10px]">${icone} ${nivel.toUpperCase()} (${percentual}%)</span>
                </div>
                <div class="font-semibold text-sm text-gray-800 mb-1">${escapeHtml(p.nome)}</div>
                <div class="text-xs text-gray-500 mb-2">Porte ${p.tamanho || 'M'} · ${horasAtuaisDoProjeto(p)}h · Alerta na fase: <b>${fase}</b></div>
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-600 border-t pt-2">
                    <div><span class="text-gray-400 block">BC</span><b>R$ ${valBcFmt}</b></div>
                    <div><span class="text-gray-400 block">Req</span><b class="text-purple-800">${valReqFmt}</b></div>
                    <div><span class="text-gray-400 block">Tech</span><b class="text-blue-800">${valTechFmt}</b></div>
                </div>
            </div>
        `;
    });

    tbody.innerHTML = linhasTabela;
    const cardsBody = document.getElementById('alertasOrcamentoCardsBody');
    if (cardsBody) cardsBody.innerHTML = cartoes;
}
