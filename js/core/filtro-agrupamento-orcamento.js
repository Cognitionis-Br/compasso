// =========================================================================
// core/filtro-agrupamento-orcamento.js
// NOVO (Agrupamento de Orçamento por Área e Produto — itens 4/5/6/7).
//
// Estado ISOLADO do agrupamento de orçamento, compartilhado por Dashboard
// e Visão de Orçamento (Financeiro). Mesmo espírito de filtro-af-visao.js.
//
// >>> PONTO DE EXTENSÃO FUTURO <<<
// Hoje a escolha vive nas telas (dois seletores). Para virar um parâmetro
// persistido (como percentual_bloqueio_variacao), basta trocar a ORIGEM
// do valor em obterAgrupamentoOrcamento() — ler de uma tabela de config
// em vez das variáveis abaixo. Nenhuma tela que consome
// filtrarProjetosPorAgrupamento() / rotuloAgrupamentoAtivo() /
// mesmoSubgrupoOrcamento() precisa mudar.
// =========================================================================

// 'AF' (padrão) | 'AREA' | 'PRODUTO'
let modoAgrupamentoOrcamento = 'AF';
// Código/valor do subgrupo escolhido: nome da ÁREA (upper) ou id do PRODUTO.
let valorAgrupamentoSelecionado = null;

// Fonte única de verdade — trocar aqui pra ler de config persistida no futuro.
function obterAgrupamentoOrcamento() {
    return { modo: modoAgrupamentoOrcamento, valor: valorAgrupamentoSelecionado };
}

// -------------------------------------------------------------------------
// Filtro — aplicado DEPOIS dos filtros de Ano Fiscal e de restrição de área
// (compõe com eles por AND). Modo 'AF' não filtra nada aqui.
// -------------------------------------------------------------------------
function filtrarProjetosPorAgrupamento(lista, modo, valor) {
    modo = modo || 'AF';
    if (modo === 'AF' || !valor) return lista;
    if (modo === 'AREA') {
        const alvo = String(valor).trim().toUpperCase();
        return lista.filter(p => (p.area || '').trim().toUpperCase() === alvo);
    }
    if (modo === 'PRODUTO') {
        return lista.filter(p => String(p.produto_id) === String(valor));
    }
    return lista;
}

// Dois projetos estão no mesmo subgrupo orçamentário? (item 7)
// Modo 'AF' => sem restrição de subgrupo (sempre true).
function mesmoSubgrupoOrcamento(projA, projB, modo) {
    modo = modo || obterAgrupamentoOrcamento().modo;
    if (!projA || !projB) return false;
    if (modo === 'AF') return true;
    if (modo === 'AREA') {
        return (projA.area || '').trim().toUpperCase() === (projB.area || '').trim().toUpperCase();
    }
    if (modo === 'PRODUTO') {
        return String(projA.produto_id) === String(projB.produto_id);
    }
    return true;
}

// -------------------------------------------------------------------------
// Rótulos / UI
// -------------------------------------------------------------------------
function nomeProdutoPorId(id) {
    const p = (typeof produtosCache !== 'undefined' ? produtosCache : []).find(x => String(x.id) === String(id));
    return p ? `${p.codigo} - ${p.nome}` : `Produto #${id}`;
}

function rotuloAgrupamentoAtivo() {
    const { modo, valor } = obterAgrupamentoOrcamento();
    if (modo === 'AREA' && valor) return `Área — ${valor}`;
    if (modo === 'PRODUTO' && valor) return `Produto — ${nomeProdutoPorId(valor)}`;
    return 'Ano Fiscal';
}

// Garante que áreas e produtos estejam carregados pros seletores.
async function garantirDadosAgrupamento() {
    if (typeof areasData === 'undefined' || !areasData || areasData.length === 0) {
        if (typeof loadAreas === 'function') await loadAreas();
    }
    if (typeof produtosCache === 'undefined' || !produtosCache || produtosCache.length === 0) {
        if (typeof carregarProdutosData === 'function') await carregarProdutosData();
    }
}

// Popula o 2º seletor (qual área / qual produto) conforme o modo.
function popularSeletorSubgrupo(selectId, modo) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    let opts = '<option value="" selected disabled>-- SELECIONE --</option>';
    if (modo === 'AREA') {
        const areas = (typeof areasAtivas === 'function' ? areasAtivas() : (areasData || []))
            .slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        opts += areas.map(a => {
            const nome = (a.nome || '').toUpperCase();
            return `<option value="${nome}" ${valorAgrupamentoSelecionado === nome ? 'selected' : ''}>${nome}</option>`;
        }).join('');
    } else if (modo === 'PRODUTO') {
        const prods = (typeof produtosSelecionaveis === 'function' ? produtosSelecionaveis() : (produtosCache || []).filter(p => p.ativo))
            .slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        opts += prods.map(p => `<option value="${p.id}" ${String(valorAgrupamentoSelecionado) === String(p.id) ? 'selected' : ''}>${p.codigo} - ${p.nome}</option>`).join('');
    }
    sel.innerHTML = opts;
}

// -------------------------------------------------------------------------
// Handlers dos seletores (um HTML compartilhado, renderizado por
// renderSeletorAgrupamento — ver dashboard.js / visao-orcamento.js).
// onAoRenderizar = callback que re-renderiza a tela dona.
// -------------------------------------------------------------------------
async function renderSeletorAgrupamento(containerId, onAoRenderizar) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    await garantirDadosAgrupamento();

    const modo = modoAgrupamentoOrcamento;
    cont.dataset.callback = onAoRenderizar || '';
    cont.innerHTML = `
        <div class="flex items-end gap-3 flex-wrap bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3">
            <div>
                <label class="block text-[10px] font-bold uppercase text-gray-500 mb-1">Agrupar orçamento por</label>
                <select onchange="onMudarModoAgrupamento('${containerId}')" id="${containerId}_modo" class="p-2 border border-gray-300 rounded text-xs bg-white font-bold">
                    <option value="AF" ${modo === 'AF' ? 'selected' : ''}>Ano Fiscal</option>
                    <option value="AREA" ${modo === 'AREA' ? 'selected' : ''}>Área</option>
                    <option value="PRODUTO" ${modo === 'PRODUTO' ? 'selected' : ''}>Produto</option>
                </select>
            </div>
            <div class="${modo === 'AF' ? 'hidden' : ''}">
                <label class="block text-[10px] font-bold uppercase text-gray-500 mb-1">${modo === 'PRODUTO' ? 'Produto' : 'Área'}</label>
                <select onchange="onMudarValorAgrupamento('${containerId}')" id="${containerId}_valor" class="p-2 border border-gray-300 rounded text-xs bg-white font-bold min-w-[220px]"></select>
            </div>
            <div class="text-[11px] text-gray-500 pb-1">Visão por: <b class="text-gray-800">${rotuloAgrupamentoAtivo()}</b></div>
        </div>
    `;
    if (modo !== 'AF') popularSeletorSubgrupo(`${containerId}_valor`, modo);
}

function _dispararCallbackAgrupamento(containerId) {
    const cont = document.getElementById(containerId);
    const cb = cont && cont.dataset.callback;
    if (cb && typeof window[cb] === 'function') window[cb]();
}

function onMudarModoAgrupamento(containerId) {
    modoAgrupamentoOrcamento = document.getElementById(`${containerId}_modo`).value;
    valorAgrupamentoSelecionado = null; // zera a escolha do subgrupo ao trocar de modo
    renderSeletorAgrupamento(containerId, document.getElementById(containerId).dataset.callback)
        .then(() => _dispararCallbackAgrupamento(containerId));
}

function onMudarValorAgrupamento(containerId) {
    const v = document.getElementById(`${containerId}_valor`).value;
    valorAgrupamentoSelecionado = v || null;
    // atualiza só o texto "Visão por:" sem re-render completo do seletor
    renderSeletorAgrupamento(containerId, document.getElementById(containerId).dataset.callback)
        .then(() => _dispararCallbackAgrupamento(containerId));
}

// -------------------------------------------------------------------------
// Quadro de valores (item 6) — substitui os KPI cards no Dashboard e na
// Visão de Orçamento. Recebe a lista JÁ filtrada por Ano Fiscal + área
// (RBAC); aplica aqui o filtro de agrupamento e quebra CAPEX/OPEX
// reaproveitando calcularCapexOpex().
//   Orçamento Fechado  = Σ val_bc/previsto dos projetos oficiais (não
//                        adhoc, não carryover, não cancelado/hold/reprovado)
//   Orç. Extraordinário = Σ val_bc/previsto dos is_adhoc ativos
//   Orç. Carry Over    = Σ valor_carryover dos is_carryover
//   Orçamento Atual    = Fechado + Extraordinário + Carry Over
//   Valores Já Realizados = Σ realizado dos ativos
//   Orçamento a Realizar  = Orçamento Atual − Realizados   (substitui "Projeção Final")
// -------------------------------------------------------------------------
function renderQuadroOrcamentoAgrupado(prefixo, listaAF) {
    const cont = document.getElementById(`${prefixo}QuadroOrcamento`);
    if (!cont) return;
    if (typeof calcularCapexOpex !== 'function') { cont.innerHTML = ''; return; }

    const { modo, valor } = obterAgrupamentoOrcamento();
    const lista = filtrarProjetosPorAgrupamento(listaAF || [], modo, valor);
    const inativo = p => ['CANCELADO', 'REPROVADO', 'HOLD'].includes((p.sub_status || '').toUpperCase());

    const ativos  = lista.filter(p => !inativo(p));
    const adhoc   = ativos.filter(p => p.is_adhoc === true);
    const carry   = lista.filter(p => p.is_carryover === true);
    const oficial = ativos.filter(p => p.is_adhoc !== true && p.is_carryover !== true);

    // NOVO (a pedido do usuário): duas linhas de CONTAGEM no topo do quadro.
    // Linha A - "Total de Projetos para Gerar Orçamento": réplica da linha
    //   do quadro "Projetos na Criação do Ano Fiscal" - demandas normais
    //   ainda em Business Case, sem orçamento definido: A PLANEJAR/PLANEJADO.
    // Linha B - "Total de Projetos com Orçamento": os que efetivamente
    //   compõem o orçamento do AF em andamento - carryover; Extraordinárias
    //   já incluídas, fora do BC; e projetos normais que já saíram do BC ou
    //   que já foram APROVADOS no comitê. Cancelado/Reprovado/Hold ficam de
    //   fora das duas.
    const paraGerarOrcamento = lista.filter(p =>
        p.is_adhoc !== true && p.is_carryover !== true &&
        (p.etapa_atual || 'BUSINESS CASE').toUpperCase() === 'BUSINESS CASE' &&
        ['A PLANEJAR', 'PLANEJADO', '', null, undefined].includes(p.sub_status)
    );
    const compoeOrcamentoAF = p => {
        if (inativo(p)) return false;
        if (p.is_carryover === true) return true;
        const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        if (etapa !== 'BUSINESS CASE') return true;
        return (p.sub_status || '').toUpperCase() === 'APROVADO';
    };
    const projetosOrcamento = lista.filter(compoeOrcamentoAF);
    const contarTipoEm = (arr, t) => arr.filter(p => (p.tipo_orcamento || '').toUpperCase() === t).length;

    const fechado   = calcularCapexOpex(oficial);
    const extra     = calcularCapexOpex(adhoc);
    const carryv    = calcularCapexOpex(carry, p => Number(p.valor_carryover) || 0);
    const realizado = calcularCapexOpex(ativos);

    const g = (o, k) => o[k].orcado;
    const r = (o, k) => o[k].realizado;
    const linhas = {
        fechadoCx: g(fechado, 'capex'),  fechadoOx: g(fechado, 'opex'),
        extraCx:   g(extra, 'capex'),    extraOx:   g(extra, 'opex'),
        carryCx:   g(carryv, 'capex'),   carryOx:   g(carryv, 'opex'),
        realCx:    r(realizado, 'capex'), realOx:   r(realizado, 'opex'),
    };
    linhas.atualCx = linhas.fechadoCx + linhas.extraCx + linhas.carryCx;
    linhas.atualOx = linhas.fechadoOx + linhas.extraOx + linhas.carryOx;
    linhas.aRealizarCx = linhas.atualCx - linhas.realCx;
    linhas.aRealizarOx = linhas.atualOx - linhas.realOx;

    const contarTipo = t => lista.filter(p => (p.tipo_orcamento || '').toUpperCase() === t).length;
    const fmt = v => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // rot=rótulo | opt: {ac: classe da faixa de destaque à esquerda,
    //   forte: linha em negrito/fundo, sinal: colore o valor por sinal (a realizar)}
    const linha = (rot, tot, cx, ox, opt = {}) => {
        const dinheiro = opt.contagem !== true;
        const corValor = v => opt.sinal ? (v < 0 ? 'text-red-700' : 'text-emerald-700') : '';
        const tdV = (v, extra = '') => `<td class="p-2 text-right font-mono tabular-nums ${extra} ${dinheiro ? corValor(v) : 'text-gray-900'}">${dinheiro ? fmt(v) : v}</td>`;
        return `
        <tr class="${opt.forte ? 'bg-slate-50 font-bold' : ''}">
            <td class="p-2 pl-3 uppercase text-[11px] tracking-wide font-bold text-gray-600 border-l-4 ${opt.ac || 'border-l-transparent'}">${rot}</td>
            ${tdV(tot, opt.forte ? 'font-extrabold text-gray-900' : 'font-bold')}
            ${tdV(cx, 'text-blue-800')}
            ${tdV(ox, 'text-purple-800')}
        </tr>`;
    };

    cont.innerHTML = `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div class="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-layer-group opacity-70"></i>
                Visão por: <span class="text-amber-300">${rotuloAgrupamentoAtivo()}</span>
            </div>
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead><tr class="text-[10px] uppercase tracking-wider text-gray-400 border-b bg-gray-50">
                    <th class="p-2 pl-3 text-left">Linha</th>
                    <th class="p-2 text-right">Total</th>
                    <th class="p-2 text-right text-blue-700">CAPEX</th>
                    <th class="p-2 text-right text-purple-700">OPEX</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${linha('Total de Projetos para Gerar Orçamento', paraGerarOrcamento.length, contarTipoEm(paraGerarOrcamento, 'CAPEX'), contarTipoEm(paraGerarOrcamento, 'OPEX'), { contagem: true, ac: 'border-l-blue-300' })}
                    ${linha('Total de Projetos com Orçamento', projetosOrcamento.length, contarTipoEm(projetosOrcamento, 'CAPEX'), contarTipoEm(projetosOrcamento, 'OPEX'), { contagem: true, ac: 'border-l-gray-300' })}
                    ${linha('Orçamento Fechado', linhas.fechadoCx + linhas.fechadoOx, linhas.fechadoCx, linhas.fechadoOx, { ac: 'border-l-slate-400' })}
                    ${linha('Orçamento Projetos Extraordinário', linhas.extraCx + linhas.extraOx, linhas.extraCx, linhas.extraOx, { ac: 'border-l-amber-400' })}
                    ${linha('Orçamento Carry Over', linhas.carryCx + linhas.carryOx, linhas.carryCx, linhas.carryOx, { ac: 'border-l-orange-400' })}
                    ${linha('Orçamento Atual', linhas.atualCx + linhas.atualOx, linhas.atualCx, linhas.atualOx, { ac: 'border-l-indigo-500', forte: true })}
                    ${linha('Valores Já Realizados', linhas.realCx + linhas.realOx, linhas.realCx, linhas.realOx, { ac: 'border-l-red-400' })}
                    ${linha('Orçamento a Realizar', linhas.aRealizarCx + linhas.aRealizarOx, linhas.aRealizarCx, linhas.aRealizarOx, { ac: 'border-l-emerald-500', forte: true, sinal: true })}
                </tbody>
            </table>
            </div>
        </div>
    `;
}
