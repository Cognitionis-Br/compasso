// =========================================================================
// financeiro-corporativo/financeiro-corporativo.js
// Compasso 2.0 — Release 3, tela "Financeiro Corporativo" do pacote.
// Reaproveita renderResumoOrcamentario() (js/dashboards/dashboard-resumo.js,
// generalizada com um `elId` opcional pra não colidir com o id fixo do
// Dashboard) — mesma cadeia Fechado→+Extraordinário→+Carryover=Atual já
// usada lá, sem recalcular nada.
// =========================================================================

let modoAFFinanceiroCorporativo = null;

function renderFinanceiroCorporativoView() {
    if (typeof montarSeletorAF === 'function') modoAFFinanceiroCorporativo = montarSeletorAF('finCorpSeletorAF', modoAFFinanceiroCorporativo);
    if (typeof renderFaixaAFSelecionado === 'function') renderFaixaAFSelecionado('finCorpFaixaAF', modoAFFinanceiroCorporativo);

    if (typeof projectsData === 'undefined') return;
    let lista = projectsData;
    if (typeof filtrarProjetosPorAnoFiscalSelecionado === 'function') lista = filtrarProjetosPorAnoFiscalSelecionado(lista, modoAFFinanceiroCorporativo);
    lista = filtrarProjetosPorArea(lista, 'financeiro_corporativo');

    if (typeof renderResumoOrcamentario === 'function') renderResumoOrcamentario(lista, 'finCorpResumoOrcamentario');
}

function onMudarSeletorAFFinanceiroCorporativo() {
    modoAFFinanceiroCorporativo = document.getElementById('finCorpSeletorAF').value;
    renderFinanceiroCorporativoView();
}
