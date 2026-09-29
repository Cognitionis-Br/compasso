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
let _portExecUltimaLista = []; // V25 — cache para exportação CSV
let portExecOrdenacaoAtual = { campo: 'padrao', direcao: 'asc' }; // V35

function popularBuscaPortfolio(lista) { // V50
    const dl = document.getElementById('portExecBuscaLista');
    if (!dl) return;
    dl.innerHTML = (lista || []).map(p => `<option value="${p.codigo} - ${escapeHtml(p.nome)}">`).join('');
}

function popularFiltroAreaPortfolio() {
    const sel = document.getElementById('portExecFiltroArea');
    if (!sel) return;
    const atual = sel.value;
    const areas = [...new Set((projectsData || []).map(p => p.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sel.innerHTML = '<option value="">-- Todas --</option>' + areas.map(a => `<option value="${a}" ${a === atual ? 'selected' : ''}>${a}</option>`).join('');
}

function ordenarPortfolioExecutivo(campo) {
    if (portExecOrdenacaoAtual.campo === campo) {
        portExecOrdenacaoAtual.direcao = portExecOrdenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        portExecOrdenacaoAtual.campo = campo;
        portExecOrdenacaoAtual.direcao = campo === 'investimento' ? 'desc' : 'asc';
    }
    renderPortfolioExecutivoView();
}

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

    popularFiltroAreaPortfolio();
    const filtroArea = (document.getElementById('portExecFiltroArea') || {}).value || '';
    if (filtroArea) lista = lista.filter(p => (p.area || '') === filtroArea);
    const filtroFase = (document.getElementById('portExecFiltroFase') || {}).value || '';
    if (filtroFase) lista = lista.filter(p => (p.etapa_atual || 'BUSINESS CASE').toUpperCase() === filtroFase);

    // V50 — busca por código/nome (datalist antes de aplicar o filtro de texto)
    popularBuscaPortfolio(lista);
    const filtroBuscaPort = ((document.getElementById('portExecBuscaInput') || {}).value || '').trim().toUpperCase();
    if (filtroBuscaPort) {
        lista = lista.filter(p => {
            const cod = (p.codigo || '').toUpperCase(), nom = (p.nome || '').toUpperCase();
            return cod.includes(filtroBuscaPort) || nom.includes(filtroBuscaPort) || filtroBuscaPort.includes(cod);
        });
    }

    const filtroSaude = (document.getElementById('portExecFiltroSaude') || {}).value || '';
    let comSaude = lista.map(p => ({ p, saude: calcularSaudeProjeto(p, todasEtapasCache || []) }));
    if (filtroSaude) comSaude = comSaude.filter(({ saude }) => saude.status === filtroSaude);
    const contagem = { SAUDAVEL: 0, ATENCAO: 0, CRITICO: 0, HOLD: 0, INATIVO: 0 };
    comSaude.forEach(({ saude }) => { contagem[saude.status] = (contagem[saude.status] || 0) + 1; });

    // V35 — ordenação clicável
    const FAROL_ORDEM = { CRITICO: 0, ATENCAO: 1, HOLD: 2, SAUDAVEL: 3, SEM_DADOS: 4, INATIVO: 5 };
    if (portExecOrdenacaoAtual.campo === 'padrao') {
        comSaude.sort((a, b) => extrairNumeroSequencialCodigo(a.p.codigo) - extrairNumeroSequencialCodigo(b.p.codigo));
    } else {
        comSaude.sort((a, b) => {
            let va, vb;
            if (portExecOrdenacaoAtual.campo === 'area') { va = (a.p.area || '').toUpperCase(); vb = (b.p.area || '').toUpperCase(); }
            else if (portExecOrdenacaoAtual.campo === 'responsavel') { va = (a.p.pessoa_solicitante || '').toUpperCase(); vb = (b.p.pessoa_solicitante || '').toUpperCase(); }
            else if (portExecOrdenacaoAtual.campo === 'fase') { va = (a.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); vb = (b.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); }
            else if (portExecOrdenacaoAtual.campo === 'investimento') { va = Number(a.p.val_tech) || Number(a.p.val_req) || Number(a.p.val_bc) || Number(a.p.previsto) || 0; vb = Number(b.p.val_tech) || Number(b.p.val_req) || Number(b.p.val_bc) || Number(b.p.previsto) || 0; }
            else if (portExecOrdenacaoAtual.campo === 'saude') { va = FAROL_ORDEM[a.saude.status] ?? 99; vb = FAROL_ORDEM[b.saude.status] ?? 99; }
            if (va < vb) return portExecOrdenacaoAtual.direcao === 'asc' ? -1 : 1;
            if (va > vb) return portExecOrdenacaoAtual.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }
    const arr = c => portExecOrdenacaoAtual.campo === c ? (portExecOrdenacaoAtual.direcao === 'asc' ? ' ▲' : ' ▼') : '';

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

        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto hidden md:block">
            <table class="w-full text-left text-xs">
                <thead><tr class="bg-gray-50 uppercase text-[10px] text-gray-500 border-b select-none">
                    <th class="p-3">Código</th>
                    <th class="p-3">Projeto</th>
                    <th class="p-3 cursor-pointer hover:text-gray-800" onclick="ordenarPortfolioExecutivo('area')">Área${arr('area')}</th>
                    <th class="p-3 cursor-pointer hover:text-gray-800" onclick="ordenarPortfolioExecutivo('responsavel')">Responsável${arr('responsavel')}</th>
                    <th class="p-3 cursor-pointer hover:text-gray-800" onclick="ordenarPortfolioExecutivo('fase')">Fase${arr('fase')}</th>
                    <th class="p-3 text-right cursor-pointer hover:text-gray-800" onclick="ordenarPortfolioExecutivo('investimento')">Investimento${arr('investimento')}</th>
                    <th class="p-3 cursor-pointer hover:text-gray-800" onclick="ordenarPortfolioExecutivo('saude')">Saúde${arr('saude')}</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${comSaude.length === 0 ? '<tr><td colspan="7" class="p-6 text-center text-gray-400 italic">Nenhum projeto no filtro atual.</td></tr>' : comSaude.map(({ p, saude }) => `
                        <tr class="hover:bg-gray-50 cursor-pointer" onclick="abrirDetalheProjeto('${p.codigo}', 'portfolio_executivo')">
                            <td class="p-3 font-mono font-bold">${escapeHtml(p.codigo)}</td>
                            <td class="p-3">${escapeHtml(p.nome || '')}</td>
                            <td class="p-3">${escapeHtml(p.area || '-')}</td>
                            <td class="p-3">${escapeHtml(p.pessoa_solicitante || '-')}</td>
                            <td class="p-3">${escapeHtml(p.etapa_atual || 'Business Case')}</td>
                            <td class="p-3 text-right font-mono">${formatCurrency(Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0)}</td>
                            <td class="p-3">${saude.html}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Versão em cartão, só em telas estreitas (mesmo padrão de dashCardsBody) -->
        <div class="md:hidden space-y-2">
            ${comSaude.length === 0 ? '<p class="text-center text-gray-400 italic p-4">Nenhum projeto no filtro atual.</p>' : comSaude.map(({ p, saude }) => `
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-pointer" onclick="abrirDetalheProjeto('${p.codigo}', 'portfolio_executivo')">
                    <div class="flex items-start justify-between mb-1 gap-2">
                        <div class="min-w-0">
                            <div class="text-xs font-mono font-bold text-gray-800">${escapeHtml(p.codigo)}</div>
                            <div class="text-xs text-gray-600 truncate">${escapeHtml(p.nome || '')}</div>
                        </div>
                        ${saude.html}
                    </div>
                    <div class="text-[10px] text-gray-400">${escapeHtml(p.area || '-')} · ${escapeHtml(p.pessoa_solicitante || '-')} · ${escapeHtml(p.etapa_atual || 'Business Case')} · ${formatCurrency(Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0)}</div>
                </div>
            `).join('')}
        </div>
    `;
    _portExecUltimaLista = comSaude; // V25
}

// V25 — Exportação CSV da lista filtrada atual
function exportarPortfolioExecutivoCSV() {
    if (!_portExecUltimaLista.length) return alert('Nenhum projeto na lista atual para exportar.');
    exportarCSV(
        ['Código', 'Nome', 'Área', 'Responsável', 'Fase', 'Investimento (R$)', 'Realizado (R$)', 'Saúde'],
        _portExecUltimaLista.map(({ p, saude }) => [
            p.codigo || '',
            p.nome || '',
            p.area || '',
            p.pessoa_solicitante || '',
            p.etapa_atual || 'BUSINESS CASE',
            Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0,
            Number(p.realizado) || 0,
            saude.status || ''
        ]),
        'portfolio_executivo'
    );
}

function onMudarSeletorAFPortfolioExecutivo() {
    modoAFPortfolioExecutivo = document.getElementById('portExecSeletorAF').value;
    renderPortfolioExecutivoView();
}
