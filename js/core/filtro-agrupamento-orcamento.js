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
