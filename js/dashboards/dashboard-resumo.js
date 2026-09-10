// =========================================================================
// dashboards/dashboard-resumo.js   (Remodelação do Dashboard — Estágio 2)
// Resumo Orçamentário (§4.3), Farol de Saúde (§4.4) e Composição do
// Portfólio (§4.5) da spec-dashboard-portfolio.md.
//
// Só tokens de cor já existentes: saúde emerald/amber/red; CAPEX = blue,
// OPEX = purple; navy nos cabeçalhos; sem paleta nova, sem sombra pesada.
// =========================================================================

function _resFmt(v) {
    if (typeof formatCurrency === 'function') return formatCurrency(v);
    return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
// orçamento "corrente" de um projeto (mesma leitura do resto do sistema)
function _resOrc(p) {
    return Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
}
function _resCapexOpex(lista, extrator) {
    const ex = extrator || _resOrc;
    const r = { total: 0, capex: 0, opex: 0 };
    (lista || []).forEach(p => {
        const v = ex(p);
        r.total += v;
        const t = (p.tipo_orcamento || '').toUpperCase();
        if (t === 'CAPEX') r.capex += v;
        else if (t === 'OPEX') r.opex += v;
    });
    return r;
}

// -------------------------------------------------------------------------
// §4.3 Resumo Orçamentário — cadeia:
//   Fechado → +Extraordinário → +Carryover(Andamento) → +Carryover(Hold)
//   = Orçamento Atual → −Realizados → = A Realizar
// Escopo: lista do Ano Fiscal selecionado (NÃO reage ao Filtro Global).
// -------------------------------------------------------------------------
function renderResumoOrcamentario(listaAF) {
    const alvo = document.getElementById('dashResumoOrcamentario');
    if (!alvo) return;

    const base = (listaAF || []).filter(p =>
        p.is_subprojeto !== true &&
        !['CANCELADO', 'REPROVADO'].includes((p.sub_status || '').toUpperCase()));

    const eHold = p => (p.sub_status || '').toUpperCase() === 'HOLD';

    const fechado = _resCapexOpex(base.filter(p => !p.is_adhoc && p.is_carryover !== true && !eHold(p)));
    const extra = _resCapexOpex(base.filter(p => p.is_adhoc === true && !eHold(p)));
    const carryAnd = _resCapexOpex(base.filter(p => p.is_carryover === true && !eHold(p)), p => Number(p.valor_carryover) || 0);
    const carryHold = _resCapexOpex(base.filter(p => p.is_carryover === true && eHold(p)), p => Number(p.valor_carryover) || 0);

    const atual = {
        total: fechado.total + extra.total + carryAnd.total + carryHold.total,
        capex: fechado.capex + extra.capex + carryAnd.capex + carryHold.capex,
        opex: fechado.opex + extra.opex + carryAnd.opex + carryHold.opex
    };
    const realizado = _resCapexOpex(base, p => Number(p.realizado) || 0);
    const aRealizar = {
        total: atual.total - realizado.total,
        capex: atual.capex - realizado.capex,
        opex: atual.opex - realizado.opex
    };
    const totalProjetos = base.length;

    const sub = (d) => `<div class="mt-1 flex gap-3 text-[11px] font-bold">
        <span class="text-blue-700">CAPEX ${_resFmt(d.capex)}</span>
        <span class="text-purple-700">OPEX ${_resFmt(d.opex)}</span></div>`;
    const card = (titulo, valor, dados, borda) => `
        <div class="bg-white rounded-lg border border-gray-200 border-t-4 ${borda} p-4">
            <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">${titulo}</div>
            <div class="text-lg font-extrabold text-gray-900 tabular-nums mt-1">${valor}</div>
            ${dados ? sub(dados) : ''}
        </div>`;

    const linhaTira = (rot, d, sinal) => `
        <div class="px-3 py-2 border-r border-gray-200 last:border-r-0">
            <div class="text-[10px] font-bold uppercase text-gray-400">${sinal || ''} ${rot}</div>
            <div class="text-sm font-bold text-gray-800 tabular-nums">${_resFmt(d.total)}</div>
            <div class="text-[10px] text-gray-500 tabular-nums"><span class="text-blue-700">C</span> ${_resFmt(d.capex)} · <span class="text-purple-700">O</span> ${_resFmt(d.opex)}</div>
        </div>`;

    alvo.innerHTML = `
        <section class="mb-6">
            <h3 class="font-extrabold text-gray-900 text-sm mb-3 uppercase tracking-wide">Resumo Orçamentário</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                ${card('Orçamento Atual', _resFmt(atual.total), atual, 'border-t-indigo-500')}
                ${card('Valores Já Realizados', _resFmt(realizado.total), realizado, 'border-t-red-500')}
                ${card('Orçamento a Realizar', _resFmt(aRealizar.total), aRealizar, 'border-t-emerald-500')}
                ${card('Total de Projetos', String(totalProjetos), null, 'border-t-gray-400')}
            </div>
            <div class="mt-3 bg-white rounded-lg border border-gray-200 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 overflow-hidden">
                ${linhaTira('Orçamento Fechado', fechado, '')}
                ${linhaTira('Orçamento Extraordinário', extra, '+')}
                ${linhaTira('Carryover (Em Andamento)', carryAnd, '+')}
                ${linhaTira('Carryover (Em Hold)', carryHold, '+')}
            </div>
        </section>`;
}

// -------------------------------------------------------------------------
// §4.4 Farol de Saúde — 3 contadores + barra proporcional única.
// Escopo: lista já recortada pelo Filtro Global.
// -------------------------------------------------------------------------
function renderFarolSaudeDash(listaDash, etapasCache) {
    const alvo = document.getElementById('dashFarolSaude');
    if (!alvo) return;

    let verde = 0, amarelo = 0, vermelho = 0, inativo = 0;
    (listaDash || []).forEach(p => {
        const s = (typeof calcularSaudeProjeto === 'function')
            ? calcularSaudeProjeto(p, etapasCache || []).status : 'SAUDAVEL';
        if (s === 'CRITICO') vermelho++;
        else if (s === 'ATENCAO' || s === 'HOLD') amarelo++;
        else if (s === 'INATIVO') inativo++;
        else verde++;
    });
    const tot = verde + amarelo + vermelho || 1;
    const pct = n => Math.round((n / tot) * 100);

    const contador = (emoji, rot, n, cls) => `
        <div class="flex-1 text-center">
            <div class="text-2xl font-extrabold tabular-nums ${cls}">${n}</div>
            <div class="text-[10px] font-bold uppercase text-gray-500">${emoji} ${rot}</div>
        </div>`;

    alvo.innerHTML = `
        <section class="bg-white rounded-lg border border-gray-200 border-t-4 border-t-emerald-500 p-4 h-full">
            <h3 class="font-extrabold text-gray-900 text-sm mb-3 uppercase tracking-wide">Farol de Saúde</h3>
            <div class="flex gap-2 mb-3">
                ${contador('🟢', 'Saudável', verde, 'text-emerald-600')}
                ${contador('🟡', 'Atenção', amarelo, 'text-amber-600')}
                ${contador('🔴', 'Crítico', vermelho, 'text-red-600')}
            </div>
            <div class="h-3 w-full rounded-full overflow-hidden flex bg-gray-100">
                <div class="bg-emerald-500" style="width:${pct(verde)}%"></div>
                <div class="bg-amber-500" style="width:${pct(amarelo)}%"></div>
                <div class="bg-red-500" style="width:${pct(vermelho)}%"></div>
            </div>
            <div class="mt-2 text-[10px] text-gray-400">${tot} projeto(s) no farol${inativo ? ` · ${inativo} inativo(s) fora da conta` : ''}.</div>
        </section>`;
}

// -------------------------------------------------------------------------
// §4.5 Composição do Portfólio — barra 100% empilhada, 3 segmentos.
// Escopo: lista já recortada pelo Filtro Global.
// -------------------------------------------------------------------------
function renderComposicaoPortfolio(listaDash) {
    const alvo = document.getElementById('dashComposicao');
    if (!alvo) return;

    const base = (listaDash || []).filter(p => p.is_subprojeto !== true);
    const carry = base.filter(p => p.is_carryover === true).length;
    const extra = base.filter(p => p.is_adhoc === true && p.is_carryover !== true).length;
    const abertura = base.length - carry - extra;
    const tot = base.length || 1;
    const pct = n => Math.round((n / tot) * 100);

    const seg = (n, cls) => n > 0 ? `<div class="${cls} flex items-center justify-center text-[10px] font-bold text-white" style="width:${pct(n)}%">${pct(n)}%</div>` : '';
    const legenda = (cls, rot, n) => `<span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm ${cls}"></span>${rot}: <b class="tabular-nums">${n}</b></span>`;

    alvo.innerHTML = `
        <section class="bg-white rounded-lg border border-gray-200 border-t-4 border-t-indigo-400 p-4 h-full">
            <h3 class="font-extrabold text-gray-900 text-sm mb-3 uppercase tracking-wide">Composição do Portfólio</h3>
            <div class="h-6 w-full rounded overflow-hidden flex bg-gray-100">
                ${seg(abertura, 'bg-indigo-500')}
                ${seg(extra, 'bg-purple-500')}
                ${seg(carry, 'bg-orange-500')}
            </div>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                ${legenda('bg-indigo-500', 'Incluídos na Abertura', abertura)}
                ${legenda('bg-purple-500', 'Extraordinárias', extra)}
                ${legenda('bg-orange-500', 'Carryover', carry)}
            </div>
        </section>`;
}
