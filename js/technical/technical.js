// =========================================================================
// technical/technical.js
// Fase Technical — migrada 10/08/2026 pro motor "consciente de fase"
// (Especificacao_Workflow_v4.md, seções 5.3, 13): duas etapas, GERAR
// ESPECIFICAÇÃO (planejamento + % evolução, padrão comum) e FECHAR
// ESPECIFICAÇÃO (revisão de valor/porte com alerta de variação — mesma
// regra e mesmo helper de Requerimentos, G7/G9).
// =========================================================================

// NOVO: alterna entre as 2 abas de Gerar Especificação (padrão V2).
function mudarAbaGerarEspecificacao(aba) {
    ['a_planejar', 'execucao'].forEach(a => {
        const btn = document.getElementById(`techGerarBtn-${a}`);
        const painel = document.getElementById(`techGerarPainel-${a}`);
        if (btn) btn.className = `tech-gerar-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('fase_technical', 'techGerarBtn');
}

async function renderTechView() {
    await renderFaseGenericaViewPorFase(
        'TECHNICAL', 'TECHNICAL', 'GERAR ESPECIFICAÇÃO',
        'techAPlanejarTableBody', 'techExecucaoTableBody', renderTechView,
        'fase_technical:a_planejar', 'fase_technical:execucao'
    );
}

// NOVO (item 1 combinado — mudança de fases): idêntica em comportamento à
// Avaliação de Negócio de Requerimentos — mesmo helper, mesma etapa
// intermediária entre Gerar e Fechar, com decisão de aprovação/reprovação.
// NOVO: alterna entre as 2 abas de Avaliar Especificação por Negócio
// (padrão V2).
function mudarAbaAvalEspecNegocio(aba) {
    ['a_planejar', 'execucao'].forEach(a => {
        const btn = document.getElementById(`techAvalNegBtn-${a}`);
        const painel = document.getElementById(`techAvalNegPainel-${a}`);
        if (btn) btn.className = `tech-aval-neg-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('tech_aval_negocio', 'techAvalNegBtn');
}

async function renderTechAvalNegocioView() {
    await renderFaseGenericaViewPorFase(
        'TECHNICAL', 'TECHNICAL', 'AVALIAR ESPECIFICAÇÃO NEGÓCIO',
        'techAvalNegAPlanejarTableBody', 'techAvalNegExecucaoTableBody', renderTechAvalNegocioView,
        'tech_aval_negocio:a_planejar', 'tech_aval_negocio:execucao'
    );
}

// NOVO (item 6, novos ajustes): mesmo padrão do item 3 (Concluir
// Requerimentos) — lista simples + modal genérico compartilhado
// (abrirModalConcluirFase / confirmarConclusaoFaseGenerica).
const CONFIG_CONCLUSAO_TECHNICAL = {
    titulo: 'Concluir Etapa de Technical',
    labelApos: 'Após Technical',
    labelReferencia: 'Requerimentos',
    campoValorReferencia: 'val_req',
    campoValorPos: 'val_tech',
    // NOVO (a pedido do usuário 24/08/2026): ver mesmo comentário em
    // CONFIG_CONCLUSAO_REQUERIMENTOS (js/requirements/requirements.js).
    campoHorasReferencia: 'horas_req',
    campoHorasPos: 'horas_tech',
    campoAlertaVariacaoHoras: 'tech_alerta_variacao_horas',
    campoVariacaoPercentualHoras: 'tech_variacao_percentual_horas',
    // REMOVIDO (Licenciamento de Módulos, 28/08/2026): ver mesmo
    // comentário em CONFIG_CONCLUSAO_REQUERIMENTOS (js/requirements/requirements.js).
    etapaNomeRBAC: 'FECHAR ESPECIFICAÇÃO',
    faseFluxoEmail: 'TECHNICAL',
    quandoDisparaConcluir: 'Após fechar especificação',
    proximaFase: 'EXECUTION',
    proximoSubStatus: 'A PLANEJAR',
    campoConcluidoPor: 'tech_concluido_por',
    campoConcluidoEm: 'tech_concluido_em',
    campoAlertaVariacao: 'tech_alerta_variacao',
    campoVariacaoPercentual: 'tech_variacao_percentual',
    campoObservacao: 'tech_observacao_conclusao',
    callbackAtualizar: () => renderTechConclusaoView()
};

function renderTechConclusaoView() {
    const tbody = document.getElementById('techConclusaoTableBody');
    if (!tbody) return;

    const etapasDaFase = obterEtapasDaFase('TECHNICAL').filter(e => e.etapa !== 'FECHAR ESPECIFICAÇÃO');
    const candidatos = projectsData.filter(p => {
        const etapa = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        // NOVO (Mudança de Orçamento, 27/08/2026): some daqui assim que
        // bloqueado — passa a aparecer só em Governança > Mudança de
        // Orçamento até ser aprovado.
        return etapa === 'TECHNICAL' && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD' && p.bloqueado_mudanca_orcamento !== true;
    });
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const pendentes = filtrarProjetosPorArea(candidatos.filter(p => obterEtapaAtualNaFase(p.codigo, etapasDaFase) === null)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR')), 'tech_conclusao');

    if (pendentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto aguardando fechamento de especificação</td></tr>`;
        return;
    }

    tbody.innerHTML = pendentes.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 text-xs">${p.area || '-'}</td>
            <td class="p-3 text-center">
                ${botaoSeTemAtividade('tech_conclusao', `
                    <button onclick="abrirModalConcluirFase('${p.codigo}', CONFIG_CONCLUSAO_TECHNICAL)" class="bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                        <i class="fa-solid fa-check"></i> Concluir
                    </button>
                `) || '<span class="text-gray-400 italic text-[10px]">Sem permissão</span>'}
            </td>
        </tr>
    `).join('');
}
