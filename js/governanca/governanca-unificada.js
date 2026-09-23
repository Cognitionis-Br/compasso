// =========================================================================
// governanca/governanca-unificada.js
// Compasso 2.0 — Release 3 — fila que junta as 4 pendências de
// Governança hoje espalhadas (mudança de orçamento, retomar hold, troca
// de responsável, cobrança de ajustes). Só agrega/conta e leva pra tela
// original pra agir — não reimplementa nenhuma delas (troca de
// responsável e cobrança de ajustes têm lógica própria complexa demais
// pra duplicar aqui só pra mostrar uma contagem; viram atalhos diretos).
// =========================================================================

function renderGovernancaUnificadaView() {
    const wrapper = document.getElementById('governancaUnificadaLista');
    if (!wrapper) return;
    if (typeof projectsData === 'undefined') { wrapper.innerHTML = renderLoadingState(); return; }

    const bloqueados = filtrarProjetosPorArea(projectsData.filter(p => p.bloqueado_mudanca_orcamento === true), 'mudanca_orcamento');
    const emHold = filtrarProjetosPorArea(projectsData.filter(p => (p.sub_status || '').toUpperCase() === 'HOLD'), 'retomar_hold');

    const categoria = (icone, titulo, descricao, contagem, tab) => `
        <div class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-indigo-300" onclick="switchTab('${tab}')">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0"><i class="fa-solid ${icone}"></i></div>
                <div class="min-w-0">
                    <div class="text-sm font-bold text-gray-800">${titulo}</div>
                    <div class="text-[11px] text-gray-400">${descricao}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                ${contagem !== null ? `<span class="text-lg font-black ${contagem > 0 ? 'text-danger-600' : 'text-gray-300'}">${contagem}</span>` : ''}
                <i class="fa-solid fa-chevron-right text-gray-300"></i>
            </div>
        </div>`;

    wrapper.innerHTML = `
        <div class="space-y-2">
            ${categoria('fa-triangle-exclamation', 'Mudança de Orçamento Bloqueada', 'Projetos travados por variação acima do limite', bloqueados.length, 'mudanca_orcamento')}
            ${categoria('fa-pause', 'Projetos em Hold', 'Aguardando retomada após trade-off Extraordinário', emHold.length, 'retomar_hold')}
            ${categoria('fa-user-pen', 'Troca de Responsável de Atividade', 'Reatribuir etapas em andamento', null, 'troca_responsavel_atividade')}
            ${categoria('fa-envelope', 'Cobrança de Ajustes', 'Projetos elegíveis pra e-mail de cobrança (farol crítico, evolução parada, atraso)', null, 'governanca')}
        </div>
    `;
}
