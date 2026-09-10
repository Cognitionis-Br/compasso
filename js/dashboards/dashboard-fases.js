// =========================================================================
// dashboards/dashboard-fases.js   (Remodelação do Dashboard — Estágio 3)
// Consolidação do Portfólio por Fase (spec-dashboard-portfolio.md §4.2).
//
// - 7 fases lineares e independentes, na ordem 1->7 (Business Case ...
//   Go-Live, Concluído). Go-Live e Concluído são fases DISTINTAS.
// - Cancelados / Reprovados / Em Hold são desfechos fora do fluxo linear:
//   cards satélite, nunca barras na sequência.
// - Validação em tempo de exibição: Σ(7 fases) + Σ(3 desfechos) = Total
//   Geral da Carteira. Se não bater, sinaliza (não exibe em silêncio).
// - Cor da barra = saúde agregada da fase (🟢/🟡/🔴), tokens já existentes.
// Escopo: lista já recortada pelo Filtro Global.
// =========================================================================

function _cfOrc(p) {
    return Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
}
function _cfFmt(v) {
    return (typeof formatCurrency === 'function') ? formatCurrency(v)
        : 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
// saúde agregada: pior caso entre os projetos da fase.
function _cfSaudeFase(projs, etapasCache) {
    let temCritico = false, temAtencao = false, temSaudavel = false;
    projs.forEach(p => {
        const s = (typeof calcularSaudeProjeto === 'function')
            ? calcularSaudeProjeto(p, etapasCache || []).status : 'SAUDAVEL';
        if (s === 'CRITICO') temCritico = true;
        else if (s === 'ATENCAO' || s === 'HOLD') temAtencao = true;
        else if (s !== 'INATIVO') temSaudavel = true;
    });
    if (temCritico) return { emoji: '🔴', barra: 'bg-red-500', texto: 'text-red-700' };
    if (temAtencao) return { emoji: '🟡', barra: 'bg-amber-500', texto: 'text-amber-700' };
    if (temSaudavel) return { emoji: '🟢', barra: 'bg-emerald-500', texto: 'text-emerald-700' };
    return { emoji: '⚪', barra: 'bg-gray-300', texto: 'text-gray-500' };
}

function renderConsolidacaoFases(listaDash, etapasCache) {
    const alvo = document.getElementById('dashConsolidacaoFases');
    if (!alvo) return;

    const base = (listaDash || []).filter(p => p.is_subprojeto !== true);

    const ehCancelado = p => (p.sub_status || '').toUpperCase() === 'CANCELADO' || (p.status || '').toUpperCase() === 'CANCELADO';
    const ehReprovado = p => (p.sub_status || '').toUpperCase() === 'REPROVADO';
    const ehHold = p => (p.sub_status || '').toUpperCase() === 'HOLD';
    const ehDesfecho = p => ehCancelado(p) || ehReprovado(p) || ehHold(p);

    const cancelados = base.filter(ehCancelado);
    const reprovados = base.filter(p => !ehCancelado(p) && ehReprovado(p));
    const hold = base.filter(p => !ehCancelado(p) && !ehReprovado(p) && ehHold(p));

    const noFluxo = base.filter(p => !ehDesfecho(p));
    const total = base.length;

    const FASES = (typeof DASH_FASES !== 'undefined') ? DASH_FASES : [
        { k: 'BUSINESSCASE', l: 'Business Case' }, { k: 'REQUIREMENTS', l: 'Requerimentos' },
        { k: 'TECHNICAL', l: 'Technical Architecture' }, { k: 'EXECUTION', l: 'Execução' },
        { k: 'UAT', l: 'UAT' }, { k: 'GOLIVE', l: 'Go-Live' }, { k: 'CONCLUIDO', l: 'Concluído' }
    ];

    let somaFases = 0;
    const linhas = FASES.map((f, idx) => {
        const projs = noFluxo.filter(p => dashFaseDe(p) === f.k);
        const qtd = projs.length;
        somaFases += qtd;
        const pct = total ? Math.round((qtd / total) * 100) : 0;
        const orc = projs.reduce((a, p) => a + _cfOrc(p), 0);
        const saude = _cfSaudeFase(projs, etapasCache);
        return `
            <div class="flex items-center gap-3 py-2 ${idx < FASES.length - 1 ? 'border-b border-gray-100' : ''}">
                <div class="w-40 shrink-0 text-xs font-bold text-gray-700">${idx + 1}. ${escapeHtml(f.l)}</div>
                <div class="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div class="${saude.barra} h-full" style="width:${pct}%"></div>
                </div>
                <div class="w-28 shrink-0 text-right text-xs tabular-nums">
                    <b class="${saude.texto}">${qtd}</b> <span class="text-gray-400">·</span> ${pct}%
                </div>
                <div class="w-36 shrink-0 text-right text-[11px] tabular-nums text-gray-500 hidden md:block">${_cfFmt(orc)}</div>
                <div class="w-5 shrink-0 text-center" title="Saúde agregada da fase">${saude.emoji}</div>
            </div>`;
    }).join('');

    const somaDesfechos = cancelados.length + reprovados.length + hold.length;
    const somaTotal = somaFases + somaDesfechos;
    const bate = somaTotal === total;

    const satelite = (rot, arr, cls, icone) => `
        <div class="bg-white rounded-lg border ${cls} p-3 text-center">
            <div class="text-[10px] font-bold uppercase text-gray-500">${icone} ${rot}</div>
            <div class="text-xl font-extrabold tabular-nums text-gray-800">${arr.length}</div>
            <div class="text-[10px] text-gray-400 tabular-nums">${_cfFmt(arr.reduce((a, p) => a + _cfOrc(p), 0))}</div>
        </div>`;

    alvo.innerHTML = `
        <section class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-extrabold text-gray-900 text-sm uppercase tracking-wide">Consolidação do Portfólio por Fase</h3>
                <span class="text-[11px] font-bold tabular-nums ${bate ? 'text-gray-400' : 'text-red-600'}">
                    ${bate
                        ? `Σ ${somaFases} fases + ${somaDesfechos} desfechos = ${total} (confere)`
                        : `⚠ inconsistência: Σ fases ${somaFases} + desfechos ${somaDesfechos} = ${somaTotal} ≠ total ${total}`}
                </span>
            </div>
            <div class="mb-4">${linhas}</div>
            <div class="text-[10px] font-bold uppercase text-gray-400 mb-2">Fora do fluxo linear</div>
            <div class="grid grid-cols-3 gap-3">
                ${satelite('Cancelados', cancelados, 'border-gray-200', '🚫')}
                ${satelite('Reprovados', reprovados, 'border-red-200', '❌')}
                ${satelite('Em Hold', hold, 'border-amber-200', '⏸️')}
            </div>
        </section>`;
}
