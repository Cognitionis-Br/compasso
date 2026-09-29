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
let _visaoOrcUltimaLista = []; // V25 — cache para exportação CSV
let visaoOrcOrdenacaoAtual = { campo: 'padrao', direcao: 'asc' }; // V45

function ordenarVisaoOrcamento(campo) {
    if (visaoOrcOrdenacaoAtual.campo === campo) {
        visaoOrcOrdenacaoAtual.direcao = visaoOrcOrdenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        visaoOrcOrdenacaoAtual.campo = campo;
        visaoOrcOrdenacaoAtual.direcao = campo === 'variacao' ? 'desc' : 'asc';
    }
    ['projeto', 'variacao', 'semaforo'].forEach(c => {
        const el = document.getElementById(`ordArrowVisaoOrc-${c}`);
        if (el) el.innerText = c === campo ? (visaoOrcOrdenacaoAtual.direcao === 'asc' ? '▲' : '▼') : '';
    });
    renderVisaoOrcamentoView();
}

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
            ? `${formatCurrency(totOrcado)} <span class="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded block font-normal mt-1">Oficial Homologado</span>`
            : `${formatCurrency(totOrcado)} <span class="text-[10px] bg-amber-100 text-amber-800 px-1 rounded block font-normal mt-1">Em Construção (Informativo)</span>`;
    }
    const elKpiReal = document.getElementById('visaoKpiOrcUtilizado');
    if (elKpiReal) elKpiReal.innerText = formatCurrency(totRealizado);
    const elKpiSaldo = document.getElementById('visaoKpiSaldo');
    if (elKpiSaldo) elKpiSaldo.innerText = formatCurrency(totOrcado - totRealizado);

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

    const kpiSem = document.getElementById('visaoOrcKPISemaforo');

    if (projetosVisiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto com orçamento inicial aprovado</td></tr>`;
        const cardsVazio = document.getElementById('visaoOrcamentoCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">Nenhum projeto com orçamento inicial aprovado</div>`;
        if (kpiSem) kpiSem.innerHTML = '';
        return;
    }

    // V43 — pré-computar semáforo para todos (KPI de contagem + filtro)
    const projetosComSemaforo = projetosVisiveis.map(p => {
        const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
        const valReq = Number(p.val_req) || 0;
        const valTech = Number(p.val_tech) || 0;
        const valFinal = valTech > 0 ? valTech : (valReq > 0 ? valReq : valBc);
        const diffPct = valBc > 0 ? ((valFinal - valBc) / valBc) * 100 : 0;
        const absDiff = Math.abs(diffPct);
        const semaforo = absDiff < 10 ? 'VERDE' : absDiff <= 20 ? 'AMARELO' : 'VERMELHO';
        return { p, diffPct, semaforo };
    });

    if (kpiSem) {
        const nVerde = projetosComSemaforo.filter(x => x.semaforo === 'VERDE').length;
        const nAmarelo = projetosComSemaforo.filter(x => x.semaforo === 'AMARELO').length;
        const nVermelho = projetosComSemaforo.filter(x => x.semaforo === 'VERMELHO').length;
        const kpi = (label, n, corTopo, corDot) => `<div class="bg-white rounded-lg border border-gray-200 border-t-4 ${corTopo} p-3 flex items-center gap-2"><span class="w-3 h-3 rounded-full ${corDot} flex-shrink-0"></span><div><div class="text-[10px] font-bold uppercase text-gray-400">${label}</div><div class="text-lg font-extrabold text-gray-900">${n}</div></div></div>`;
        kpiSem.innerHTML = `<div class="grid grid-cols-3 gap-3">${kpi('Verde', nVerde, 'border-t-emerald-500', 'bg-emerald-500')}${kpi('Amarelo', nAmarelo, 'border-t-amber-500', 'bg-amber-500')}${kpi('Vermelho', nVermelho, 'border-t-danger-500', 'bg-danger-500')}</div>`;
    }

    const filtroSemaforoAtual = (document.getElementById('visaoOrcFiltroSemaforo') || {}).value || '';
    const projetosFiltrados = filtroSemaforoAtual
        ? projetosComSemaforo.filter(x => x.semaforo === filtroSemaforoAtual)
        : projetosComSemaforo;

    if (projetosFiltrados.length === 0) {
        const msgVazia = 'Nenhum projeto com esse semaforo no filtro atual';
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        const cardsVazio = document.getElementById('visaoOrcamentoCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        _visaoOrcUltimaLista = [];
        return;
    }

    // V45 — ordenação clicável
    const SEMAFORO_ORDEM = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
    if (visaoOrcOrdenacaoAtual.campo !== 'padrao') {
        projetosFiltrados.sort((a, b) => {
            let va, vb;
            if (visaoOrcOrdenacaoAtual.campo === 'projeto') { va = (a.p.nome || '').toUpperCase(); vb = (b.p.nome || '').toUpperCase(); }
            else if (visaoOrcOrdenacaoAtual.campo === 'variacao') { va = Math.abs(a.diffPct); vb = Math.abs(b.diffPct); }
            else if (visaoOrcOrdenacaoAtual.campo === 'semaforo') { va = SEMAFORO_ORDEM[a.semaforo] ?? 99; vb = SEMAFORO_ORDEM[b.semaforo] ?? 99; }
            if (va < vb) return visaoOrcOrdenacaoAtual.direcao === 'asc' ? -1 : 1;
            if (va > vb) return visaoOrcOrdenacaoAtual.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let linhasTabela = '';
    let cartoes = '';

    projetosFiltrados.forEach(({ p, diffPct, semaforo }) => {
        const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
        const valReq = Number(p.val_req) || 0;
        const valTech = Number(p.val_tech) || 0;
        let semaforoHtml = '';
        let corCartao = '';
        if (semaforo === 'VERDE') {
            semaforoHtml = `<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> VERDE (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-emerald-500';
        } else if (semaforo === 'AMARELO') {
            semaforoHtml = `<span class="px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> AMARELO (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-amber-500';
        } else {
            semaforoHtml = `<span class="px-2 py-1 bg-danger-100 text-danger-800 rounded font-bold flex items-center justify-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-danger-500"></span> VERMELHO (${diffPct.toFixed(1)}%)</span>`;
            corCartao = 'border-l-4 border-l-danger-500';
        }

        const valBcFmt = formatCurrency(valBc);
        const valReqFmt = valReq > 0 ? formatCurrency(valReq) : '-';
        const valTechFmt = valTech > 0 ? formatCurrency(valTech) : '-';

        linhasTabela += `
            <tr>
                <td class="p-3 font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold text-gray-900">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-center font-bold">${p.tamanho || 'M'}<div class="text-[10px] font-normal text-gray-500">${horasAtuaisDoProjeto(p)}h</div></td>
                <td class="p-3 text-right">${valBcFmt}</td>
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
                    <div><span class="text-gray-400 block">BC</span><b>${valBcFmt}</b></div>
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
    _visaoOrcUltimaLista = projetosFiltrados.map(x => x.p); // V43
}

function onFiltroSemaforoVisaoOrc() {
    renderVisaoOrcamentoView();
}

// V25 — Exportação CSV da lista filtrada atual
function exportarVisaoOrcamentoCSV() {
    if (!_visaoOrcUltimaLista.length) return alert('Nenhum projeto na lista atual para exportar.');
    exportarCSV(
        ['Código', 'Nome', 'Porte', 'Horas', 'Business Case (R$)', 'Requerimentos (R$)', 'Especificação (R$)', 'Variação (%)', 'Semáforo'],
        _visaoOrcUltimaLista.map(p => {
            const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
            const valReq = Number(p.val_req) || 0;
            const valTech = Number(p.val_tech) || 0;
            const valFinal = valTech > 0 ? valTech : (valReq > 0 ? valReq : valBc);
            const diffPct = valBc > 0 ? ((valFinal - valBc) / valBc) * 100 : 0;
            const absDiff = Math.abs(diffPct);
            const semaforo = absDiff < 10 ? 'VERDE' : absDiff <= 20 ? 'AMARELO' : 'VERMELHO';
            return [
                p.codigo || '',
                p.nome || '',
                p.tamanho || 'M',
                typeof horasAtuaisDoProjeto === 'function' ? horasAtuaisDoProjeto(p) : '',
                valBc,
                valReq || '',
                valTech || '',
                diffPct.toFixed(1),
                semaforo
            ];
        }),
        'visao_orcamento'
    );
}
