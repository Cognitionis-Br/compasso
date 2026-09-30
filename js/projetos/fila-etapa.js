// =========================================================================
// projetos/fila-etapa.js
// Fase 1 — D-11: filas de projetos por etapa do ciclo de vida.
//
// Cada view mostra os projetos em determinada fase (REQUIREMENTS, TECHNICAL,
// EXECUTION, UAT, GOLIVE, CONCLUIDO) filtrados de projectsData (cache
// em memória — sem nova consulta ao banco). Clicar num projeto abre o
// SCR-03 (workspace) já posicionado na aba de etapa correspondente.
//
// O "Todos os Projetos" delega diretamente a switchTab('consultas'), pois
// a tela de consulta já é completa e com filtros (decisão Q7-A).
// =========================================================================

// Mapa: tabId de fila → { faseKey, abaWorkspace, label }
const FILA_ETAPA_MAP = {
    projetos_requerimentos: { faseKey: 'REQUIREMENTS', abaWs: 'etapa_requerimentos', label: 'Requerimentos' },
    projetos_especificacao: { faseKey: 'TECHNICAL',    abaWs: 'etapa_especificacao', label: 'Especificação'  },
    projetos_execucao:      { faseKey: 'EXECUTION',    abaWs: 'etapa_execucao',      label: 'Execução'       },
    projetos_uat:           { faseKey: 'UAT',          abaWs: 'etapa_uat',           label: 'UAT'            },
    projetos_golive:        { faseKey: 'GOLIVE',       abaWs: 'etapa_golive',        label: 'Go Live'        },
    projetos_encerramento:  { faseKey: 'CONCLUIDO',    abaWs: 'etapa_encerramento',  label: 'Encerramento'   },
};

function renderFilaEtapaView(tabId) {
    const cfg = FILA_ETAPA_MAP[tabId];
    if (!cfg) return;

    const wrapper = document.getElementById('view-' + tabId);
    if (!wrapper) return;

    const projetos = (typeof projectsData !== 'undefined' ? projectsData : [])
        .filter(p => {
            const k = (typeof dashFaseKeyRaw === 'function') ? dashFaseKeyRaw(p.etapa_atual) : (p.etapa_atual || '');
            return k === cfg.faseKey;
        });

    const rows = projetos.map(p => {
        const saude = (typeof calcularSaudeProjeto === 'function')
            ? calcularSaudeProjeto(p, [])
            : { html: '<span class="text-gray-400 text-xs">—</span>' };
        const prazo = p.data_fim_planejamento
            ? `<span class="text-xs text-gray-600">${formatDate(p.data_fim_planejamento)}</span>`
            : '<span class="text-xs text-gray-400">—</span>';
        const sla = (typeof slaParaEtapa === 'function') ? slaParaEtapa(p.etapa_atual) : null;
        const alerta = (typeof badgeAlertaPrazo === 'function')
            ? badgeAlertaPrazo(p.data_fim_planejamento, sla)
            : '';
        return `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="abrirWorkspaceNaEtapa('${escapeHtml(p.codigo)}','${cfg.abaWs}')">
                <td class="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">${escapeHtml(p.codigo)}</td>
                <td class="px-4 py-2.5 text-xs font-bold text-gray-800">${escapeHtml(p.nome || '')}</td>
                <td class="px-4 py-2.5 text-xs text-gray-600">${escapeHtml(p.area_solicitante || '—')}</td>
                <td class="px-4 py-2.5">${saude.html}</td>
                <td class="px-4 py-2.5">${prazo}</td>
                <td class="px-4 py-2.5">${alerta}</td>
                <td class="px-4 py-2.5 text-right">
                    <button onclick="event.stopPropagation(); abrirWorkspaceNaEtapa('${escapeHtml(p.codigo)}','${cfg.abaWs}')"
                        class="text-xs font-bold text-indigo-700 hover:text-indigo-900 whitespace-nowrap">
                        Abrir <i class="fa-solid fa-arrow-right ml-1"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');

    const empty = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs text-gray-400">Nenhum projeto em ${cfg.label} no momento.</td></tr>`;

    wrapper.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <i class="fa-solid fa-diagram-project brand-red-text"></i>
                    Projetos em ${cfg.label}
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">${projetos.length} projeto${projetos.length !== 1 ? 's' : ''} nesta etapa</p>
            </div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table class="w-full text-left">
                <thead class="border-b border-gray-100">
                    <tr>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Código</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Área</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Saúde</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Prazo</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Alerta</th>
                        <th class="px-4 py-2.5"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${rows || empty}
                </tbody>
            </table>
        </div>
    `;
}

// Abre o workspace posicionado na aba de etapa correta (deep-link D-11)
function abrirWorkspaceNaEtapa(codigo, abaWs) {
    abrirWorkspaceProjeto(codigo, async () => {
        await mudarAbaWorkspace(abaWs);
    });
}

// Stub — Base de Conhecimento (Fase 2+)
function renderConhecimentoView() {
    const wrapper = document.getElementById('view-conhecimento');
    if (!wrapper) return;
    wrapper.innerHTML = `
        <div class="flex flex-col items-center justify-center py-24 text-center">
            <i class="fa-solid fa-book-open text-4xl text-gray-300 mb-4"></i>
            <h3 class="text-base font-bold text-gray-500">Base de Conhecimento</h3>
            <p class="text-xs text-gray-400 mt-1 max-w-xs">Em desenvolvimento — disponível na Fase 2.</p>
        </div>`;
}
