// =========================================================================
// budget-overview/alertas-orcamento.js
// Lista consolidada de projetos com alerta de variação de orçamento
// (Especificacao_Workflow_v4.md, seção 5.2/5.3 — G7), reunindo os
// alertas gravados na conclusão de Requerimentos (req_alerta_variacao) e
// de Technical (tech_alerta_variacao).
// =========================================================================
let _alertasUltimaLista = []; // V29 — cache para exportação CSV
let alertasOrdenacaoAtual = { campo: 'padrao', direcao: 'desc' }; // V49

function ordenarAlertas(campo) {
    if (alertasOrdenacaoAtual.campo === campo) {
        alertasOrdenacaoAtual.direcao = alertasOrdenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        alertasOrdenacaoAtual.campo = campo;
        alertasOrdenacaoAtual.direcao = campo === 'variacao' ? 'desc' : 'asc';
    }
    ['projeto', 'variacao', 'nivel'].forEach(c => {
        const el = document.getElementById(`ordArrowAlertas-${c}`);
        if (el) el.innerText = c === campo ? (alertasOrdenacaoAtual.direcao === 'asc' ? '▲' : '▼') : '';
    });
    renderAlertasOrcamentoView();
}

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

    popularFiltrosAlertas(linhas);
    const filtroArea = (document.getElementById('alertasFiltroArea') || {}).value || '';
    const filtroNivel = (document.getElementById('alertasFiltroNivel') || {}).value || '';
    const linhasFiltradas = linhas.filter(l => {
        if (filtroArea && (l.p.area || '') !== filtroArea) return false;
        if (filtroNivel && l.nivel !== filtroNivel) return false;
        return true;
    });

    if (linhasFiltradas.length === 0) {
        const msgVazia = linhas.length === 0
            ? 'Nenhum alerta de variação de orçamento no momento'
            : 'Nenhum alerta com esses filtros';
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        const cardsVazio = document.getElementById('alertasOrcamentoCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        _alertasUltimaLista = [];
        return;
    }

    // V49 — ordenação clicável; default: vermelho primeiro, depois amarelo
    const NIVEL_ORDEM = { vermelho: 0, amarelo: 1 };
    if (alertasOrdenacaoAtual.campo === 'projeto') {
        linhasFiltradas.sort((a, b) => {
            const va = (a.p.nome || '').toUpperCase(), vb = (b.p.nome || '').toUpperCase();
            if (va < vb) return alertasOrdenacaoAtual.direcao === 'asc' ? -1 : 1;
            if (va > vb) return alertasOrdenacaoAtual.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    } else if (alertasOrdenacaoAtual.campo === 'variacao') {
        linhasFiltradas.sort((a, b) => {
            const va = Math.abs(Number(a.percentual) || 0), vb = Math.abs(Number(b.percentual) || 0);
            return alertasOrdenacaoAtual.direcao === 'asc' ? va - vb : vb - va;
        });
    } else if (alertasOrdenacaoAtual.campo === 'nivel') {
        linhasFiltradas.sort((a, b) => {
            const va = NIVEL_ORDEM[a.nivel] ?? 99, vb = NIVEL_ORDEM[b.nivel] ?? 99;
            return alertasOrdenacaoAtual.direcao === 'asc' ? va - vb : vb - va;
        });
    } else {
        linhasFiltradas.sort((a, b) => (a.nivel === 'vermelho' ? 0 : 1) - (b.nivel === 'vermelho' ? 0 : 1));
    }

    let linhasTabela = '';
    let cartoes = '';

    linhasFiltradas.forEach(({ p, fase, nivel, percentual }) => {
        const corKey = nivel === 'vermelho' ? 'danger' : 'amber';
        const icone = nivel === 'vermelho' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';
        const corCartao = nivel === 'vermelho' ? 'border-l-4 border-l-danger-500' : 'border-l-4 border-l-amber-500';
        // AJUSTADO 10/08/2026 (item 13 do relatório de testes): mesmos
        // campos de valor (porte, BC, Req, Tech) da tela de Visão de
        // Orçamento, pra manter consistência entre as duas telas.
        const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
        const valReq = Number(p.val_req) || 0;
        const valTech = Number(p.val_tech) || 0;
        const valBcFmt = formatCurrency(valBc);
        const valReqFmt = valReq > 0 ? formatCurrency(valReq) : '-';
        const valTechFmt = valTech > 0 ? formatCurrency(valTech) : '-';

        linhasTabela += `
            <tr>
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-center font-bold">${p.tamanho || 'M'}<div class="text-[10px] font-normal text-gray-500">${horasAtuaisDoProjeto(p)}h</div></td>
                <td class="p-3 text-right">${valBcFmt}</td>
                <td class="p-3 text-right text-purple-800">${valReqFmt}</td>
                <td class="p-3 text-right text-blue-800">${valTechFmt}</td>
                <td class="p-3 text-xs font-bold">${fase}</td>
                <td class="p-3 text-right font-mono font-bold">${percentual}%</td>
                <td class="p-3 text-center">${renderBadgeStatus(corKey, icone, nivel.toUpperCase())}</td>
            </tr>
        `;

        cartoes += `
            <div class="bg-white border border-gray-200 ${corCartao} rounded-lg p-3 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-red-700 font-bold text-sm">${p.codigo}</span>
                    ${renderBadgeStatus(corKey, icone, `${nivel.toUpperCase()} (${percentual}%)`)}
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
    _alertasUltimaLista = linhasFiltradas; // V44
}

function popularFiltrosAlertas(linhas) {
    const sel = document.getElementById('alertasFiltroArea');
    if (!sel) return;
    const atual = sel.value;
    const areas = [...new Set(linhas.map(l => l.p.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sel.innerHTML = '<option value="">-- Todas --</option>' + areas.map(a => `<option value="${escapeHtml(a)}" ${a === atual ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('');
}

function onFiltroAlertasChange() {
    renderAlertasOrcamentoView();
}

// V29 — Exportação CSV da lista de alertas atual
function exportarAlertasOrcamentoCSV() {
    if (!_alertasUltimaLista.length) return alert('Nenhum alerta de variação de orçamento no momento.');
    exportarCSV(
        ['Código', 'Nome', 'Área', 'Fase da Revisão', 'Nível', 'Variação (%)', 'BC (R$)', 'Requerimentos (R$)', 'Especificação (R$)'],
        _alertasUltimaLista.map(({ p, fase, nivel, percentual }) => [
            p.codigo || '',
            p.nome || '',
            p.area || '',
            fase || '',
            nivel ? nivel.toUpperCase() : '',
            percentual || 0,
            Number(p.val_bc) || Number(p.previsto) || 0,
            Number(p.val_req) || 0,
            Number(p.val_tech) || 0
        ]),
        'alertas_orcamento'
    );
}
