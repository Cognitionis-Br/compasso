// =========================================================================
// financeiro-corporativo/financeiro-corporativo.js
// Compasso 2.0 — Release 3, tela "Financeiro Corporativo" do pacote.
// Reaproveita renderResumoOrcamentario() (js/dashboards/dashboard-resumo.js,
// generalizada com um `elId` opcional pra não colidir com o id fixo do
// Dashboard) — mesma cadeia Fechado→+Extraordinário→+Carryover=Atual já
// usada lá, sem recalcular nada.
// =========================================================================

let modoAFFinanceiroCorporativo = null;

async function renderFinanceiroCorporativoView() {
    if (typeof montarSeletorAF === 'function') modoAFFinanceiroCorporativo = montarSeletorAF('finCorpSeletorAF', modoAFFinanceiroCorporativo);
    if (typeof renderFaixaAFSelecionado === 'function') renderFaixaAFSelecionado('finCorpFaixaAF', modoAFFinanceiroCorporativo);

    if (typeof projectsData === 'undefined') return;
    let lista = projectsData;
    if (typeof filtrarProjetosPorAnoFiscalSelecionado === 'function') lista = filtrarProjetosPorAnoFiscalSelecionado(lista, modoAFFinanceiroCorporativo);
    lista = filtrarProjetosPorArea(lista, 'financeiro_corporativo');

    if (typeof renderResumoOrcamentario === 'function') renderResumoOrcamentario(lista, 'finCorpResumoOrcamentario');

    await _finCorpRenderPacotesFY();
}

// NOVO (V4 do Plano de Evolução — Estimation, 2026-09-25): histórico dos
// Pacotes FY já fechados (js/approvals/orcamento-af.js grava um registro
// por fechamento em pacotes_fy/pacote_fy_itens) — puramente leitura.
async function _finCorpRenderPacotesFY() {
    const tbody = document.getElementById('finCorpPacotesFYBody');
    if (!tbody) return;

    const { data, error } = await _supabase.from('pacotes_fy').select('*').order('fechado_em', { ascending: false });
    if (error) {
        console.error('Erro ao carregar Pacotes FY:', error.message);
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum Pacote FY fechado ainda.</td></tr>`;
        return;
    }

    const pacotes = data || [];
    if (pacotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum Pacote FY fechado ainda.</td></tr>`;
        return;
    }

    tbody.innerHTML = pacotes.map(pac => `
        <tr>
            <td class="p-3 font-mono font-bold">${escapeHtml(pac.ano_fiscal)}</td>
            <td class="p-3 font-mono">${new Date(pac.fechado_em).toLocaleString('pt-BR')}</td>
            <td class="p-3 font-bold uppercase">${escapeHtml(pac.fechado_por) || '-'}</td>
            <td class="p-3 text-center font-bold">${pac.qtd_projetos}</td>
            <td class="p-3 text-right font-mono font-bold text-emerald-700">${formatCurrency(Number(pac.valor_total))}</td>
            <td class="p-3 text-center">
                <button onclick="_finCorpTogglePacoteFY(${pac.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold">Ver detalhe</button>
            </td>
        </tr>
        <tr id="finCorpPacoteDetalhe_${pac.id}" class="hidden bg-gray-50">
            <td colspan="6" class="p-3" id="finCorpPacoteDetalheConteudo_${pac.id}"></td>
        </tr>
    `).join('');
}

async function _finCorpTogglePacoteFY(pacoteId) {
    const linha = document.getElementById(`finCorpPacoteDetalhe_${pacoteId}`);
    if (!linha) return;
    const abrindo = linha.classList.contains('hidden');
    linha.classList.toggle('hidden');
    if (!abrindo) return;

    const conteudo = document.getElementById(`finCorpPacoteDetalheConteudo_${pacoteId}`);
    if (!conteudo) return;
    conteudo.innerHTML = '<span class="text-xs text-gray-400 italic">Carregando...</span>';

    const { data, error } = await _supabase.from('pacote_fy_itens').select('*').eq('pacote_fy_id', pacoteId).order('business_case_codigo');
    if (error) { conteudo.innerHTML = `<span class="text-xs text-danger-600">Erro: ${escapeHtml(error.message)}</span>`; return; }

    const itens = data || [];
    conteudo.innerHTML = itens.length === 0
        ? '<span class="text-xs text-gray-400 italic">Nenhum item registrado neste pacote.</span>'
        : `<table class="w-full text-xs">
            <thead><tr class="text-[10px] uppercase text-gray-500"><th class="text-left pb-1">Código</th><th class="text-left pb-1">Projeto</th><th class="text-right pb-1">Valor</th></tr></thead>
            <tbody>${itens.map(it => {
                const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === it.business_case_codigo) : null;
                return `<tr><td class="font-mono font-bold">${escapeHtml(it.business_case_codigo)}</td><td>${p ? escapeHtml(p.nome) : '-'}</td><td class="text-right font-mono">${formatCurrency(Number(it.valor_incluido))}</td></tr>`;
            }).join('')}</tbody>
        </table>`;
}

function onMudarSeletorAFFinanceiroCorporativo() {
    modoAFFinanceiroCorporativo = document.getElementById('finCorpSeletorAF').value;
    renderFinanceiroCorporativoView();
}
