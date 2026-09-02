// =========================================================================
// core/filtro-af-visao.js
// Filtro compartilhado de Ano Fiscal — Dashboard, Roadmap, Visão de
// Orçamento (Financeiro) e Consulta de Projetos.
//
// AJUSTADO (2026-09-02, a pedido do usuário): o seletor deixou de ter 3
// opções fixas calculadas pela DATA do dia ("Corrente / Próximo / Todos")
// e passou a ser populado a partir da tabela `anos_fiscais_config` — os
// Anos Fiscais que existem de verdade (ex.: AF2026, AF2027), mais:
//   - "Próximo (Pipeline)": só as demandas em Business Case do AF que ainda
//     está em orçamentação;
//   - "Todos os Anos Fiscais": visão consolidada.
// Projetos Carryover continuam aparecendo junto de qualquer AF específico
// selecionado (regra central de sempre).
// =========================================================================

// ---- config real dos Anos Fiscais (cache) --------------------------------
let anosFiscaisListaCache = [];

async function carregarAnosFiscaisLista() {
    const { data } = await _supabase
        .from('anos_fiscais_config')
        .select('ano_fiscal, orcamento_fechado, ano_fiscal_fechado, recebimento_demandas_aberto, fechado_por, fechado_em, af_fechado_por, af_fechado_em')
        .order('ano_fiscal', { ascending: true });
    anosFiscaisListaCache = data || [];
    return anosFiscaisListaCache;
}

// AF "em andamento / em desenvolvimento": orçamento já fechado e o Ano
// Fiscal ainda NÃO encerrado. É o padrão do seletor. Fallback: o AF
// corrente calculado pela data.
function afEmAndamentoStr() {
    const cand = (anosFiscaisListaCache || []).find(c => c.orcamento_fechado === true && c.ano_fiscal_fechado !== true);
    if (cand) return cand.ano_fiscal;
    const info = (typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal() : null;
    return info ? info.afAtualStr : ((anosFiscaisListaCache[0] || {}).ano_fiscal || null);
}

// AF "em orçamentação / pipeline": ainda sem o orçamento fechado. Fallback:
// o próximo AF calculado pela data.
function afPipelineStr() {
    const cands = (anosFiscaisListaCache || []).filter(c => c.orcamento_fechado !== true);
    if (cands.length) return cands[cands.length - 1].ano_fiscal;
    const info = (typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal() : null;
    return info ? info.proximoAFStr : null;
}

// Normaliza valores antigos ('corrente' / 'proximo') caso o seletor ainda
// não tenha sido repopulado.
function normalizarModoAF(modoAF) {
    if (modoAF === 'corrente') return afEmAndamentoStr();
    if (modoAF === 'proximo') return 'pipeline';
    return modoAF;
}

// ---- estado por tela ----------------------------------------------------
let modoAFDashboard = null;        // resolvido para afEmAndamentoStr() no 1º render
let modoAFRoadmap = null;
let modoAFVisaoOrcamento = null;
// Consulta de Projetos: padrão "todos" (ferramenta de busca no portfólio).
let modoAFConsulta = 'todos';

// ---- helper de fechamento por AF (inalterado) -------------------------
async function construirMapaFechamentoAF() {
    const { data } = await _supabase.from('anos_fiscais_config').select('*');
    const configsPorAF = {};
    (data || []).forEach(c => { configsPorAF[c.ano_fiscal] = c; });
    return function isFechadoParaAF(afStr) {
        const cfg = configsPorAF[afStr];
        return cfg ? cfg.orcamento_fechado === true : false;
    };
}

// ---- filtro -----------------------------------------------------------
function filtrarProjetosPorAnoFiscalSelecionado(lista, modoAF) {
    modoAF = normalizarModoAF(modoAF) || afEmAndamentoStr();
    if (!modoAF || modoAF === 'todos') return lista;

    if (modoAF === 'pipeline') {
        const af = afPipelineStr();
        return lista.filter(p => p.ano_fiscal === af && (p.etapa_atual || 'BUSINESS CASE').toUpperCase() === 'BUSINESS CASE');
    }

    // AF específico: projetos daquele Ano Fiscal + todos os Carryover.
    return lista.filter(p => p.ano_fiscal === modoAF || p.is_carryover === true);
}

// ---- selector -------------------------------------------------------
// Repopula um &lt;select&gt; de Ano Fiscal com os AFs reais + Pipeline + Todos.
function popularSeletorAF(selectId, modoAtual) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const alvo = normalizarModoAF(modoAtual) || afEmAndamentoStr();
    const pipeline = afPipelineStr();

    const opts = (anosFiscaisListaCache || []).map(c => {
        let tag = '';
        if (c.ano_fiscal_fechado === true) tag = ' — fechado';
        else if (c.orcamento_fechado === true) tag = ' — em andamento';
        else if (c.recebimento_demandas_aberto === true) tag = ' — em orçamentação';
        return `<option value="${c.ano_fiscal}" ${c.ano_fiscal === alvo ? 'selected' : ''}>Ano Fiscal ${c.ano_fiscal}${tag}</option>`;
    });
    opts.push(`<option value="pipeline" ${alvo === 'pipeline' ? 'selected' : ''}>Próximo (Pipeline)${pipeline ? ' — ' + pipeline : ''}</option>`);
    opts.push(`<option value="todos" ${alvo === 'todos' ? 'selected' : ''}>Todos os Anos Fiscais</option>`);
    sel.innerHTML = opts.join('');
}

// Prepara o seletor de uma tela (SÍNCRONO — assume o cache já carregado no
// boot). Resolve o modo padrão, repopula o &lt;select&gt; e devolve o modo
// resolvido para a tela guardar de volta na sua variável modoAF*.
function montarSeletorAF(selectId, modoAtual) {
    const resolvido = normalizarModoAF(modoAtual) || afEmAndamentoStr();
    popularSeletorAF(selectId, resolvido);
    return resolvido;
}

function renderFaixaAFSelecionado(containerId, modoAF) {
    const container = document.getElementById(containerId);
    if (!container) return;
    modoAF = normalizarModoAF(modoAF) || afEmAndamentoStr();

    let cor, icone, texto, sub;
    if (modoAF === 'todos') {
        cor = 'bg-gray-50 border-gray-300 text-gray-700'; icone = 'fa-layer-group';
        texto = 'Todos os Anos Fiscais';
        sub = 'Visão consolidada do portfólio inteiro, sem filtro de Ano Fiscal.';
    } else if (modoAF === 'pipeline') {
        const af = afPipelineStr();
        cor = 'bg-amber-50 border-amber-300 text-amber-800'; icone = 'fa-forward';
        texto = `Próximo Ano Fiscal (Pipeline)${af ? ' — ' + af : ''}`;
        sub = 'Só demandas ainda em Business Case do Ano Fiscal que está em orçamentação — a fila se formando antes da abertura formal.';
    } else {
        const cfg = (anosFiscaisListaCache || []).find(c => c.ano_fiscal === modoAF);
        let estado = 'sem registro em anos_fiscais_config';
        if (cfg) {
            if (cfg.ano_fiscal_fechado === true) estado = `Ano Fiscal fechado${cfg.af_fechado_por ? ' por ' + cfg.af_fechado_por : ''}`;
            else if (cfg.orcamento_fechado === true) estado = 'orçamento fechado, Ano Fiscal em andamento';
            else if (cfg.recebimento_demandas_aberto === true) estado = 'em orçamentação (aberto para demandas)';
            else estado = 'aberto';
        }
        cor = 'bg-indigo-50 border-indigo-300 text-indigo-800'; icone = 'fa-calendar-check';
        texto = `Ano Fiscal ${modoAF}`;
        sub = `Projetos do ${modoAF} + todos os projetos Carryover. Situação: ${estado}.`;
    }

    container.innerHTML = `
        <div class="${cor} border-2 rounded-lg px-4 py-3 flex items-center gap-3">
            <i class="fa-solid ${icone} text-lg"></i>
            <div>
                <div class="font-bold text-sm">${texto}</div>
                <div class="text-[11px] opacity-80">${sub}</div>
            </div>
        </div>
    `;
}

// ---- handlers ------------------------------------------------------
function onMudarSeletorAFDashboard() {
    modoAFDashboard = document.getElementById('dashSeletorAF').value;
    renderFaixaAFSelecionado('dashFaixaAFSelecionado', modoAFDashboard);
    renderDashboardMetrics();
}

function onMudarSeletorAFRoadmap() {
    modoAFRoadmap = document.getElementById('roadmapSeletorAF').value;
    renderFaixaAFSelecionado('roadmapFaixaAFSelecionado', modoAFRoadmap);
    renderRoadmap();
}

function onMudarSeletorAFVisaoOrcamento() {
    modoAFVisaoOrcamento = document.getElementById('visaoOrcSeletorAF').value;
    renderVisaoOrcamentoView();
}

function onMudarSeletorAFConsulta() {
    modoAFConsulta = document.getElementById('consultaSeletorAF').value;
    renderFaixaAFSelecionado('consultaFaixaAFSelecionado', modoAFConsulta);
    renderConsultaProjetos();
}
