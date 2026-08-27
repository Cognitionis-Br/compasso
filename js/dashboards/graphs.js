// =========================================================================
// dashboards/graphs.js
// Gráficos Plotly do dashboard: funil de fases, orçado vs. realizado por
// área, e farol de saúde do portfólio. Chamados por
// dashboards/dashboard.js ao fim de renderTabelaConsolidacaoPortfolio.
// =========================================================================
// AJUSTADO (a pedido do usuário): as 3 funções passam a aceitar a lista
// já filtrada por Ano Fiscal como parâmetro — antes usavam projectsData
// direto e ignoravam o seletor de Fiscal Year do Dashboard.
function renderGraphFunilFases(listaFiltrada) {
    const listaBase = listaFiltrada || projectsData;
    const etapas = ['BUSINESS CASE', 'REQUIREMENTS', 'TECHNICAL', 'EXECUTION', 'UAT', 'GO LIVE', 'CONCLUIDO'];
    const counts = etapas.map(e => listaBase.filter(p => {
        const etapaPrj = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'CANCELADO' || sub === 'REPROVADO') return false;
        if (e === 'BUSINESS CASE' && (etapaPrj === 'BUSINESS CASE' || etapaPrj === '')) return true;
        return etapaPrj === e;
    }).length);

    if (document.getElementById('chartFunilFases')) {
        Plotly.newPlot('chartFunilFases', [{
            y: etapas, x: counts, type: 'bar', orientation: 'h',
            marker: { color: ['#EF4444', '#F59E0B', '#3B82F6', '#06B6D4', '#14B8A6', '#10B981', '#059669'] },
            text: counts.map(String), textposition: 'auto'
        }], { margin: { t: 10, b: 30, l: 120, r: 20 }, xaxis: { title: 'Qtd Projetos' } }, { responsive: true });
    }
}

function renderGraphOrcadoVsRealizadoUn(listaFiltrada) {
    const listaBase = listaFiltrada || projectsData;
    const uns = [...new Set(listaBase.map(p => p.area || 'GERAL'))];
    const orcadoVals = uns.map(un => listaBase.filter(p => (p.area || 'GERAL') === un).reduce((a, b) => a + (Number(b.val_bc) || Number(b.previsto) || 0), 0));
    const realizadoVals = uns.map(un => listaBase.filter(p => (p.area || 'GERAL') === un).reduce((a, b) => a + (Number(b.realizado) || 0), 0));

    if (document.getElementById('chartOrcadoVsRealizadoUn')) {
        // CORRIGIDO 10/08/2026 (bug reportado: nomes truncados no eixo X):
        // margem inferior fixa era pequena demais pra nomes longos de
        // área. automargin deixa o Plotly calcular o espaço necessário
        // sozinho, e tickangle inclina o texto pra caber melhor.
        Plotly.newPlot('chartOrcadoVsRealizadoUn', [
            { name: 'Previsto ($)', x: uns, y: orcadoVals, type: 'bar', marker: { color: '#1E3A8A' } },
            { name: 'Realizado ($)', x: uns, y: realizadoVals, type: 'bar', marker: { color: '#EB0A1E' } }
        ], {
            barmode: 'group',
            margin: { t: 10, b: 80, l: 50, r: 10 },
            xaxis: { automargin: true, tickangle: -30 }
        }, { responsive: true });
    }
}

function renderGraphFarolSaude(listaFiltrada) {
    const listaBase = listaFiltrada || projectsData;
    let saudavel = 0, emAtencao = 0, critico = 0, inativo = 0;

    listaBase.forEach(p => {
        const saude = calcularSaudeProjeto(p);
        if (saude.status === 'INATIVO') inativo++;
        else if (saude.status === 'CRITICO') critico++;
        else if (saude.status === 'ATENCAO' || saude.status === 'HOLD') emAtencao++;
        else saudavel++;
    });

    if (document.getElementById('chartFarolSaude')) {
        Plotly.newPlot('chartFarolSaude', [{
            labels: ['Saudável (Verde)', 'Em Atenção / Hold (Amarelo)', 'Crítico / Vencido (Vermelho)', 'Inativo / Cancelado'],
            values: [saudavel, emAtencao, critico, inativo],
            type: 'pie',
            marker: { colors: ['#10B981', '#F59E0B', '#EF4444', '#9CA3AF'] }
        }], { margin: { t: 10, b: 10, l: 10, r: 10 } }, { responsive: true });
    }
}
