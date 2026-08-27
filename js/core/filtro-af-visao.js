// =========================================================================
// core/filtro-af-visao.js
// NOVO (a pedido do usuário): filtro compartilhado de Ano Fiscal pra
// Dashboard e Roadmap. O sistema hoje pode ter projetos em 3 situações
// diferentes de AF ao mesmo tempo:
// - AF Corrente: projetos normais do ano fiscal em vigor + TODOS os
//   Carryover (independente de qual AF eles carregam gravado)
// - Próximo AF (Pipeline): projetos ainda em Business Case já com o
//   próximo AF, formando fila antes da abertura formal
// - Todos: visão consolidada, sem filtro
//
// Em vez de duas telas separadas por AF, um seletor único no topo do
// Dashboard e do Roadmap, com uma faixa visível mostrando a seleção
// atual — mesma lógica de filtro reaproveitada nos dois lugares.
// =========================================================================

// NOVO (a pedido do usuário — correção do bug de "orçamento fechado"
// global): isOrcamentoGlobalFechado() (fiscal-year.js) checava TODOS os
// projetos do sistema juntos, sem separar por Ano Fiscal — bastava UM
// projeto de QUALQUER AF (inclusive Carryover de anos anteriores) já
// estar além do Business Case pra o sistema achar que o AF corrente
// também estava fechado. Esse helper busca a config real de cada AF e
// permite checar "fechado" por AF específico — usado em Dashboard e
// Visão de Orçamento.
async function construirMapaFechamentoAF() {
    const { data } = await _supabase.from('anos_fiscais_config').select('*');
    const configsPorAF = {};
    (data || []).forEach(c => { configsPorAF[c.ano_fiscal] = c; });
    return function isFechadoParaAF(afStr) {
        const cfg = configsPorAF[afStr];
        return cfg ? cfg.orcamento_fechado === true : false;
    };
}

let modoAFDashboard = 'corrente';
let modoAFRoadmap = 'corrente';
let modoAFVisaoOrcamento = 'corrente';
// NOVO (a pedido do usuário 25/08/2026): tela de Consultas — padrão
// "todos", diferente das demais telas, porque é uma ferramenta de busca
// no portfólio inteiro (não uma visão operacional de um AF específico).
let modoAFConsulta = 'todos';

// Regra central: Carryover sempre conta como "corrente", não importa o
// ano_fiscal gravado nele — é essa a causa do problema original (projetos
// Carryover sumindo da visão corrente porque o filtro olhava só pro
// campo ano_fiscal, ignorando a marcação de Carryover).
function filtrarProjetosPorAnoFiscalSelecionado(lista, modoAF) {
    const infoAF = getInfoAnoFiscal();
    if (modoAF === 'todos') return lista;

    if (modoAF === 'proximo') {
        return lista.filter(p => p.ano_fiscal === infoAF.proximoAFStr && (p.etapa_atual || 'BUSINESS CASE').toUpperCase() === 'BUSINESS CASE');
    }

    // 'corrente' (padrão)
    return lista.filter(p => p.ano_fiscal === infoAF.afAtualStr || p.is_carryover === true);
}

function renderFaixaAFSelecionado(containerId, modoAF) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const infoAF = getInfoAnoFiscal();
    const CONFIG_FAIXA = {
        corrente: { cor: 'bg-indigo-50 border-indigo-300 text-indigo-800', icone: 'fa-calendar-check', texto: `Ano Fiscal Corrente — ${infoAF.afAtualStr}`, sub: 'Projetos normais deste Ano Fiscal + todos os projetos Carryover, independente do Ano Fiscal de origem deles.' },
        proximo: { cor: 'bg-amber-50 border-amber-300 text-amber-800', icone: 'fa-forward', texto: `Próximo Ano Fiscal (Pipeline) — ${infoAF.proximoAFStr}`, sub: 'Só projetos ainda em Business Case já registrados para o próximo Ano Fiscal — a fila se formando antes da abertura formal.' },
        todos: { cor: 'bg-gray-50 border-gray-300 text-gray-700', icone: 'fa-layer-group', texto: 'Todos os Anos Fiscais', sub: 'Visão consolidada do portfólio inteiro, sem filtro de Ano Fiscal.' }
    };
    const cfg = CONFIG_FAIXA[modoAF] || CONFIG_FAIXA.corrente;

    container.innerHTML = `
        <div class="${cfg.cor} border-2 rounded-lg px-4 py-3 flex items-center gap-3">
            <i class="fa-solid ${cfg.icone} text-lg"></i>
            <div>
                <div class="font-bold text-sm">${cfg.texto}</div>
                <div class="text-[11px] opacity-80">${cfg.sub}</div>
            </div>
        </div>
    `;
}

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
