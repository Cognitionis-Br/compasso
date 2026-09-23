// =========================================================================
// aprovacoes/minhas-aprovacoes.js
// Compasso 2.0 — Release 3, tela "Minhas Aprovações" do pacote — fila
// única cruzando as ~7 telas de aprovação que já existiam soltas. NÃO
// reimplementa nenhuma decisão: cada linha só leva de volta pra tela
// original (mesmo padrão de "Ver Detalhes Completos" do Workspace) —
// aprovar/reprovar continua acontecendo lá, com o formulário de sempre.
//
// Reaproveita as MESMAS regras de "pendente" já usadas em cada tela
// original (js/approvals/comite.js, orcamento-af.js, js/adhoc/tradeoff.js,
// js/governanca/mudanca-orcamento.js) e a mesma consulta de etapas com
// decisão pendente já usada em js/home/home-pessoal.js pros 3 gates
// genéricos (Requerimentos TI/Negócio, Especificação Negócio).
// =========================================================================

const MA_ETAPA_PARA_TAB = {
    'APROVAR REQUERIMENTOS TI': 'req_aprov_ti',
    'APROVAR REQUERIMENTOS NEGÓCIO': 'req_aprov_negocio',
    'AVALIAR ESPECIFICAÇÃO NEGÓCIO': 'tech_aval_negocio'
};

// Extraída (Compasso 2.0 Release 4) pra ser reaproveitada também pelo
// export de Relatórios (js/relatorios/relatorios.js) — mesma lista, sem
// duplicar os 5 filtros.
async function obterMinhasAprovacoes() {
    const naoSubSubprojeto = p => !p.is_subprojeto;
    const itens = [];

    // Comitê — aguardando 1ª decisão.
    filtrarProjetosPorArea(projectsData.filter(p =>
        naoSubSubprojeto(p) && p.etapa_atual === 'BUSINESS CASE' && p.is_adhoc !== true && p.is_carryover !== true &&
        p.sub_status === 'ORÇAMENTO REALIZADO'
    ), 'aprov_comite').forEach(p => itens.push({ p, origem: 'Aprovar Orçamento por Projeto', tab: 'aprov_comite' }));

    // Orçamento do Ano Fiscal — comitê já aprovou, falta consolidar no AF.
    filtrarProjetosPorArea(projectsData.filter(p =>
        naoSubSubprojeto(p) && p.etapa_atual === 'BUSINESS CASE' && p.is_adhoc !== true && p.is_carryover !== true &&
        p.sub_status === 'APROVADO'
    ), 'aprov_orcamento_af').forEach(p => itens.push({ p, origem: 'Aprovar Orçamento Ano Fiscal', tab: 'aprov_orcamento_af' }));

    // Demanda Extraordinária (ad-hoc).
    filtrarProjetosPorArea(projectsData.filter(p =>
        naoSubSubprojeto(p) && p.is_adhoc === true && p.etapa_atual === 'BUSINESS CASE' &&
        ['ORÇAMENTO REALIZADO', 'APROVADO'].includes(p.sub_status)
    ), 'projetos_adhoc').forEach(p => itens.push({ p, origem: 'Aprovar Demanda Extraordinária', tab: 'projetos_adhoc' }));

    // Mudança de orçamento bloqueada.
    filtrarProjetosPorArea(projectsData.filter(p => p.bloqueado_mudanca_orcamento === true), 'mudanca_orcamento')
        .forEach(p => itens.push({ p, origem: 'Aprovar Diferenças de Orçamento', tab: 'mudanca_orcamento' }));

    // Requerimentos TI/Negócio + Especificação Negócio — mesma consulta
    // usada pro KPI "Aprovações Pendentes" da Home (Release 1).
    const { data: etapasComDecisao } = await _supabase.from('fases_etapas').select('etapa').eq('requer_decisao_aprovacao', true);
    const nomesEtapas = (etapasComDecisao || []).map(e => e.etapa).filter(e => MA_ETAPA_PARA_TAB[e]);
    if (nomesEtapas.length > 0) {
        const { data: etapasPendentes } = await _supabase.from('projeto_etapas')
            .select('projeto_codigo, etapa').in('etapa', nomesEtapas).eq('percentual_evolucao', 100).is('decisao_resultado', null);
        (etapasPendentes || []).forEach(e => {
            if (!(ehAdministrador || ehProprietario || (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade(e.etapa)))) return;
            const p = projectsData.find(pr => pr.codigo === e.projeto_codigo);
            if (p) itens.push({ p, origem: e.etapa.charAt(0) + e.etapa.slice(1).toLowerCase(), tab: MA_ETAPA_PARA_TAB[e.etapa] });
        });
    }

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
