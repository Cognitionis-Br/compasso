// =========================================================================
// dashboards/dashboard-filtro.js   (Remodelação do Dashboard — Estágio 1)
// Filtro Global compartilhado (spec-dashboard-portfolio.md §4.1): quatro
// dimensões em múltipla seleção — Área, Fase, Status, Tipo (GROW/REG/RUN) —
// com trilha de chips removíveis e um botão "Limpar filtros".
//
// O filtro roda DEPOIS do recorte de Ano Fiscal / restrição de área /
// agrupamento (js/dashboards/dashboard.js). Alterar qualquer dimensão
// re-renderiza o dashboard inteiro sem reload (renderDashboardMetrics).
//
// Seções que reagem ao filtro (default assumido): Farol de Saúde,
// Orçado x Realizado por Área, Consolidação por Fase, Composição do
// Portfólio e Status Detalhado da Carteira. Resumo Orçamentário e Funis
// seguem no escopo do Ano Fiscal selecionado.
// =========================================================================

// Estado — Sets vazios = "sem filtro" naquela dimensão.
const dashFiltroGlobal = { produtos: new Set(), areas: new Set(), fases: new Set(), status: new Set(), tipos: new Set() };

// 7 fases lineares, na ordem de leitura 1 -> 7 (spec §4.2). A chave é
// normalizada (sem espaços) para casar 'GOLIVE' e 'GO LIVE'.
const DASH_FASES = [
    { k: 'BUSINESSCASE', l: 'Business Case' },
    { k: 'REQUIREMENTS', l: 'Requerimentos' },
    { k: 'TECHNICAL', l: 'Especificação' },
    { k: 'EXECUTION', l: 'Execução' },
    { k: 'UAT', l: 'UAT' },
    { k: 'GOLIVE', l: 'Go-Live' },
    { k: 'CONCLUIDO', l: 'Concluído' }
];
const DASH_TIPOS = ['GROW', 'REG', 'RUN'];

// Fase "canônica" de um projeto para o filtro/consolidação: projeto com
// baixa final é 'CONCLUIDO'; senão, a etapa_atual normalizada.
function dashFaseDe(p) {
    if (p.projeto_concluido === true) return 'CONCLUIDO';
    return String(p.etapa_atual || 'BUSINESS CASE').toUpperCase().replace(/\s+/g, '');
}

function _dashNomeProduto(id) {
    if (typeof nomeProdutoPorId === 'function') return nomeProdutoPorId(id);
    return 'Produto #' + id;
}
function _dashProdutosDistintos() {
    const base = (typeof projectsData !== 'undefined' && projectsData) ? projectsData : [];
    const ids = [...new Set(base.map(p => p.produto_id).filter(v => v != null && v !== ''))].map(String);
    return ids.map(id => ({ k: id, l: _dashNomeProduto(id) }))
        .sort((a, b) => a.l.localeCompare(b.l, 'pt-BR'));
}
function _dashStatusDistintos() {
    const base = (typeof projectsData !== 'undefined' && projectsData) ? projectsData : [];
    return [...new Set(base.map(p => (p.sub_status || '').trim().toUpperCase()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function _dashAreasDistintas() {
    const base = (typeof projectsData !== 'undefined' && projectsData) ? projectsData : [];
    return [...new Set(base.map(p => (p.area || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ---- aplicação -------------------------------------------------------
function aplicarFiltroGlobal(lista) {
    const f = dashFiltroGlobal;
    return (lista || []).filter(p => {
        if (f.produtos.size && !f.produtos.has(String(p.produto_id))) return false;
        if (f.areas.size && !f.areas.has((p.area || '').trim())) return false;
        if (f.fases.size && !f.fases.has(dashFaseDe(p))) return false;
        if (f.status.size && !f.status.has((p.sub_status || '').trim().toUpperCase())) return false;
        if (f.tipos.size && !f.tipos.has((p.tipo_qualificacao || 'REG').toUpperCase())) return false;
        return true;
    });
}
function filtroGlobalAtivo() {
    const f = dashFiltroGlobal;
    return f.produtos.size + f.areas.size + f.fases.size + f.status.size + f.tipos.size > 0;
}

// ---- UI -------------------------------------------------------------
function _dashDimSet(dim) {
    return dim === 'produto' ? dashFiltroGlobal.produtos
        : dim === 'area' ? dashFiltroGlobal.areas
        : dim === 'fase' ? dashFiltroGlobal.fases
        : dim === 'status' ? dashFiltroGlobal.status
        : dashFiltroGlobal.tipos;
}

function toggleFiltroGlobal(dim, valor) {
    const set = _dashDimSet(dim);
    if (set.has(valor)) set.delete(valor); else set.add(valor);
    renderFiltroGlobalDashboard();
    if (typeof renderDashboardMetrics === 'function') renderDashboardMetrics();
}
function limparFiltroGlobal() {
    dashFiltroGlobal.produtos.clear();
    dashFiltroGlobal.areas.clear();
    dashFiltroGlobal.fases.clear();
    dashFiltroGlobal.status.clear();
    dashFiltroGlobal.tipos.clear();
    renderFiltroGlobalDashboard();
    if (typeof renderDashboardMetrics === 'function') renderDashboardMetrics();
}

function _dashDropdown(dim, titulo, itens) {
    const set = _dashDimSet(dim);
    const n = set.size;
    const opcoes = itens.map(it => {
        const val = typeof it === 'string' ? it : it.k;
        const lab = typeof it === 'string' ? it : it.l;
        const on = set.has(val);
        return `<label class="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleFiltroGlobal('${dim}', ${JSON.stringify(val).replace(/"/g, '&quot;')})">
            <span>${escapeHtml(lab)}</span></label>`;
    }).join('');
    return `<details class="relative">
        <summary class="list-none cursor-pointer select-none px-3 py-2 border rounded text-xs font-bold bg-white flex items-center gap-2 ${n ? 'border-indigo-400 text-indigo-700' : 'border-gray-300 text-gray-600'}">
            <i class="fa-solid fa-filter text-[10px]"></i> ${titulo}${n ? ` <span class="bg-indigo-600 text-white rounded-full px-1.5 text-[10px]">${n}</span>` : ''}
            <i class="fa-solid fa-chevron-down text-[9px] ml-auto"></i>
        </summary>
        <div class="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">${opcoes || '<div class="px-3 py-2 text-xs text-gray-400">nada a filtrar</div>'}</div>
    </details>`;
}

function renderFiltroGlobalDashboard() {
    const bar = document.getElementById('dashFiltroGlobalBar');
    if (bar) {
        bar.innerHTML =
            _dashDropdown('produto', 'Produto', _dashProdutosDistintos()) +
            _dashDropdown('area', 'Área', _dashAreasDistintas()) +
            _dashDropdown('fase', 'Fase', DASH_FASES) +
            _dashDropdown('status', 'Status', _dashStatusDistintos()) +
            _dashDropdown('tipo', 'Tipo', DASH_TIPOS) +
            `<button onclick="limparFiltroGlobal()" class="px-3 py-2 text-xs font-bold rounded border border-gray-300 text-gray-500 hover:text-gray-800 hover:border-gray-400 ${filtroGlobalAtivo() ? '' : 'opacity-40 pointer-events-none'}">
                <i class="fa-solid fa-xmark"></i> Limpar filtros</button>`;
    }

    const trilha = document.getElementById('dashFiltroGlobalTrilha');
    if (trilha) {
        const chip = (dim, val, lab) => `<button onclick="toggleFiltroGlobal('${dim}', ${JSON.stringify(val).replace(/"/g, '&quot;')})"
            class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full px-2.5 py-1 text-[11px] font-bold hover:bg-indigo-100">
            ${escapeHtml(lab)} <i class="fa-solid fa-xmark text-[9px]"></i></button>`;
        const chips = [];
        dashFiltroGlobal.produtos.forEach(v => chips.push(chip('produto', v, 'Produto: ' + _dashNomeProduto(v))));
        dashFiltroGlobal.areas.forEach(v => chips.push(chip('area', v, 'Área: ' + v)));
        dashFiltroGlobal.fases.forEach(v => chips.push(chip('fase', v, 'Fase: ' + ((DASH_FASES.find(f => f.k === v) || {}).l || v))));
        dashFiltroGlobal.status.forEach(v => chips.push(chip('status', v, 'Status: ' + v)));
        dashFiltroGlobal.tipos.forEach(v => chips.push(chip('tipo', v, 'Tipo: ' + v)));
        trilha.innerHTML = chips.length
            ? chips.join('') + `<span class="text-[11px] text-gray-400 self-center ml-1">${chips.length} filtro(s) ativo(s)</span>`
            : '<span class="text-[11px] text-gray-400">Sem filtros — mostrando todo o Ano Fiscal selecionado.</span>';
    }
}
