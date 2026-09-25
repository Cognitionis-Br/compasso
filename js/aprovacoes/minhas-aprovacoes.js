// =========================================================================
// aprovacoes/minhas-aprovacoes.js
// Compasso 2.0 — Release 3, tela "Minhas Aprovações" do pacote — fila
// única cruzando as ~7 telas de aprovação que já existiam soltas. NÃO
// reimplementa nenhuma decisão: cada linha só leva de volta pra tela
// original (mesmo padrão de "Ver Detalhes Completos" do Workspace) —
// aprovar/reprovar continua acontecendo lá, com o formulário de sempre.
//
// V1 do Plano de Evolução (2026-09-25, fecha WF-03 da Matriz de Gaps):
// os 5 critérios de "pendente" que antes viviam só aqui em JS agora são a
// view v_approvals (sql/2026-09-25_v1_approvals_view.sql) — um objeto
// APPROVAL real e consultável no banco, em vez de filtros ad-hoc
// espalhados. A decisão em si continua acontecendo exatamente onde
// acontecia (comitê.js, orcamento-af.js, tradeoff.js, mudanca-orcamento.js,
// generic-workflow-ui.js); esta função só passou a LER de um lugar único.
// Permissão continua sendo aplicada aqui (RBAC de app, não de linha — a
// view não filtra por usuário): filtrarProjetosPorArea() por grupo de
// origem, usuarioTemAtividade() por etapa de decisão — mesmo critério de
// antes.
//
// Extraída (Compasso 2.0 Release 4) pra ser reaproveitada também pelo
// export de Relatórios (js/relatorios/relatorios.js) — mesma lista, sem
// duplicar os 5 filtros.
async function obterMinhasAprovacoes() {
    const { data: pendentes, error } = await _supabase.from('v_approvals').select('*');
    if (error) { console.error('Erro ao consultar v_approvals:', error.message); return []; }

    const porTab = {};
    (pendentes || []).forEach(row => (porTab[row.tab] = porTab[row.tab] || []).push(row));

    const itens = [];

    // Grupos com permissão por área (mesma ordem de antes: comitê, AF, adhoc, mudança de orçamento).
    ['aprov_comite', 'aprov_orcamento_af', 'projetos_adhoc', 'mudanca_orcamento'].forEach(tab => {
        const rows = porTab[tab] || [];
        const projetosDoGrupo = rows.map(r => projectsData.find(p => p.codigo === r.projeto_codigo)).filter(Boolean);
        const codigosPermitidos = new Set(filtrarProjetosPorArea(projetosDoGrupo, tab).map(p => p.codigo));
        rows.forEach(r => {
            if (!codigosPermitidos.has(r.projeto_codigo)) return;
            const p = projectsData.find(pr => pr.codigo === r.projeto_codigo);
            if (p) itens.push({ p, origem: r.origem, tab: r.tab });
        });
    });

    // Etapas com decisão pendente — permissão é por atividade, não por área.
    ['req_aprov_ti', 'req_aprov_negocio', 'tech_aval_negocio'].forEach(tab => {
        (porTab[tab] || []).forEach(r => {
            if (!(ehAdministrador || ehProprietario || (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade(r.etapa)))) return;
            const p = projectsData.find(pr => pr.codigo === r.projeto_codigo);
            if (p) itens.push({ p, origem: r.origem, tab: r.tab });
        });
    });

    return itens;
}

async function renderMinhasAprovacoesView() {
    const wrapper = document.getElementById('minhasAprovacoesLista');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const itens = await obterMinhasAprovacoes();

    if (itens.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhuma aprovação pendente pra você agora.</p>';
        return;
    }

    wrapper.innerHTML = `
        <div class="space-y-2">
            ${itens.map(({ p, origem, tab }) => `
                <div class="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="switchTab('${tab}')">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</div>
                        <div class="text-[10px] text-gray-400">${escapeHtml(origem)}</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300 flex-shrink-0 ml-2"></i>
                </div>
            `).join('')}
        </div>
    `;
}
