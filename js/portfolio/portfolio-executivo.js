// =========================================================================
// portfolio/portfolio-executivo.js
// Compasso 2.0 — Release 3, tela "Portfólio Executivo" do pacote.
// Reaproveita TODO o cálculo já existente (calcularSaudeProjeto,
// filtrarProjetosPorAnoFiscalSelecionado/montarSeletorAF, filtrarProjetosPorArea)
// — não recalcula nada do zero, só apresenta numa tela própria com
// drill-down (abrirDetalheProjeto, origem 'portfolio_executivo' —
// preserva o filtro de AF ao voltar, porque essa variável de estado é
// module-level e não é resetada por switchTab).
// =========================================================================

let modoAFPortfolioExecutivo = null;

async function renderPortfolioExecutivoView() {
    if (typeof montarSeletorAF === 'function') modoAFPortfolioExecutivo = montarSeletorAF('portExecSeletorAF', modoAFPortfolioExecutivo);
    if (typeof renderFaixaAFSelecionado === 'function') renderFaixaAFSelecionado('portExecFaixaAF', modoAFPortfolioExecutivo);

    const wrapper = document.getElementById('portExecCorpo');
    if (!wrapper) return;
    if (typeof projectsData === 'undefined') { wrapper.innerHTML = renderLoadingState(); return; }
    wrapper.innerHTML = renderLoadingState();

    const { data: todasEtapasCache } = await _supabase.from('projeto_etapas').select('*');

    let lista = projectsData.filter(p => !p.is_subprojeto);
    if (typeof filtrarProjetosPorAnoFiscalSelecionado === 'function') lista = filtrarProjetosPorAnoFiscalSelecionado(lista, modoAFPortfolioExecutivo);
    lista = filtrarProjetosPorArea(lista, 'portfolio_executivo');

    const comSaude = lista.map(p => ({ p, saude: calcularSaudeProjeto(p, todasEtapasCache || []) }));
    const contagem = { SAUDAVEL: 0, ATENCAO: 0, CRITICO: 0, HOLD: 0, INATIVO: 0 };
    comSaude.forEach(({ saude }) => { contagem[saude.status] = (contagem[saude.status] || 0) + 1; });

    const investimentoTotal = lista.reduce((acc, p) => acc + (Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0), 0);
    const realizadoTotal = lista.reduce((acc, p) => acc + (Number(p.realizado) || 0), 0);

    const cardKpi = (rotulo, valor, cor) => `
        <div class="bg-white rounded-lg border border-gray-200 border-t-4 ${cor} p-4">
            <div class="text-[10px] font-bold uppercase text-gray-400">${rotulo}</div>
            <div class="text-xl font-extrabold text-gray-900 mt-1">${valor}</div>
        </div>`;

    wrapper.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            ${cardKpi('Total de Projetos', lista.length, 'border-t-gray-400')}
            ${cardKpi('Investimento (Atual)', formatCurrency(investimentoTotal), 'border-t-indigo-500')}
            ${cardKpi('Realizado', formatCurrency(realizadoTotal), 'border-t-blue-500')}
            ${cardKpi('Críticos', contagem.CRITICO, contagem.CRITICO > 0 ? 'border-t-danger-500' : 'border-t-emerald-500')}
        </div>

        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table class="w-full text-left text-xs">
                <thead><tr class="bg-gray-50 uppercase text-[10px] text-gray-500 border-b">
                    <th class="p-3">Código</th><th class="p-3">Projeto</th><th class="p-3">Área</th>
                    <th class="p-3">Fase</th><th class="p-3 text-right">Investimento</th><th class="p-3">Saúde</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${comSaude.length === 0 ? '<tr><td colspan="6" class="p-6 text-center text-gray-400 italic">Nenhum projeto no filtro atual.</td></tr>' : comSaude.map(({ p, saude }) => `
                        <tr class="hover:bg-gray-50 cursor-pointer" onclick="abrirDetalheProjeto('${p.codigo}', 'portfolio_executivo')">
                            <td class="p-3 font-mono font-bold">${escapeHtml(p.codigo)}</td>
                            <td class="p-3">${escapeHtml(p.nome || '')}</td>
                            <td class="p-3">${escapeHtml(p.area || '-')}</td>
                            <td class="p-3">${escapeHtml(p.etapa_atual || 'Business Case')}</td>
                            <td class="p-3 text-right font-mono">${formatCurrency(Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0)}</td>
                            <td class="p-3">${saude.html}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function onMudarSeletorAFPortfolioExecutivo() {
    modoAFPortfolioExecutivo = document.getElementById('portExecSeletorAF').value;
    renderPortfolioExecutivoView();
}
