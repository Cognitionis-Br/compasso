// =========================================================================
// dashboards/dashboard-funis.js   (Remodelação do Dashboard — Estágio 4)
// §4.6 Orçado vs. Realizado por Área/UN  +  §4.7 Funis de Criação do AF.
// Só tokens de cor já existentes. Sem Plotly — barras em CSS.
// =========================================================================

function _fnFmt(v) {
    return (typeof formatCurrency === 'function') ? formatCurrency(v)
        : 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
function _fnOrc(p) {
    return Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
}

// -------------------------------------------------------------------------
// §4.6 — barras agrupadas Orçado x Realizado, uma linha por Área/UN.
// Escopo: lista já recortada pelo Filtro Global.
// -------------------------------------------------------------------------
function renderOrcadoRealizadoArea(listaDash) {
    const alvo = document.getElementById('dashOrcadoRealizado');
    if (!alvo) return;

    const base = (listaDash || []).filter(p => p.is_subprojeto !== true);
    const areas = [...new Set(base.map(p => (p.area || 'GERAL')))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const linhas = areas.map(un => {
        const daArea = base.filter(p => (p.area || 'GERAL') === un);
        return { un, orcado: daArea.reduce((a, p) => a + _fnOrc(p), 0), realizado: daArea.reduce((a, p) => a + (Number(p.realizado) || 0), 0) };
    });
    const maxV = Math.max(1, ...linhas.map(l => Math.max(l.orcado, l.realizado)));

    const corpo = linhas.length === 0
        ? '<div class="text-xs text-gray-400 py-6 text-center">Sem projetos para o filtro atual.</div>'
        : linhas.map(l => `
            <div class="py-2 border-b border-gray-100 last:border-b-0">
                <div class="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                    <span>${escapeHtml(l.un)}</span>
                    <span class="tabular-nums text-gray-400">orç ${_fnFmt(l.orcado)} · real ${_fnFmt(l.realizado)}</span>
                </div>
                <div class="space-y-1">
                    <div class="h-3 bg-gray-100 rounded overflow-hidden"><div class="h-full bg-cyan-600" style="width:${(l.orcado / maxV) * 100}%"></div></div>
                    <div class="h-3 bg-gray-100 rounded overflow-hidden"><div class="h-full bg-fuchsia-600" style="width:${(l.realizado / maxV) * 100}%"></div></div>
                </div>
            </div>`).join('');

    alvo.innerHTML = `
        <section class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-extrabold text-gray-900 text-sm uppercase tracking-wide">Orçado vs. Realizado por Área / UN</h3>
                <span class="text-[10px] font-bold"><span class="text-cyan-700">■ Orçado</span> &nbsp; <span class="text-fuchsia-700">■ Realizado</span></span>
            </div>
            ${corpo}
        </section>`;
}

// -------------------------------------------------------------------------
// §4.7 — dois funis (Normal, Extraordinária). Etapas: Para gerar orçamento
// -> Para validar -> desfechos (Aprovados / Reprovados / Cancelados) como
// ramificações. Estado vazio: não desenha o funil.
// Escopo: lista do Ano Fiscal selecionado (NÃO reage ao Filtro Global).
// -------------------------------------------------------------------------
function _fnFunilBC(listaAF, isAdhoc) {
    const emBC = (listaAF || []).filter(p =>
        p.is_subprojeto !== true && p.is_carryover !== true && p.is_adhoc === isAdhoc &&
        ((typeof dashFaseKeyRaw === 'function' ? dashFaseKeyRaw(p.etapa_atual) : String(p.etapa_atual || 'BUSINESS CASE').toUpperCase().replace(/\s+/g, '')) === 'BUSINESSCASE'));
    const sub = p => (p.sub_status || '').toUpperCase();
    return {
        paraOrcar: emBC.filter(p => ['A PLANEJAR', 'PLANEJADO', '', 'NULL'].includes(sub(p)) || !p.sub_status),
        paraValidar: emBC.filter(p => sub(p) === 'ORÇAMENTO REALIZADO'),
        aprovados: emBC.filter(p => sub(p) === 'APROVADO'),
        reprovados: emBC.filter(p => sub(p) === 'REPROVADO'),
        cancelados: emBC.filter(p => sub(p) === 'CANCELADO')
    };
}

function _fnFunilHtml(titulo, f) {
    const total = f.paraOrcar.length + f.paraValidar.length + f.aprovados.length + f.reprovados.length + f.cancelados.length;
    if (total === 0) {
        return `<div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">${titulo}</div>
            <div class="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded">Sem demandas nesta fase de criação.</div>
        </div>`;
    }
    const maxEt = Math.max(1, f.paraOrcar.length, f.paraValidar.length);
    const etapa = (rot, arr, cls) => `
        <div class="mb-2">
            <div class="flex justify-between text-[11px] font-bold text-gray-600"><span>${rot}</span><span class="tabular-nums">${arr.length} · ${_fnFmt(arr.reduce((a, p) => a + _fnOrc(p), 0))}</span></div>
            <div class="h-4 bg-gray-100 rounded overflow-hidden mt-0.5"><div class="h-full ${cls}" style="width:${(arr.length / maxEt) * 100}%"></div></div>
        </div>`;
    const ramo = (rot, arr, cls) => `<div class="flex-1 text-center rounded border ${cls} py-1.5">
        <div class="text-sm font-extrabold tabular-nums">${arr.length}</div><div class="text-[9px] font-bold uppercase text-gray-500">${rot}</div></div>`;
    return `<div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">${titulo}</div>
        ${etapa('Para gerar orçamento', f.paraOrcar, 'bg-blue-500')}
        ${etapa('Para validar (Comitê)', f.paraValidar, 'bg-amber-500')}
        <div class="text-[9px] font-bold uppercase text-gray-400 mt-2 mb-1">Desfechos</div>
        <div class="flex gap-2">
            ${ramo('Aprovados', f.aprovados, 'border-emerald-200 text-emerald-700')}
            ${ramo('Reprovados', f.reprovados, 'border-red-200 text-red-700')}
            ${ramo('Cancelados', f.cancelados, 'border-gray-200 text-gray-500')}
        </div>
    </div>`;
}

function renderFunisCriacao(listaAF) {
    const alvo = document.getElementById('dashFunisCriacao');
    if (!alvo) return;
    alvo.innerHTML = `
        <section>
            <h3 class="font-extrabold text-gray-900 text-sm mb-3 uppercase tracking-wide">Funis de Criação do Ano Fiscal</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${_fnFunilHtml('Carteira Normal', _fnFunilBC(listaAF, false))}
                ${_fnFunilHtml('Carteira Extraordinária', _fnFunilBC(listaAF, true))}
            </div>
        </section>`;
}
