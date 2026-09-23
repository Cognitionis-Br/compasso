// =========================================================================
// workspace-projeto/cronograma-projeto.js
// Compasso 2.0 — Release 3, aba Cronograma do Workspace ("Projeto -
// Cronograma/Gantt" do pacote). NÃO redesenha um Gantt do zero — o motor
// visual já existe em js/roadmap/roadmap.js: obterSegmentosFaseProjeto()
// monta os segmentos de UM projeto e renderTrilhaSegmentos() desenha a
// grade de 12 meses com planejado-vs-real (rachurado quando atrasado).
// Esta aba só chama as duas, scoped ao projeto do Workspace.
// =========================================================================

async function renderCronogramaProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState('Carregando cronograma...');

    const projeto = (typeof projectsData !== 'undefined') ? projectsData.find(p => p.codigo === projetoCodigo) : null;
    const { data: etapasDoProjeto, error } = await _supabase.from('projeto_etapas').select('*').eq('projeto_codigo', projetoCodigo);
    if (error) { wrapper.innerHTML = `<p class="text-xs text-danger-600 py-4 text-center">Erro ao carregar cronograma: ${escapeHtml(error.message)}</p>`; return; }

    if (typeof obterSegmentosFaseProjeto !== 'function' || typeof renderTrilhaSegmentos !== 'function') {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Motor de cronograma indisponível.</p>';
        return;
    }

    const segmentos = obterSegmentosFaseProjeto(projetoCodigo, etapasDoProjeto || []);
    if (segmentos.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-6 text-center">Nenhuma etapa com data de início planejada ainda.</p>';
        return;
    }

    wrapper.innerHTML = `
        <div class="text-[10px] text-gray-400 mb-2">Ano Fiscal ${escapeHtml((projeto && projeto.ano_fiscal) || '-')} · barra rachurada = atrasado (planejado vs. real)</div>
        ${renderTrilhaSegmentos(segmentos, projetoCodigo, etapasDoProjeto || [], projeto && projeto.ano_fiscal, 0)}
    `;
}
