// =========================================================================
// consultas/consulta-projetos.js
// NOVO (a pedido do usuário 25/08/2026): tela "Consultas" — cópia
// segregada do quadro "Status Detalhado da Carteira" do Dashboard
// (js/dashboards/dashboard.js), como tela própria: mesmos filtros
// (Área/Fase/Status) e mesma ordenação clicável (Área/Fase/Farol, com
// padrão pelo número sequencial do código do projeto — ver
// extrairNumeroSequencialCodigo em dashboard.js), mas com seu próprio
// seletor de Ano Fiscal (padrão "todos") e sem depender do estado da
// tela de Dashboard.
// =========================================================================

function popularFiltrosConsulta() {
    const selArea = document.getElementById('consultaFiltroArea');
    if (selArea) {
        const atual = selArea.value;
        const areasUnicas = [...new Set(projectsData.map(p => p.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selArea.innerHTML = '<option value="">-- Todas --</option>' + areasUnicas.map(a => `<option value="${a}" ${a === atual ? 'selected' : ''}>${a}</option>`).join('');
    }

    const selStatus = document.getElementById('consultaFiltroStatus');
    if (selStatus) {
        const atual = selStatus.value;
        const statusUnicos = [...new Set(projectsData.map(p => p.sub_status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selStatus.innerHTML = '<option value="">-- Todos --</option>' + statusUnicos.map(s => `<option value="${s}" ${s === atual ? 'selected' : ''}>${s}</option>`).join('');
    }
}

let consultaOrdenacaoAtual = { campo: 'padrao', direcao: 'asc' };

function ordenarConsultaProjetos(campo) {
    if (consultaOrdenacaoAtual.campo === campo) {
        consultaOrdenacaoAtual.direcao = consultaOrdenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        consultaOrdenacaoAtual.campo = campo;
        consultaOrdenacaoAtual.direcao = 'asc';
    }
    ['area', 'fase', 'farol'].forEach(c => {
        const el = document.getElementById(`ordArrowConsulta-${c}`);
        if (el) el.innerText = c === campo ? (consultaOrdenacaoAtual.direcao === 'asc' ? '▲' : '▼') : '';
    });
    renderConsultaProjetos();
}

async function renderConsultaProjetos() {
    const tbody = document.getElementById('consultaTableBody');
    if (!tbody) return;

    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista();
    if (typeof montarSeletorAF === 'function') modoAFConsulta = montarSeletorAF('consultaSeletorAF', modoAFConsulta);
    renderFaixaAFSelecionado('consultaFaixaAFSelecionado', modoAFConsulta);
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const projectsDataFiltrado = filtrarProjetosPorArea(filtrarProjetosPorAnoFiscalSelecionado(projectsData, modoAFConsulta), 'consultas');

    const { data: todasEtapasCache } = await _supabase.from('projeto_etapas').select('*');

    popularFiltrosConsulta();
    const filtroArea = (document.getElementById('consultaFiltroArea') || {}).value || '';
    const filtroFase = (document.getElementById('consultaFiltroFase') || {}).value || '';
    const filtroStatus = (document.getElementById('consultaFiltroStatus') || {}).value || '';

    const projetosFiltrados = projectsDataFiltrado.filter(p => {
        if (filtroArea && (p.area || '') !== filtroArea) return false;
        if (filtroFase && (p.etapa_atual || 'BUSINESS CASE').toUpperCase() !== filtroFase) return false;
        if (filtroStatus && (p.sub_status || '') !== filtroStatus) return false;
        return true;
    });

    const cardsBody = document.getElementById('consultaCardsBody');

    if (projetosFiltrados.length === 0) {
        const msgVazia = projectsDataFiltrado.length === 0 ? 'Nenhum projeto cadastrado no portfólio' : 'Nenhum projeto encontrado com esses filtros';
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        if (cardsBody) cardsBody.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        return;
    }

    const FAROL_ORDEM = { CRITICO: 0, ATENCAO: 1, HOLD: 2, SAUDAVEL: 3, INATIVO: 4 };
    let projetosComSaude = projetosFiltrados.map(p => ({ p, saude: calcularSaudeProjeto(p, todasEtapasCache || []) }));

    if (consultaOrdenacaoAtual.campo === 'padrao') {
        projetosComSaude.sort((a, b) => extrairNumeroSequencialCodigo(a.p.codigo) - extrairNumeroSequencialCodigo(b.p.codigo));
    } else if (consultaOrdenacaoAtual.campo) {
        projetosComSaude.sort((a, b) => {
            let va, vb;
            if (consultaOrdenacaoAtual.campo === 'area') { va = (a.p.area || '').toUpperCase(); vb = (b.p.area || '').toUpperCase(); }
            else if (consultaOrdenacaoAtual.campo === 'fase') { va = (a.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); vb = (b.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); }
            else if (consultaOrdenacaoAtual.campo === 'farol') { va = FAROL_ORDEM[a.saude.status] ?? 99; vb = FAROL_ORDEM[b.saude.status] ?? 99; }
            if (va < vb) return consultaOrdenacaoAtual.direcao === 'asc' ? -1 : 1;
            if (va > vb) return consultaOrdenacaoAtual.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let linhasTabela = '';
    let cartoes = '';
    projetosComSaude.forEach(({ p, saude }) => {
        const qualif = (p.tipo_qualificacao || 'REG').toUpperCase();
        const badgeQualif = qualif === 'GROW' ? 'bg-purple-100 text-purple-800' : qualif === 'RUN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
        const valPrevisto = (Number(p.val_bc) || Number(p.previsto) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});
        const valRealizado = (Number(p.realizado) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});

        linhasTabela += `
            <tr>
                <td class="p-3 font-bold font-mono"><button onclick="abrirDetalheProjeto('${p.codigo}', 'consultas')" class="text-red-700 hover:text-red-900 hover:underline" title="Ver detalhamento completo">${p.codigo}</button></td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)} <br><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif}">${qualif}</span>${p.is_adhoc ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 ml-1">Extraordinário</span>' : ''}${p.is_carryover ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-800 ml-1">Carryover</span>' : ''}${p.is_subprojeto ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-100 text-cyan-800 ml-1">Subprojeto de ' + escapeHtml(p.projeto_pai_codigo) + '</span>' : ''}${p.projeto_concluido ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 ml-1">🏁 Concluído</span>' : ''}</td>
                <td class="p-3 text-xs font-bold">${p.area || '-'}</td>
                <td class="p-3 text-xs">${p.tipo_orcamento || '-'}</td>
                <td class="p-3 text-xs font-bold">${p.etapa_atual || 'BUSINESS CASE'}</td>
                <td class="p-3 text-xs">${p.sub_status || '-'}</td>
                <td class="p-3 font-mono text-right">R$ ${valPrevisto}</td>
                <td class="p-3 font-mono text-right text-red-600">R$ ${valRealizado}</td>
                <td class="p-3 text-xs text-center">${saude.html}</td>
            </tr>
        `;

        cartoes += `
            <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <button onclick="abrirDetalheProjeto('${p.codigo}', 'consultas')" class="text-red-700 font-mono font-bold text-sm hover:underline text-left">${p.codigo}</button>
                    ${saude.html}
                </div>
                <div class="font-semibold text-sm text-gray-800 mb-1">${escapeHtml(p.nome)}</div>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif} inline-block mb-2">${qualif}</span>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 border-t pt-2">
                    <div><span class="text-gray-400">Área:</span> <b>${p.area || '-'}</b></div>
                    <div><span class="text-gray-400">Tipo:</span> <b>${p.tipo_orcamento || '-'}</b></div>
                    <div><span class="text-gray-400">Fase:</span> <b>${p.etapa_atual || 'BUSINESS CASE'}</b></div>
                    <div><span class="text-gray-400">Status:</span> <b>${p.sub_status || '-'}</b></div>
                    <div><span class="text-gray-400">Previsto:</span> <b>R$ ${valPrevisto}</b></div>
                    <div><span class="text-gray-400">Realizado:</span> <b class="text-red-600">R$ ${valRealizado}</b></div>
                </div>
            </div>
        `;
    });

    tbody.innerHTML = linhasTabela;
    if (cardsBody) cardsBody.innerHTML = cartoes;
}
