// =========================================================================
// governanca/troca-responsavel-atividade.js
// "Troca de Responsável nas Atividades dos Projetos" — menu Governança.
//
// Lista as atividades/etapas de projeto (projeto_etapas) ainda não
// concluídas, com o responsável atual, e permite reatribuir — um a um ou
// em lote (mesma etapa) — para quem saiu do time / trocou de função. É
// também a base do perfil OPERADOR: quem tem
// funcoes.restringe_por_atividade_responsavel só enxerga projeto onde é
// responsavel_etapa_email de alguma linha aqui (ver
// js/config/funcoes.js:filtrarProjetosPorArea).
//
// Acesso via catálogo: troca_responsavel_atividade (consultar/alterar,
// mesmo padrão de mudanca_orcamento/retomar_hold — 1 atividade só, sem
// sufixo). Reaproveita obterResponsaveisPorAtividade
// (js/config/responsaveis.js) para o pool elegível por etapa — mesmo
// usado na tela de Planejamento (js/phases/generic-workflow-ui.js).
// =========================================================================

let _trocaRespFasesEtapas = [];       // cache local de fases_etapas (id, etapa, fase)
let _trocaRespEtapasCache = [];       // projeto_etapas não concluídas, já casadas com projeto/etapa
let _trocaRespSelecionados = new Set(); // ids de projeto_etapas marcados (checkbox, p/ troca em lote)
let _trocaRespAlvo = null;            // { itens: [projeto_etapas...] } — alvo do modal aberto

async function renderTrocaResponsavelAtividadeView() {
    const tbody = document.getElementById('trocaRespTableBody');
    if (!tbody) return;

    if (!usuarioTemAtividade('troca_responsavel_atividade')) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Você não tem acesso a esta tela.</td></tr>`;
        return;
    }

    if (!_trocaRespFasesEtapas.length) {
        const { data } = await _supabase.from('fases_etapas').select('id, etapa, fase');
        _trocaRespFasesEtapas = data || [];
    }
    // pool de responsáveis elegíveis por etapa (usuario_atividades_responsavel)
    if (typeof loadResponsaveis === 'function' && (!usuariosData || !usuariosData.length)) {
        await loadResponsaveis();
    }

    const { data: etapasRaw, error } = await _supabase
        .from('projeto_etapas')
        .select('*')
        .neq('situacao', 'EXECUCAO_CONCLUIDO')
        .order('projeto_codigo');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-bold">Erro ao carregar: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    // Mesma restrição de área/designação de qualquer outra tela — quem tem
    // essa atividade delegada só reatribui dentro do que já enxerga.
    const projetosVisiveis = new Set(
        (typeof filtrarProjetosPorArea === 'function' ? filtrarProjetosPorArea(projectsData || [], 'troca_responsavel_atividade') : (projectsData || []))
            .map(p => p.codigo)
    );

    _trocaRespEtapasCache = (etapasRaw || [])
        .filter(pe => projetosVisiveis.has(pe.projeto_codigo))
        .map(pe => {
            const projeto = (projectsData || []).find(p => p.codigo === pe.projeto_codigo);
            const fe = _trocaRespFasesEtapas.find(f => f.id === pe.etapa_id);
            return { ...pe, _projeto: projeto, _etapaNome: fe ? fe.etapa : ('Etapa #' + pe.etapa_id) };
        });

    _popularFiltrosTrocaResp();

    const busca = ((document.getElementById('trocaRespBuscaProjeto') || {}).value || '').trim().toUpperCase();
    const filtroEtapa = (document.getElementById('trocaRespFiltroEtapa') || {}).value || '';
    const filtroResp = (document.getElementById('trocaRespFiltroResponsavel') || {}).value || '';

    const filtradas = _trocaRespEtapasCache.filter(e => {
        if (busca && !`${e.projeto_codigo} ${e._projeto ? e._projeto.nome : ''}`.toUpperCase().includes(busca)) return false;
        if (filtroEtapa && e._etapaNome !== filtroEtapa) return false;
        if (filtroResp && (e.responsavel_etapa_nome || '') !== filtroResp) return false;
        return true;
    });

    _trocaRespSelecionados.clear();
    _atualizarBotaoLoteTrocaResp();

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhuma atividade encontrada</td></tr>`;
        return;
    }

    const podeAlterar = usuarioPodeAlterarTela('troca_responsavel_atividade');
    const SIT_LABEL = { EXECUCAO_A_INICIAR: 'A iniciar', EXECUCAO_EM_ANDAMENTO: 'Em andamento' };
    tbody.innerHTML = filtradas.map(e => `
        <tr>
            <td class="p-3">${podeAlterar ? `<input type="checkbox" onchange="toggleSelecaoTrocaResp(${e.id}, this.checked)">` : ''}</td>
            <td class="p-3 font-mono font-bold">${escapeHtml(e.projeto_codigo)}<br><span class="font-normal text-gray-500 text-[11px]">${escapeHtml(e._projeto ? e._projeto.nome : '')}</span></td>
            <td class="p-3">${escapeHtml(e._etapaNome)}</td>
            <td class="p-3 text-[10px] uppercase text-gray-500">${SIT_LABEL[e.situacao] || e.situacao || '-'}</td>
            <td class="p-3">${escapeHtml(e.responsavel_etapa_nome || '—')}</td>
            <td class="p-3 text-center">${podeAlterar ? `<button onclick="abrirModalTrocaResponsavel(${e.id})" class="text-orange-700 hover:text-orange-900 font-bold text-[11px]"><i class="fa-solid fa-right-left"></i> Trocar</button>` : '-'}</td>
        </tr>
    `).join('');
}

function _popularFiltrosTrocaResp() {
    const selEtapa = document.getElementById('trocaRespFiltroEtapa');
    if (selEtapa) {
        const atual = selEtapa.value;
        const nomes = [...new Set(_trocaRespEtapasCache.map(e => e._etapaNome))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selEtapa.innerHTML = '<option value="">-- Todas --</option>' + nomes.map(n => `<option value="${escapeHtml(n)}" ${n === atual ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
    }
    const selResp = document.getElementById('trocaRespFiltroResponsavel');
    if (selResp) {
        const atual = selResp.value;
        const nomes = [...new Set(_trocaRespEtapasCache.map(e => e.responsavel_etapa_nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selResp.innerHTML = '<option value="">-- Todos --</option>' + nomes.map(n => `<option value="${escapeHtml(n)}" ${n === atual ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
    }
}

function toggleSelecaoTrocaResp(id, marcado) {
    if (marcado) _trocaRespSelecionados.add(id); else _trocaRespSelecionados.delete(id);
    _atualizarBotaoLoteTrocaResp();
}
function toggleTodasTrocaResp(marcado) {
    document.querySelectorAll('#trocaRespTableBody input[type="checkbox"]').forEach(cb => { cb.checked = marcado; });
    _trocaRespSelecionados = marcado ? new Set(_trocaRespEtapasCache.map(e => e.id)) : new Set();
    _atualizarBotaoLoteTrocaResp();
}
function _atualizarBotaoLoteTrocaResp() {
    const btn = document.getElementById('btnTrocaRespLote');
    if (btn) btn.disabled = _trocaRespSelecionados.size === 0;
}

function abrirModalTrocaResponsavel(peId) {
    if (!usuarioPodeAlterarTela('troca_responsavel_atividade')) return alert('Você não tem permissão para trocar responsável.');
    const pe = _trocaRespEtapasCache.find(e => e.id === peId);
    if (!pe) return;
    _trocaRespAlvo = { itens: [pe] };
    _montarModalTroca(pe._etapaNome, `${pe.projeto_codigo} — ${pe._etapaNome} (atual: ${pe.responsavel_etapa_nome || '—'})`);
}

function abrirModalTrocaEmLote() {
    if (!usuarioPodeAlterarTela('troca_responsavel_atividade')) return alert('Você não tem permissão para trocar responsável.');
    const itens = _trocaRespEtapasCache.filter(e => _trocaRespSelecionados.has(e.id));
    if (!itens.length) return;
    const etapasDistintas = [...new Set(itens.map(i => i._etapaNome))];
    if (etapasDistintas.length > 1) {
        return alert('⛔ Selecione atividades da MESMA etapa para trocar em lote (o pool de responsáveis elegíveis é por etapa).');
    }
    _trocaRespAlvo = { itens };
    _montarModalTroca(etapasDistintas[0], `${itens.length} atividade(s) da etapa "${etapasDistintas[0]}"`);
}

function _montarModalTroca(etapaNome, resumoTexto) {
    document.getElementById('trocaRespModalResumo').innerText = resumoTexto;
    const sel = document.getElementById('trocaRespNovoSelect');
    const elegiveis = (typeof obterResponsaveisPorAtividade === 'function') ? obterResponsaveisPorAtividade(etapaNome) : [];
    sel.innerHTML = elegiveis.length === 0
        ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta etapa (ver Responsáveis por Atividade) --</option>'
        : ['<option value="" disabled selected>-- Selecione --</option>']
            .concat(elegiveis.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}">${escapeHtml(r.nome)}</option>`))
            .join('');
    document.getElementById('trocaRespMotivo').value = '';
    document.getElementById('modalTrocaResponsavel').classList.remove('hidden');
}

function fecharModalTrocaResponsavel() {
    const modal = document.getElementById('modalTrocaResponsavel');
    if (modal) modal.classList.add('hidden');
    _trocaRespAlvo = null;
}

async function confirmarTrocaResponsavel() {
    if (!usuarioPodeAlterarTela('troca_responsavel_atividade')) return alert('Você não tem permissão para trocar responsável.');
    if (!_trocaRespAlvo || !_trocaRespAlvo.itens || !_trocaRespAlvo.itens.length) return;

    const sel = document.getElementById('trocaRespNovoSelect');
    const opt = sel.options[sel.selectedIndex];
    const novoEmail = sel.value;
    const novoNome = opt ? opt.getAttribute('data-nome') : '';
    const motivo = document.getElementById('trocaRespMotivo').value.trim();
    if (!novoEmail) return alert('Selecione o novo responsável!');
    if (!motivo) return alert('O motivo é obrigatório!');

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();
    let falhas = 0;
    for (const pe of _trocaRespAlvo.itens) {
        const { error } = await _supabase.from('projeto_etapas')
            .update({ responsavel_etapa_nome: novoNome, responsavel_etapa_email: novoEmail })
            .eq('id', pe.id);
        if (error) { falhas++; console.error('troca responsável:', error.message); continue; }
        await _supabase.from('log_troca_responsavel_atividade').insert([{
            projeto_codigo: pe.projeto_codigo, etapa_id: pe.etapa_id, etapa_nome: pe._etapaNome,
            responsavel_anterior_nome: pe.responsavel_etapa_nome || null, responsavel_anterior_email: pe.responsavel_etapa_email || null,
            responsavel_novo_nome: novoNome, responsavel_novo_email: novoEmail,
            motivo, trocado_por: quem, trocado_em: agora
        }]);
    }

    alert(falhas
        ? `Concluído com ${falhas} falha(s) de ${_trocaRespAlvo.itens.length} — confira o console.`
        : `✅ Responsável trocado em ${_trocaRespAlvo.itens.length} atividade(s).`);
    fecharModalTrocaResponsavel();
    await renderTrocaResponsavelAtividadeView();
}
