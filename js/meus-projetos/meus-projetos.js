// =========================================================================
// meus-projetos/meus-projetos.js
// Compasso 2.0 — Release 1, tela R1-UX04 (Meus Projetos). Cards (não
// tabela) dos projetos no escopo do usuário logado — reaproveita
// filtrarProjetosPorArea (mesma regra de OPERADOR já usada em Consulta de
// Projetos, js/consultas/consulta-projetos.js) e calcularSaudeProjeto
// (js/utils/health.js) pro Farol de Saúde, sem recalcular nada do zero.
// =========================================================================

async function renderMeusProjetosView() {
    const wrapper = document.getElementById('meusProjetosCards');
    if (!wrapper) return;
    if (typeof projectsData === 'undefined') { wrapper.innerHTML = renderLoadingState(); return; }
    wrapper.innerHTML = renderLoadingState();

    const { data: todasEtapasCache } = await _supabase.from('projeto_etapas').select('*');
    const meus = filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos');

    if (meus.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center col-span-full">Nenhum projeto no seu escopo.</p>';
        return;
    }

    wrapper.innerHTML = meus.map(p => {
        const saude = calcularSaudeProjeto(p, todasEtapasCache || []);
        return `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-indigo-300 transition" onclick="abrirDetalheProjeto('${p.codigo}', 'meus_projetos')">
            <div class="flex items-start justify-between mb-2 gap-2">
                <div class="min-w-0">
                    <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(p.codigo)}</div>
                    <div class="text-xs text-gray-500 truncate">${escapeHtml(p.nome || '')}</div>
                </div>
                ${saude.html}
            </div>
            <div class="text-[10px] font-bold uppercase text-gray-400">${escapeHtml(p.etapa_atual || 'Business Case')}</div>
        </div>`;
    }).join('');
}
