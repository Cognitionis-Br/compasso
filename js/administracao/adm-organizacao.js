// =============================================================================
// administracao/adm-organizacao.js — Fase 1A · A4
// SCR-24 VIEWs: adm_equipes, adm_aptidoes, adm_alcadas, adm_delegacoes,
//               adm_sod, adm_workflow, adm_sla
// =============================================================================

// ─── Dispatcher ──────────────────────────────────────────────────────────────
document.addEventListener('adm:view-activated', ({ detail: { tabId } }) => {
    const h = {
        adm_equipes:    _admEquipesLoad,
        adm_aptidoes:   _admAptidoesLoad,
        adm_alcadas:    _admAlcadasLoad,
        adm_delegacoes: _admDelegacoesLoad,
        adm_sod:        _admSodLoad,
        adm_workflow:   _admWorkflowLoad,
        adm_sla:        _admSlaLoad,
    };
    if (h[tabId]) h[tabId]();
});

// ─── Helpers locais ───────────────────────────────────────────────────────────
function _admOrgQuem() {
    return (typeof currentUser !== 'undefined' && currentUser?.nome) ? currentUser.nome : 'sistema';
}
function _admOrgPode() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador)
        || (typeof ehProprietario !== 'undefined' && ehProprietario);
}
function _admNaView(tabId, icon, titulo, corpo) {
    admSetState(tabId, 'na');
    const el = admGetContentEl(tabId);
    if (!el) return;
    el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
        <i class="${icon} text-3xl text-gray-300 mb-3"></i>
        <p class="text-sm font-semibold text-gray-500 mb-1">${titulo}</p>
        <p class="text-xs text-gray-400 max-w-sm">${corpo}</p>
    </div>`;
    admSetState(tabId, 'content');
}

// =============================================================================
// VIEW: adm_equipes — Responsáveis por Atividade
// Tabelas: usuario_atividades_responsavel, responsaveis_atividades (legado)
// =============================================================================
const _ETAPAS_ADM = [
    'FORMALIZAÇÃO DEMANDA', 'REALIZAR ORÇAMENTO', 'APROVAR ORÇAMENTO POR PROJETO',
    'APROVAR ORÇAMENTO ANO FISCAL', 'GERAR REQUERIMENTOS', 'APROVAR REQUERIMENTOS NEGÓCIO',
    'APROVAR REQUERIMENTOS TI', 'FECHAR REQUERIMENTOS', 'GERAR ESPECIFICAÇÃO',
    'AVALIAR ESPECIFICAÇÃO NEGÓCIO', 'FECHAR ESPECIFICAÇÃO', 'EXECUTAR (EXECUTION)',
    'EXECUTAR (UAT)', 'EXECUTAR (GO-LIVE)', 'GESTÃO DE EMAIL',
];

async function _admEquipesLoad() {
    admSetState('adm_equipes', 'loading');
    if (typeof loadResponsaveis === 'function') await loadResponsaveis();
    // Fallback: se loadResponsaveis não existir ou não populou usuariosData
    if (typeof usuariosData === 'undefined' || !usuariosData) {
        const { data } = await _supabase.from('perfis_usuarios').select('*').order('nome');
        if (typeof usuariosData !== 'undefined') usuariosData = data || [];
    }
    _admEquipesRender();
}

function _admEquipesRender() {
    const el = admGetContentEl('adm_equipes');
    if (!el) return;
    const atribuicoes = typeof usuarioAtividadesData !== 'undefined' ? usuarioAtividadesData : [];
    const usuarios = typeof usuariosData !== 'undefined' ? usuariosData : [];
    const podeEscrever = _admOrgPode();

    const actEl = document.getElementById('adm-header-actions-adm_equipes');
    if (actEl && !actEl.dataset.cadInit && podeEscrever) {
        actEl.dataset.cadInit = '1';
        actEl.innerHTML = `<button onclick="admEquipesNovoForm()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                   bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
            <i class="fa-solid fa-user-plus"></i>Atribuir Atividades</button>`;
    }

    el.innerHTML = `
    <div id="adm-eq-form" class="hidden mb-4"></div>
    <div id="adm-eq-legado"></div>
    <div id="adm-eq-list"></div>`;

    // Relatório de e-mails não migrados (legado)
    const naoCasados = _admEquipesNaoCasados();
    if (naoCasados.length) {
        document.getElementById('adm-eq-legado').innerHTML = `
        <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
            <div class="font-semibold text-amber-700 mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>
                ${naoCasados.length} responsável(is) legado(s) sem usuário correspondente</div>
            <table class="w-full text-xs">
                <thead><tr class="text-amber-600 uppercase"><th class="text-left pb-1">Nome</th><th class="text-left pb-1">E-mail</th><th class="text-left pb-1">Atividades</th></tr></thead>
                <tbody>${naoCasados.map(r => `<tr>
                    <td class="py-0.5 font-semibold">${escapeHtml(r.nome)}</td>
                    <td class="py-0.5 text-gray-500">${escapeHtml(r.email)}</td>
                    <td class="py-0.5 text-gray-500">${(Array.isArray(r.atividades_permitidas) ? r.atividades_permitidas : []).join(', ') || '-'}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;
    }

    const com = [...new Set(atribuicoes.map(a => a.usuario_id))];
    if (!com.length) {
        document.getElementById('adm-eq-list').innerHTML =
            `<div class="py-10 text-center text-gray-400"><i class="fa-solid fa-users-gear text-2xl mb-2 block"></i>Nenhuma atribuição cadastrada</div>`;
        admSetState('adm_equipes', 'empty');
        return;
    }

    document.getElementById('adm-eq-list').innerHTML = `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Usuário</th>
                <th class="px-3 py-2.5 text-left font-medium">Atividades</th>
                ${podeEscrever ? '<th class="px-3 py-2.5 text-left font-medium">Ações</th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${com.map(uid => {
                const u = usuarios.find(x => x.id === uid);
                const ativs = atribuicoes.filter(a => a.usuario_id === uid).map(a => a.nome_etapa);
                const badges = ativs.map(a =>
                    `<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 mr-1 mb-0.5">${escapeHtml(a)}</span>`
                ).join('');
                return `<tr>
                    <td class="px-3 py-2.5">
                        <div class="font-semibold text-gray-800">${u ? escapeHtml(u.nome) : '(usuário não encontrado)'}</div>
                        <div class="text-xs text-gray-400">${u ? escapeHtml(u.email || '') : ''}</div>
                    </td>
                    <td class="px-3 py-2.5">${badges || '<span class="text-gray-400 italic text-xs">Nenhuma</span>'}</td>
                    ${podeEscrever ? `<td class="px-3 py-2.5 whitespace-nowrap">
                        <button onclick="admEquipesEditar('${uid}')" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-2">
                            <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                        <button onclick="admEquipesRemover('${uid}')" class="text-xs font-semibold text-red-500 hover:text-red-700">
                            <i class="fa-solid fa-trash"></i> Remover</button>
                    </td>` : ''}
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
    admSetState('adm_equipes', 'content');
}

function _admEquipesNaoCasados() {
    if (typeof responsaveisLegadoData === 'undefined') return [];
    const emails = new Set((typeof usuariosData !== 'undefined' ? usuariosData : []).map(u => (u.email || '').toLowerCase()));
    return (responsaveisLegadoData || []).filter(r => !emails.has((r.email || '').toLowerCase()));
}

function _admEquipesAbrirForm(usuarioId) {
    const panel = document.getElementById('adm-eq-form');
    if (!panel) return;
    const usuarios = (typeof usuariosData !== 'undefined' ? usuariosData : []).filter(u => u.ativo !== false);
    const atribuicoes = typeof usuarioAtividadesData !== 'undefined' ? usuarioAtividadesData : [];
    const jaAtribuidos = new Set(atribuicoes.map(a => a.usuario_id));
    const usuariosOpts = usuarios
        .map(u => `<option value="${u.id}" ${u.id === usuarioId ? 'selected' : ''}>${escapeHtml(u.nome)} (${escapeHtml(u.email || '')})</option>`)
        .join('');
    const atividadesDoUsuario = usuarioId
        ? atribuicoes.filter(a => a.usuario_id === usuarioId).map(a => a.nome_etapa)
        : [];
    const checkboxes = _ETAPAS_ADM.map((etapa, i) => `
        <label class="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" class="adm-eq-checkbox w-3.5 h-3.5" value="${escapeHtml(etapa)}" ${atividadesDoUsuario.includes(etapa) ? 'checked' : ''}>
            <span>${escapeHtml(etapa)}</span>
        </label>`).join('');
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">Atribuir Atividades</span>
            <button onclick="admEquipesFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mb-3">
            <label class="block text-xs font-medium text-gray-600 mb-1">Usuário *</label>
            <select id="adm-eq-usuario-sel"
                class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">-- Selecione --</option>${usuariosOpts}
            </select>
        </div>
        <div class="mb-3">
            <label class="block text-xs font-medium text-gray-600 mb-2">Atividades que este usuário pode executar</label>
            <div class="grid grid-cols-2 gap-1.5 p-3 bg-white rounded border border-gray-200">${checkboxes}</div>
        </div>
        <button onclick="admEquipesSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar Atribuições</button>
    </div>`;
    panel.classList.remove('hidden');
    if (usuarioId) {
        const sel = document.getElementById('adm-eq-usuario-sel');
        if (sel) sel.value = usuarioId;
    }
}

function admEquipesNovoForm() { _admEquipesAbrirForm(null); }
function admEquipesEditar(uid) { _admEquipesAbrirForm(uid); }
function admEquipesFecharForm() {
    const p = document.getElementById('adm-eq-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

async function admEquipesSalvar() {
    if (!_admOrgPode()) return alert('Sem permissão.');
    const uid = document.getElementById('adm-eq-usuario-sel')?.value;
    if (!uid) return alert('Selecione um usuário.');
    const selecionadas = Array.from(document.querySelectorAll('.adm-eq-checkbox:checked')).map(c => c.value);
    const { error: e1 } = await _supabase.from('usuario_atividades_responsavel').delete().eq('usuario_id', uid);
    if (e1) return alert('Erro: ' + e1.message);
    if (selecionadas.length) {
        const { error: e2 } = await _supabase.from('usuario_atividades_responsavel').insert(
            selecionadas.map(nome_etapa => ({ usuario_id: uid, nome_etapa, atribuido_por: _admOrgQuem() }))
        );
        if (e2) return alert('Erro: ' + e2.message);
    }
    admEquipesFecharForm();
    await _admEquipesLoad();
}

async function admEquipesRemover(uid) {
    if (!_admOrgPode()) return alert('Sem permissão.');
    if (!confirm('Remover todas as atividades atribuídas a este usuário?')) return;
    const { error } = await _supabase.from('usuario_atividades_responsavel').delete().eq('usuario_id', uid);
    if (error) return alert('Erro: ' + error.message);
    await _admEquipesLoad();
}

// =============================================================================
// VIEWs N/A: adm_aptidoes, adm_alcadas, adm_delegacoes, adm_sod
// =============================================================================
function _admAptidoesLoad() {
    _admNaView('adm_aptidoes', 'fa-solid fa-star',
        'Aptidões e Competências',
        'Catálogo de competências técnicas e comportamentais. Previsto para uma próxima fase do módulo ADM.');
}
function _admAlcadasLoad() {
    _admNaView('adm_alcadas', 'fa-solid fa-scale-balanced',
        'Alçadas de Aprovação',
        'Regras de alçada por valor e tipo de projeto. Previsto para uma próxima fase do módulo ADM.');
}
function _admDelegacoesLoad() {
    _admNaView('adm_delegacoes', 'fa-solid fa-arrow-right-arrow-left',
        'Delegações de Autoridade',
        'Registro temporário de delegações entre gestores. Previsto para uma próxima fase do módulo ADM.');
}
function _admSodLoad() {
    _admNaView('adm_sod', 'fa-solid fa-shield-halved',
        'Segregação de Funções (SoD)',
        'Conflito de papéis e regras de separação de atribuições. Previsto para uma próxima fase do módulo ADM.');
}

// =============================================================================
// VIEW: adm_workflow — Fases e Etapas do Workflow
// Tabelas: fases_etapas, sla_etapa_porte
// =============================================================================
async function _admWorkflowLoad() {
    admSetState('adm_workflow', 'loading');
    if (typeof loadFasesEtapas === 'function') await loadFasesEtapas();
    _admWorkflowRender();
}

function _admWorkflowRender() {
    const el = admGetContentEl('adm_workflow');
    if (!el) return;
    const etapas = typeof fasesEtapasData !== 'undefined' ? fasesEtapasData : [];
    const portes = (typeof portesData !== 'undefined' ? [...portesData] : []).sort((a, b) => a.horas_minimo - b.horas_minimo);
    const podeEscrever = _admOrgPode();

    el.innerHTML = `
    <div id="adm-wf-form" class="hidden mb-4"></div>
    <div class="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <i class="fa-solid fa-circle-info mr-1"></i>
        Fase, etapa e ordem são parametrizadas por código. Esta tela permite editar
        o <strong>gerente de fase</strong> e o <strong>SLA por porte</strong> de cada etapa.
    </div>
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium w-6">Ord.</th>
                <th class="px-3 py-2.5 text-left font-medium">Fase</th>
                <th class="px-3 py-2.5 text-left font-medium">Etapa</th>
                <th class="px-3 py-2.5 text-left font-medium">Gerente de Fase</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                ${podeEscrever ? '<th class="px-3 py-2.5 text-left font-medium">Ações</th>' : ''}
            </tr></thead>
            <tbody id="adm-wf-tbody" class="divide-y divide-gray-100">
            ${!etapas.length ? `<tr><td colspan="6" class="py-10 text-center text-gray-400">
                Nenhuma etapa cadastrada — rode schema_motor_workflow.sql</td></tr>` :
            etapas.map(e => {
                const inativa = e.ativo === false;
                const gerente = e.gerente_fase_nome || '-';
                return `<tr id="adm-wf-row-${e.id}" class="${inativa ? 'opacity-50' : ''}">
                    <td class="px-3 py-2.5 text-xs font-mono text-gray-500">${e.ordem}</td>
                    <td class="px-3 py-2.5 text-xs font-semibold text-gray-600">${escapeHtml(e.fase)}</td>
                    <td class="px-3 py-2.5 text-xs">${escapeHtml(e.etapa)}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-500">${escapeHtml(gerente)}
                        ${e.gerente_fase_email ? `<div class="text-[10px] text-gray-400">${escapeHtml(e.gerente_fase_email)}</div>` : ''}</td>
                    <td class="px-3 py-2.5">
                        ${inativa
                            ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Inativa</span>'
                            : '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Ativa</span>'}
                    </td>
                    ${podeEscrever ? `<td class="px-3 py-2.5 whitespace-nowrap">
                        <button onclick="admWfEditarGerente(${e.id})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-2">
                            <i class="fa-solid fa-user-pen"></i> Gerente</button>
                        <button onclick="admWfToggleSla(${e.id})" class="text-xs font-semibold text-amber-600 hover:text-amber-800">
                            <i class="fa-solid fa-clock"></i> SLA</button>
                    </td>` : ''}
                </tr>
                <tr id="adm-wf-sla-${e.id}" class="hidden bg-amber-50">
                    <td colspan="${podeEscrever ? 6 : 5}" class="px-4 py-3">
                        ${_admWfSlaHtml(e.id, portes)}
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
    admSetState('adm_workflow', etapas.length ? 'content' : 'empty');
}

function _admWfSlaHtml(etapaId, portes) {
    const slas = typeof slaEtapaPorteData !== 'undefined' ? slaEtapaPorteData : [];
    const campos = portes.map(p => {
        const linha = slas.find(s => s.etapa_id === etapaId && s.porte === p.codigo);
        return `<div>
            <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Porte ${p.codigo}</label>
            <input type="number" min="0" class="adm-wf-sla-input w-16 px-2 py-1 border border-amber-200 rounded text-xs font-mono"
                data-etapa="${etapaId}" data-porte="${p.codigo}" value="${linha ? linha.dias_uteis : ''}" placeholder="dias">
        </div>`;
    }).join('');
    return `<div class="flex items-end gap-3 flex-wrap">
        <span class="text-xs font-semibold text-amber-700 self-center">SLA por Porte (dias úteis):</span>
        ${campos}
        <button onclick="admWfSalvarSla(${etapaId})"
            class="px-3 py-1 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
        <button onclick="admWfToggleSla(${etapaId})" class="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
    </div>`;
}

function admWfToggleSla(id) {
    const row = document.getElementById(`adm-wf-sla-${id}`);
    if (row) row.classList.toggle('hidden');
}

async function admWfSalvarSla(etapaId) {
    if (!_admOrgPode()) return alert('Sem permissão.');
    const inputs = document.querySelectorAll(`.adm-wf-sla-input[data-etapa="${etapaId}"]`);
    const linhas = Array.from(inputs)
        .filter(i => i.value !== '')
        .map(i => ({ etapa_id: etapaId, porte: i.getAttribute('data-porte'), dias_uteis: parseInt(i.value) || 0 }));
    for (const l of linhas) {
        const { error } = await _supabase.from('sla_etapa_porte').upsert(l, { onConflict: 'etapa_id,porte' });
        if (error) return alert('Erro ao salvar SLA: ' + error.message);
    }
    admWfToggleSla(etapaId);
    if (typeof loadFasesEtapas === 'function') await loadFasesEtapas();
    _admWorkflowRender();
}

function admWfEditarGerente(id) {
    const etapa = (typeof fasesEtapasData !== 'undefined' ? fasesEtapasData : []).find(e => e.id === id);
    if (!etapa) return;
    const panel = document.getElementById('adm-wf-form');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">Gerente de Fase — ${escapeHtml(etapa.etapa)}</span>
            <button onclick="admWfFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome do Gerente</label>
                <input id="adm-wf-gerente-nome" type="text" value="${escapeHtml(etapa.gerente_fase_nome || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">E-mail do Gerente</label>
                <input id="adm-wf-gerente-email" type="email" value="${escapeHtml(etapa.gerente_fase_email || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <div class="flex gap-2 mb-3">
            <label class="flex items-center gap-2 text-xs">
                <input id="adm-wf-req-decisao" type="checkbox" class="w-4 h-4" ${etapa.requer_decisao_aprovacao ? 'checked' : ''}>
                Requer decisão/aprovação
            </label>
            <label class="flex items-center gap-2 text-xs">
                <input id="adm-wf-req-orcamento" type="checkbox" class="w-4 h-4" ${etapa.requer_definicao_orcamento ? 'checked' : ''}>
                Requer definição de orçamento
            </label>
        </div>
        <input type="hidden" id="adm-wf-etapa-id" value="${id}">
        <button onclick="admWfSalvarGerente()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('adm-wf-gerente-nome')?.focus();
}

function admWfFecharForm() {
    const p = document.getElementById('adm-wf-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

async function admWfSalvarGerente() {
    if (!_admOrgPode()) return alert('Sem permissão.');
    const id = Number(document.getElementById('adm-wf-etapa-id')?.value);
    const gerente_fase_nome = (document.getElementById('adm-wf-gerente-nome')?.value || '').trim() || null;
    const gerente_fase_email = (document.getElementById('adm-wf-gerente-email')?.value || '').trim() || null;
    const requer_decisao_aprovacao = document.getElementById('adm-wf-req-decisao')?.checked ?? false;
    const requer_definicao_orcamento = document.getElementById('adm-wf-req-orcamento')?.checked ?? false;
    const { error } = await _supabase.from('fases_etapas')
        .update({ gerente_fase_nome, gerente_fase_email, requer_decisao_aprovacao, requer_definicao_orcamento })
        .eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    admWfFecharForm();
    if (typeof loadFasesEtapas === 'function') await loadFasesEtapas();
    _admWorkflowRender();
}

// =============================================================================
// VIEW: adm_sla — Matriz de SLA por Fase × Porte (leitura)
// =============================================================================
async function _admSlaLoad() {
    admSetState('adm_sla', 'loading');
    if (typeof loadFasesEtapas === 'function') await loadFasesEtapas();
    _admSlaRender();
}

function _admSlaRender() {
    const el = admGetContentEl('adm_sla');
    if (!el) return;
    const etapas = (typeof fasesEtapasData !== 'undefined' ? fasesEtapasData : []).filter(e => e.ativo !== false);
    const slas = typeof slaEtapaPorteData !== 'undefined' ? slaEtapaPorteData : [];
    const portes = (typeof portesData !== 'undefined' ? [...portesData] : []).sort((a, b) => a.horas_minimo - b.horas_minimo);

    if (!portes.length || !etapas.length) {
        el.innerHTML = `<div class="py-10 text-center text-gray-400 text-sm">
            ${!portes.length ? 'Nenhum porte cadastrado — acesse Cadastros → Portes.' : 'Nenhuma etapa ativa no workflow.'}
        </div>`;
        admSetState('adm_sla', 'empty');
        return;
    }

    const colunas = portes.map(p => `<th class="px-3 py-2.5 text-center font-medium">Porte ${escapeHtml(p.codigo)}</th>`).join('');
    const linhas = etapas.map(e => {
        const cells = portes.map(p => {
            const linha = slas.find(s => s.etapa_id === e.id && s.porte === p.codigo);
            const dias = linha ? linha.dias_uteis : null;
            return `<td class="px-3 py-2.5 text-center font-mono text-xs ${dias === null ? 'text-gray-300' : 'text-gray-700 font-semibold'}">
                ${dias !== null ? dias + ' d.u.' : '—'}
            </td>`;
        }).join('');
        return `<tr class="border-b border-gray-100">
            <td class="px-3 py-2.5 text-xs font-semibold text-gray-500">${escapeHtml(e.fase)}</td>
            <td class="px-3 py-2.5 text-xs">${escapeHtml(e.etapa)}</td>
            ${cells}
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div class="mb-3 text-xs text-gray-500">
        Matriz lida de <code>sla_etapa_porte</code>. Para editar, acesse
        <button onclick="switchTab('adm_workflow')" class="text-indigo-600 underline hover:no-underline">Fases e Etapas do Workflow</button>
        e clique no botão SLA de cada etapa.
    </div>
    <div class="border border-gray-200 rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Fase</th>
                <th class="px-3 py-2.5 text-left font-medium">Etapa</th>
                ${colunas}
            </tr></thead>
            <tbody>${linhas}</tbody>
        </table>
    </div>`;
    admSetState('adm_sla', 'content');
}
