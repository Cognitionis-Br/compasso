// =========================================================================
// ano-fiscal/resultado-af.js
// Aba "Avaliação e Fechamento Ano Fiscal" (tela fechamento_af) — conteúdo
// de resultado consolidado. O Ano Fiscal alvo vem de fechamentoAfTargetAF()
// (js/ano-fiscal/fechamento-af.js), não há seletor de AF aqui.
//
// Visão consolidada de um Ano Fiscal (fechado ou em fechamento):
//   Seção A — Contagem de projetos: concluídos e "em andamento" desmembrado
//             em carryover (andamento), hold, cancelados, reprovados, sem decisão.
//   Seção B — Orçamento por fase (Total / CAPEX / OPEX): aprovado (val_bc),
//             após requerimentos (val_req), após especificação (val_tech),
//             realizado, e Saldo Final = aprovado − realizado.
//   Seção C — Quadro consolidado por categoria (reusa renderQuadroOrcamentoAgrupado:
//             Fechado / Extraordinário / Carry Over Andamento / Carry Over Hold /
//             Atual / Realizados / a Realizar).
//   Seção D — Destaques: orçamento total de Cancelados, Hold e Carry Over.
//
// Quebra por Área / Produto via o seletor de agrupamento compartilhado
// (mesmo estado global do Dashboard e do Financeiro). Só consulta.
// =========================================================================

let resultadoAfSelecionado = null; // afStr

function fmtRes(v) {
    return (typeof formatCurrency === 'function')
        ? formatCurrency(v)
        : 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function subHold(p)      { return (p.sub_status || '').toUpperCase() === 'HOLD'; }
function subCancelado(p) { return (p.sub_status || '').toUpperCase() === 'CANCELADO'; }
function subReprovado(p) { return (p.sub_status || '').toUpperCase() === 'REPROVADO'; }

async function renderResultadoAfView() {
    const cont = document.getElementById('resultadoAfConteudo');
    if (!cont) return;

    // AF alvo = o que está sendo encerrado (definido na tela pai fechamento_af).
    resultadoAfSelecionado = (typeof fechamentoAfTargetAF === 'function')
        ? fechamentoAfTargetAF()
        : ((typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal().afAtualStr : null);

    if (typeof renderSeletorAgrupamento === 'function') {
        await renderSeletorAgrupamento('resultadoAfSeletorAgrupamento', 'renderResultadoAfView');
    }

    const modoAgr = (typeof modoAgrupamentoOrcamento !== 'undefined') ? modoAgrupamentoOrcamento : 'AF';
    const valAgr = (typeof valorAgrupamentoSelecionado !== 'undefined') ? valorAgrupamentoSelecionado : null;

    let lista = (projectsData || []).filter(p =>
        p.is_subprojeto !== true &&
        (p.ano_fiscal === resultadoAfSelecionado || p.is_carryover === true)
    );
    if (typeof filtrarProjetosPorAgrupamento === 'function') {
        lista = filtrarProjetosPorAgrupamento(lista, modoAgr, valAgr);
    }

    renderContagemProjetosResultado(lista);
    renderDestaquesResultado(lista);
    renderOrcamentoPorFaseResultado(lista);
    if (typeof renderQuadroOrcamentoAgrupado === 'function') {
        renderQuadroOrcamentoAgrupado('resultadoAf', lista);
    }
}

// ---- Seção A — contagem de projetos ----
function renderContagemProjetosResultado(lista) {
    const el = document.getElementById('resultadoAfContagem');
    if (!el) return;

    const concluidos = lista.filter(p => p.projeto_concluido === true);
    const naoConcluidos = lista.filter(p => p.projeto_concluido !== true);

    const carryAndamento = naoConcluidos.filter(p => p.is_carryover === true && !subHold(p) && !subCancelado(p) && !subReprovado(p));
    const hold = naoConcluidos.filter(subHold);
    const cancelados = naoConcluidos.filter(subCancelado);
    const reprovados = naoConcluidos.filter(subReprovado);
    const semDecisao = naoConcluidos.filter(p => p.is_carryover !== true && !subHold(p) && !subCancelado(p) && !subReprovado(p));

    const linha = (rot, n, cls) => `
        <tr class="${cls || ''}">
            <td class="p-2 pl-3 uppercase text-[11px] tracking-wide font-bold text-gray-600">${rot}</td>
            <td class="p-2 text-right font-mono font-bold">${n}</td>
        </tr>`;

    el.innerHTML = `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div class="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                Contagem de Projetos — ${escapeHtml(resultadoAfSelecionado) || '-'}
            </div>
            <table class="w-full text-sm">
                <tbody class="divide-y divide-gray-100">
                    ${linha('Total de Projetos', lista.length, 'bg-slate-50 font-bold')}
                    ${linha('Concluídos', concluidos.length, '')}
                    ${linha('Em Andamento (total)', naoConcluidos.length, 'bg-slate-50 font-bold')}
                    ${linha('&nbsp;&nbsp;› Carry Over (em andamento)', carryAndamento.length, '')}
                    ${linha('&nbsp;&nbsp;› Hold', hold.length, '')}
                    ${linha('&nbsp;&nbsp;› Cancelados', cancelados.length, '')}
                    ${linha('&nbsp;&nbsp;› Reprovados', reprovados.length, '')}
                    ${linha('&nbsp;&nbsp;› Sem decisão de fechamento', semDecisao.length, '')}
                </tbody>
            </table>
        </div>`;
}

// ---- Seção D — destaques ----
function somaOrcResultado(arr, extractor) {
    return (arr || []).reduce((acc, p) => acc + (Number(extractor(p)) || 0), 0);
}
function renderDestaquesResultado(lista) {
    const el = document.getElementById('resultadoAfDestaques');
    if (!el) return;

    const cancelados = lista.filter(subCancelado);
    const hold = lista.filter(subHold);
    const carryAnd = lista.filter(p => p.is_carryover === true && !subHold(p) && !subCancelado(p));

    const orcUltimo = p => Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
    const orcCarryover = p => Number(p.valor_carryover) || 0;

    const card = (rot, valor, qtd, cls) => `
        <div class="rounded-lg border-2 p-4 ${cls}">
            <div class="text-[10px] font-bold uppercase opacity-70">${rot} (${qtd})</div>
            <div class="text-lg font-extrabold mt-1">${fmtRes(valor)}</div>
        </div>`;

    el.innerHTML =
        card('Orçamento — Cancelados', somaOrcResultado(cancelados, orcUltimo), cancelados.length, 'bg-red-50 border-red-300 text-red-800') +
        card('Orçamento — Hold', somaOrcResultado(hold, orcCarryover), hold.length, 'bg-yellow-50 border-yellow-400 text-yellow-800') +
        card('Orçamento — Carry Over (andamento)', somaOrcResultado(carryAnd, orcCarryover), carryAnd.length, 'bg-orange-50 border-orange-300 text-orange-800');
}

// ---- Seção B — orçamento por fase ----
function renderOrcamentoPorFaseResultado(lista) {
    const el = document.getElementById('resultadoAfOrcFase');
    if (!el || typeof calcularCapexOpex !== 'function') { if (el) el.innerHTML = ''; return; }

    // Base: sem reprovados (não compõem o orçamento do período).
    const base = lista.filter(p => !subReprovado(p));

    const aprovado = calcularCapexOpex(base, p => Number(p.val_bc) || Number(p.previsto) || 0);
    const aposReq  = calcularCapexOpex(base, p => Number(p.val_req) || 0);
    const aposEsp  = calcularCapexOpex(base, p => Number(p.val_tech) || 0);

    const oc = (o, k) => o[k].orcado;
    const rl = (o, k) => o[k].realizado;
    const aprovCx = oc(aprovado, 'capex'), aprovOx = oc(aprovado, 'opex');
    const reqCx = oc(aposReq, 'capex'), reqOx = oc(aposReq, 'opex');
    const espCx = oc(aposEsp, 'capex'), espOx = oc(aposEsp, 'opex');
    const realCx = rl(aprovado, 'capex'), realOx = rl(aprovado, 'opex'); // p.realizado acumulado por tipo
    const saldoCx = aprovCx - realCx, saldoOx = aprovOx - realOx;

    const linha = (rot, tot, cx, ox, opt = {}) => `
        <tr class="${opt.forte ? 'bg-slate-50 font-bold' : ''}">
            <td class="p-2 pl-3 uppercase text-[11px] tracking-wide font-bold text-gray-600 border-l-4 ${opt.ac || 'border-l-transparent'}">${rot}</td>
            <td class="p-2 text-right font-mono ${opt.forte ? 'font-extrabold text-gray-900' : 'font-bold'} ${opt.sinal && tot < 0 ? 'text-red-700' : (opt.sinal ? 'text-emerald-700' : '')}">${fmtRes(tot)}</td>
            <td class="p-2 text-right font-mono text-blue-800">${fmtRes(cx)}</td>
            <td class="p-2 text-right font-mono text-purple-800">${fmtRes(ox)}</td>
        </tr>`;

    el.innerHTML = `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div class="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                Orçamento por Fase — Visão por: ${(typeof rotuloAgrupamentoAtivo === 'function') ? rotuloAgrupamentoAtivo() : 'Ano Fiscal'}
            </div>
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead><tr class="text-[10px] uppercase tracking-wider text-gray-400 border-b bg-gray-50">
                    <th class="p-2 pl-3 text-left">Fase</th><th class="p-2 text-right">Total</th>
                    <th class="p-2 text-right text-blue-700">CAPEX</th><th class="p-2 text-right text-purple-700">OPEX</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${linha('Orçamento Aprovado (Business Case)', aprovCx + aprovOx, aprovCx, aprovOx, { ac: 'border-l-slate-400' })}
                    ${linha('Orçamento Após Requerimentos', reqCx + reqOx, reqCx, reqOx, { ac: 'border-l-purple-400' })}
                    ${linha('Orçamento Após Especificação', espCx + espOx, espCx, espOx, { ac: 'border-l-blue-400' })}
                    ${linha('Valor Realizado', realCx + realOx, realCx, realOx, { ac: 'border-l-red-400' })}
                    ${linha('Saldo Final (Aprovado − Realizado)', saldoCx + saldoOx, saldoCx, saldoOx, { ac: 'border-l-emerald-500', forte: true, sinal: true })}
                </tbody>
            </table>
            </div>
        </div>`;
}
