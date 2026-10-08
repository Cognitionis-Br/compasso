// =============================================================================
// administracao/cad-cadastros.js — Fase 1A · A2 · SCR-23 Cadastros
// 7 VIEWs: cad_org, cad_cargos, cad_pessoas, cad_fornecedores,
//          cad_portes, cad_classificacoes, cad_estrategia
// =============================================================================

// ─── Dispatcher ──────────────────────────────────────────────────────────────
document.addEventListener('adm:view-activated', ({ detail: { tabId } }) => {
    const h = {
        cad_org:            _cadOrgLoad,
        cad_cargos:         _cadCargosLoad,
        cad_pessoas:        _cadPessoasLoad,
        cad_fornecedores:   _cadFornLoad,
        cad_portes:         _cadPortesLoad,
        cad_classificacoes: _cadClassLoad,
        cad_estrategia:     _cadEstLoad,
    };
    if (h[tabId]) h[tabId]();
});

// ─── Helpers compartilhados ───────────────────────────────────────────────────
function _cadQuem() {
    return (typeof currentUser !== 'undefined' && currentUser && currentUser.nome)
        ? currentUser.nome : 'sistema';
}
function _cadPodeEscrever() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador)
        || (typeof ehProprietario !== 'undefined' && ehProprietario);
}
function _cadBtnNovo(tabId, label, fnName) {
    if (!_cadPodeEscrever()) return;
    const el = document.getElementById(`adm-header-actions-${tabId}`);
    if (!el || el.dataset.cadInit) return;
    el.dataset.cadInit = '1';
    el.innerHTML = `<button onclick="${fnName}()"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
               bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
        <i class="fa-solid fa-plus"></i>${label}
    </button>`;
}
function _cadStatus(ativo) {
    return ativo
        ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Ativo</span>`
        : `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Inativo</span>`;
}
function _cadTable(cols, rows, emptyMsg) {
    if (!rows.length) return `
        <div class="py-12 text-center text-gray-400">
            <i class="fa-solid fa-inbox text-2xl mb-2 block"></i>
            <span class="text-sm">${emptyMsg || 'Nenhum registro'}</span>
        </div>`;
    return `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                ${cols.map(c => `<th class="px-3 py-2.5 text-left font-medium">${c}</th>`).join('')}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">${rows.join('')}</tbody>
        </table>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_org — areas_solicitantes
// ─────────────────────────────────────────────────────────────────────────────
const _AREA_RESERVADA = 'COGNITIONIS';

async function _cadOrgLoad() {
    admSetState('cad_org', 'loading');
    const { data, error } = await _supabase.from('areas_solicitantes').select('*').order('nome');
    if (error) { admSetState('cad_org', 'error'); return; }
    _cadBtnNovo('cad_org', 'Nova Área', 'cadOrgNovoForm');
    const el = admGetContentEl('cad_org');
    if (!el) return;
    el.innerHTML = `
        <div id="cad-org-form-panel" class="hidden mb-4"></div>
        <div id="cad-org-list"></div>`;
    _cadOrgRender(data || []);
    admSetState('cad_org', (data && data.length) ? 'content' : 'empty');
}
function _cadOrgRender(rows) {
    const list = document.getElementById('cad-org-list');
    if (!list) return;
    const podeEscrever = _cadPodeEscrever();
    list.innerHTML = _cadTable(
        ['Nome', 'Mnemônico', 'Status', podeEscrever ? 'Ações' : ''],
        rows.map(a => {
            const reservado = (a.nome || '').toUpperCase() === _AREA_RESERVADA;
            const btns = podeEscrever ? `
                <button onclick="cadOrgEditar(${a.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                    <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                ${!reservado ? `<button onclick="cadOrgToggle(${a.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                    <i class="fa-solid fa-power-off"></i> ${a.ativo ? 'Inativar' : 'Reativar'}</button>` : ''}` : '';
            return `<tr class="${!a.ativo ? 'opacity-50' : ''}">
                <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(a.nome)}
                    ${reservado ? '<span class="ml-1 text-[9px] bg-gray-200 text-gray-500 px-1 rounded uppercase">reservada</span>' : ''}</td>
                <td class="px-3 py-2.5 font-mono text-gray-500">${escapeHtml(a.mnemonico || '-')}</td>
                <td class="px-3 py-2.5">${_cadStatus(a.ativo)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
            </tr>`;
        }),
        'Nenhuma área cadastrada'
    );
}
function cadOrgNovoForm() {
    _cadOrgMostraForm({ id: null, nome: '', mnemonico: '', ativo: true });
}
function cadOrgEditar(id) {
    _supabase.from('areas_solicitantes').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadOrgMostraForm(data);
    });
}
function _cadOrgMostraForm(a) {
    const panel = document.getElementById('cad-org-form-panel');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${a.id ? 'Editar Área' : 'Nova Área'}</span>
            <button onclick="cadOrgCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input id="cad-org-nome" type="text" value="${escapeHtml(a.nome)}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Mnemônico *</label>
                <input id="cad-org-mnem" type="text" maxlength="6" value="${escapeHtml(a.mnemonico || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <input type="hidden" id="cad-org-id" value="${a.id || ''}">
        <button onclick="cadOrgSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('cad-org-nome')?.focus();
}
function cadOrgCancelar() {
    const p = document.getElementById('cad-org-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadOrgSalvar() {
    const nome = (document.getElementById('cad-org-nome')?.value || '').trim().toUpperCase();
    const mnem = (document.getElementById('cad-org-mnem')?.value || '').trim().toUpperCase();
    const id = document.getElementById('cad-org-id')?.value;
    if (!nome || !mnem) return alert('Nome e Mnemônico são obrigatórios.');
    if (nome === _AREA_RESERVADA) return alert('Nome reservado.');
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('areas_solicitantes').update({ nome, mnemonico: mnem }).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('areas_solicitantes').insert([{ nome, mnemonico: mnem, ativo: true, criado_por: _cadQuem() }]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadOrgCancelar();
    if (typeof loadAreas === 'function') await loadAreas();
    _cadOrgLoad();
}
async function cadOrgToggle(id) {
    const { data } = await _supabase.from('areas_solicitantes').select('ativo,nome').eq('id', id).single();
    if (!data) return;
    if ((data.nome || '').toUpperCase() === _AREA_RESERVADA) return;
    const { error } = await _supabase.from('areas_solicitantes').update({
        ativo: !data.ativo,
        inativado_por: data.ativo ? _cadQuem() : null,
        inativado_em:  data.ativo ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (typeof loadAreas === 'function') await loadAreas();
    _cadOrgLoad();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_cargos — cargos
// ─────────────────────────────────────────────────────────────────────────────
const _CARGO_RESERVADO = 'ANALISTA DE TECNOLOGIA';

async function _cadCargosLoad() {
    admSetState('cad_cargos', 'loading');
    const { data, error } = await _supabase.from('cargos').select('*').order('nome');
    if (error) { admSetState('cad_cargos', 'error'); return; }
    _cadBtnNovo('cad_cargos', 'Novo Cargo', 'cadCargosNovoForm');
    const el = admGetContentEl('cad_cargos');
    if (!el) return;
    el.innerHTML = `<div id="cad-cargos-form-panel" class="hidden mb-4"></div><div id="cad-cargos-list"></div>`;
    _cadCargosRender(data || [], data || []);
    admSetState('cad_cargos', (data && data.length) ? 'content' : 'empty');
}
async function _cadCargosRender(rows, all) {
    const list = document.getElementById('cad-cargos-list');
    if (!list) return;
    const podeEscrever = _cadPodeEscrever();
    // Descobre quais cargos estão em uso
    const { data: usados } = await _supabase.from('perfis_usuarios').select('cargo_id').not('cargo_id', 'is', null);
    const idsEmUso = new Set((usados || []).map(u => u.cargo_id));
    list.innerHTML = _cadTable(
        ['Nome', 'Status', podeEscrever ? 'Ações' : ''],
        rows.map(c => {
            const reservado = (c.nome || '').trim().toUpperCase() === _CARGO_RESERVADO;
            const emUso = idsEmUso.has(c.id);
            const btns = podeEscrever ? `
                ${!reservado ? `<button onclick="cadCargosEditar(${c.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                    <i class="fa-solid fa-pen-to-square"></i> ${emUso ? 'Ver' : 'Editar'}</button>` : ''}
                <button onclick="cadCargosToggle(${c.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                    <i class="fa-solid fa-power-off"></i> ${c.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
            return `<tr class="${!c.ativo ? 'opacity-50' : ''}">
                <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(c.nome)}
                    ${reservado ? '<span class="ml-1 text-[9px] bg-gray-200 text-gray-500 px-1 rounded uppercase">reservado</span>' : ''}
                    ${emUso ? '<span class="ml-1 text-[9px] bg-blue-100 text-blue-500 px-1 rounded uppercase">em uso</span>' : ''}</td>
                <td class="px-3 py-2.5">${_cadStatus(c.ativo)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
            </tr>`;
        }),
        'Nenhum cargo cadastrado'
    );
}
function cadCargosNovoForm() {
    _cadCargosMostraForm({ id: null, nome: '' });
}
function cadCargosEditar(id) {
    _supabase.from('cargos').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadCargosMostraForm(data);
    });
}
function _cadCargosMostraForm(c) {
    const panel = document.getElementById('cad-cargos-form-panel');
    if (!panel) return;
    const reservado = (c.nome || '').trim().toUpperCase() === _CARGO_RESERVADO;
    const soLeitura = reservado && c.id;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${c.id ? 'Editar Cargo' : 'Novo Cargo'}</span>
            <button onclick="cadCargosCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mb-3">
            <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input id="cad-cargos-nome" type="text" value="${escapeHtml(c.nome)}" ${soLeitura ? 'readonly' : ''}
                class="w-full max-w-sm border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400
                       ${soLeitura ? 'bg-gray-100 text-gray-500' : ''}" />
            ${reservado ? '<p class="text-xs text-amber-600 mt-1">Cargo reservado pelo sistema — nome não pode ser alterado.</p>' : ''}
        </div>
        <input type="hidden" id="cad-cargos-id" value="${c.id || ''}">
        ${!soLeitura ? `<button onclick="cadCargosSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>` : ''}
    </div>`;
    panel.classList.remove('hidden');
    if (!soLeitura) document.getElementById('cad-cargos-nome')?.focus();
}
function cadCargosCancelar() {
    const p = document.getElementById('cad-cargos-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadCargosSalvar() {
    const nome = (document.getElementById('cad-cargos-nome')?.value || '').trim().toUpperCase();
    const id = document.getElementById('cad-cargos-id')?.value;
    if (!nome) return alert('Nome é obrigatório.');
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('cargos').update({ nome }).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('cargos').insert([{ nome, ativo: true, criado_por: _cadQuem() }]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadCargosCancelar();
    if (typeof carregarCargosData === 'function') await carregarCargosData();
    _cadCargosLoad();
}
async function cadCargosToggle(id) {
    const { data } = await _supabase.from('cargos').select('ativo,nome').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from('cargos').update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (typeof carregarCargosData === 'function') await carregarCargosData();
    _cadCargosLoad();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_pessoas — pessoas_solicitantes
// ─────────────────────────────────────────────────────────────────────────────
async function _cadPessoasLoad() {
    admSetState('cad_pessoas', 'loading');
    const [{ data: pessoas, error }, { data: areas }] = await Promise.all([
        _supabase.from('pessoas_solicitantes').select('*').order('nome'),
        _supabase.from('areas_solicitantes').select('id,nome').eq('ativo', true).order('nome'),
    ]);
    if (error) { admSetState('cad_pessoas', 'error'); return; }
    _cadBtnNovo('cad_pessoas', 'Nova Pessoa', 'cadPessoasNovoForm');
    const el = admGetContentEl('cad_pessoas');
    if (!el) return;
    el.innerHTML = `<div id="cad-pessoas-form-panel" class="hidden mb-4" data-areas='${JSON.stringify(areas || [])}'></div><div id="cad-pessoas-list"></div>`;
    _cadPessoasRender(pessoas || []);
    admSetState('cad_pessoas', (pessoas && pessoas.length) ? 'content' : 'empty');
}
function _cadPessoasRender(rows) {
    const list = document.getElementById('cad-pessoas-list');
    if (!list) return;
    const podeEscrever = _cadPodeEscrever();
    list.innerHTML = _cadTable(
        ['Nome', 'E-mail', 'Área', 'Status', podeEscrever ? 'Ações' : ''],
        rows.map(p => {
            const btns = podeEscrever ? `
                <button onclick="cadPessoasEditar(${p.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                    <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                <button onclick="cadPessoasToggle(${p.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                    <i class="fa-solid fa-power-off"></i> ${p.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
            return `<tr class="${!p.ativo ? 'opacity-50' : ''}">
                <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(p.nome)}</td>
                <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(p.email || '-')}</td>
                <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(p.area || '-')}</td>
                <td class="px-3 py-2.5">${_cadStatus(p.ativo)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
            </tr>`;
        }),
        'Nenhuma pessoa cadastrada'
    );
}
function cadPessoasNovoForm() {
    _cadPessoasMostraForm({ id: null, nome: '', email: '', area: '' });
}
function cadPessoasEditar(id) {
    _supabase.from('pessoas_solicitantes').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadPessoasMostraForm(data);
    });
}
function _cadPessoasMostraForm(p) {
    const panel = document.getElementById('cad-pessoas-form-panel');
    if (!panel) return;
    const areas = JSON.parse(panel.dataset.areas || '[]');
    const optsAreas = areas.map(a => `<option value="${escapeHtml(a.nome)}" ${p.area === a.nome ? 'selected' : ''}>${escapeHtml(a.nome)}</option>`).join('');
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${p.id ? 'Editar Pessoa' : 'Nova Pessoa Solicitante'}</span>
            <button onclick="cadPessoasCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input id="cad-ps-nome" type="text" value="${escapeHtml(p.nome)}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                <input id="cad-ps-email" type="email" value="${escapeHtml(p.email || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Área *</label>
                <select id="cad-ps-area" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="">-- Selecione --</option>${optsAreas}
                </select>
            </div>
        </div>
        <input type="hidden" id="cad-ps-id" value="${p.id || ''}">
        <button onclick="cadPessoasSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('cad-ps-nome')?.focus();
}
function cadPessoasCancelar() {
    const p = document.getElementById('cad-pessoas-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadPessoasSalvar() {
    const nome = (document.getElementById('cad-ps-nome')?.value || '').trim().toUpperCase();
    const email = (document.getElementById('cad-ps-email')?.value || '').trim() || null;
    const area = (document.getElementById('cad-ps-area')?.value || '').trim();
    const id = document.getElementById('cad-ps-id')?.value;
    if (!nome || !area) return alert('Nome e Área são obrigatórios.');
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('pessoas_solicitantes').update({ nome, email, area }).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('pessoas_solicitantes').insert([{ nome, email, area, ativo: true }]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadPessoasCancelar();
    if (typeof loadPessoasSolicitantes === 'function') await loadPessoasSolicitantes();
    _cadPessoasLoad();
}
async function cadPessoasToggle(id) {
    const { data } = await _supabase.from('pessoas_solicitantes').select('ativo').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from('pessoas_solicitantes').update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (typeof loadPessoasSolicitantes === 'function') await loadPessoasSolicitantes();
    _cadPessoasLoad();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_fornecedores — empresas_terceirizadas
// ─────────────────────────────────────────────────────────────────────────────
async function _cadFornLoad() {
    admSetState('cad_fornecedores', 'loading');
    const { data, error } = await _supabase.from('empresas_terceirizadas').select('*').order('codigo');
    if (error) { admSetState('cad_fornecedores', 'error'); return; }
    _cadBtnNovo('cad_fornecedores', 'Novo Fornecedor', 'cadFornNovoForm');
    const el = admGetContentEl('cad_fornecedores');
    if (!el) return;
    el.innerHTML = `<div id="cad-forn-form-panel" class="hidden mb-4"></div><div id="cad-forn-list"></div>`;
    _cadFornRender(data || []);
    admSetState('cad_fornecedores', (data && data.length) ? 'content' : 'empty');
}
function _cadFornRender(rows) {
    const list = document.getElementById('cad-forn-list');
    if (!list) return;
    const podeEscrever = _cadPodeEscrever();
    list.innerHTML = _cadTable(
        ['Código', 'Nome', 'E-mail', 'Status', podeEscrever ? 'Ações' : ''],
        rows.map(e => {
            const btns = podeEscrever ? `
                <button onclick="cadFornEditar('${escapeHtml(e.codigo)}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                    <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                <button onclick="cadFornToggle('${escapeHtml(e.codigo)}')" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                    <i class="fa-solid fa-power-off"></i> ${e.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
            return `<tr class="${!e.ativo ? 'opacity-50' : ''}">
                <td class="px-3 py-2.5 font-mono font-bold text-gray-700">${escapeHtml(e.codigo)}</td>
                <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(e.nome)}</td>
                <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(e.email || '-')}</td>
                <td class="px-3 py-2.5">${_cadStatus(e.ativo)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
            </tr>`;
        }),
        'Nenhum fornecedor cadastrado'
    );
}
function cadFornNovoForm() {
    _cadFornMostraForm({ codigo: '', nome: '', email: '', envia_pagamento_email: false });
}
function cadFornEditar(codigo) {
    _supabase.from('empresas_terceirizadas').select('*').eq('codigo', codigo).single().then(({ data }) => {
        if (data) _cadFornMostraForm(data);
    });
}
function _cadFornMostraForm(e) {
    const panel = document.getElementById('cad-forn-form-panel');
    if (!panel) return;
    const novo = !e.codigo || e.codigo === '';
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${novo ? 'Novo Fornecedor' : 'Editar Fornecedor'}</span>
            <button onclick="cadFornCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                <input id="cad-forn-codigo" type="text" value="${escapeHtml(e.codigo)}" ${!novo ? 'readonly' : ''}
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400
                           ${!novo ? 'bg-gray-100 text-gray-500' : ''}" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input id="cad-forn-nome" type="text" value="${escapeHtml(e.nome)}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">E-mail de contato</label>
                <input id="cad-forn-email" type="email" value="${escapeHtml(e.email || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div class="flex items-center gap-2 mt-5">
                <input id="cad-forn-envia" type="checkbox" ${e.envia_pagamento_email ? 'checked' : ''}
                    class="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                <label for="cad-forn-envia" class="text-xs font-medium text-gray-600">Envia pagamentos por e-mail</label>
            </div>
        </div>
        <input type="hidden" id="cad-forn-orig" value="${escapeHtml(e.codigo)}">
        <button onclick="cadFornSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById(novo ? 'cad-forn-codigo' : 'cad-forn-nome')?.focus();
}
function cadFornCancelar() {
    const p = document.getElementById('cad-forn-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadFornSalvar() {
    const codigo = (document.getElementById('cad-forn-codigo')?.value || '').trim().toUpperCase();
    const nome = (document.getElementById('cad-forn-nome')?.value || '').trim();
    const email = (document.getElementById('cad-forn-email')?.value || '').trim() || null;
    const envia = document.getElementById('cad-forn-envia')?.checked || false;
    const orig = document.getElementById('cad-forn-orig')?.value || '';
    if (!codigo || !nome) return alert('Código e Nome são obrigatórios.');
    let err;
    if (orig) {
        ({ error: err } = await _supabase.from('empresas_terceirizadas')
            .update({ nome, email, envia_pagamento_email: envia }).eq('codigo', orig));
    } else {
        ({ error: err } = await _supabase.from('empresas_terceirizadas')
            .insert([{ codigo, nome, email, envia_pagamento_email: envia, ativo: true, criado_por: _cadQuem() }]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadFornCancelar();
    _cadFornLoad();
}
async function cadFornToggle(codigo) {
    const { data } = await _supabase.from('empresas_terceirizadas').select('ativo').eq('codigo', codigo).single();
    if (!data) return;
    const { error } = await _supabase.from('empresas_terceirizadas').update({ ativo: !data.ativo }).eq('codigo', codigo);
    if (error) return alert('Erro: ' + error.message);
    _cadFornLoad();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_portes — portes
// ─────────────────────────────────────────────────────────────────────────────
async function _cadPortesLoad() {
    admSetState('cad_portes', 'loading');
    const { data, error } = await _supabase.from('portes').select('*').order('horas_minimo');
    if (error) { admSetState('cad_portes', 'error'); return; }
    _cadBtnNovo('cad_portes', 'Novo Porte', 'cadPortesNovoForm');
    const el = admGetContentEl('cad_portes');
    if (!el) return;
    el.innerHTML = `<div id="cad-portes-form-panel" class="hidden mb-4"></div><div id="cad-portes-list"></div>`;
    _cadPortesRender(data || []);
    admSetState('cad_portes', (data && data.length) ? 'content' : 'empty');
}
function _cadPortesRender(rows) {
    const list = document.getElementById('cad-portes-list');
    if (!list) return;
    const podeEscrever = _cadPodeEscrever();
    list.innerHTML = _cadTable(
        ['Código', 'Descrição', 'Horas Mín', 'Horas Máx', 'Status', podeEscrever ? 'Ações' : ''],
        rows.map(p => {
            const btns = podeEscrever ? `
                <button onclick="cadPortesEditar(${p.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                    <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                <button onclick="cadPortesToggle(${p.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                    <i class="fa-solid fa-power-off"></i> ${p.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
            return `<tr class="${!p.ativo ? 'opacity-50' : ''}">
                <td class="px-3 py-2.5 font-mono font-bold text-gray-700">${escapeHtml(p.codigo)}</td>
                <td class="px-3 py-2.5 text-gray-800">${escapeHtml(p.descricao)}</td>
                <td class="px-3 py-2.5 text-gray-600 tabular-nums">${p.horas_minimo ?? '-'}</td>
                <td class="px-3 py-2.5 text-gray-600 tabular-nums">${p.horas_maximo ?? '-'}</td>
                <td class="px-3 py-2.5">${_cadStatus(p.ativo)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
            </tr>`;
        }),
        'Nenhum porte cadastrado'
    );
}
function cadPortesNovoForm() {
    _cadPortesMostraForm({ id: null, codigo: '', descricao: '', horas_minimo: '', horas_maximo: '' });
}
function cadPortesEditar(id) {
    _supabase.from('portes').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadPortesMostraForm(data);
    });
}
function _cadPortesMostraForm(p) {
    const panel = document.getElementById('cad-portes-form-panel');
    if (!panel) return;
    const novo = !p.id;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${novo ? 'Novo Porte' : 'Editar Porte'}</span>
            <button onclick="cadPortesCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-4 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Código * (até 2 letras)</label>
                <input id="cad-pt-codigo" type="text" maxlength="2" value="${escapeHtml(p.codigo || '')}" ${!novo ? 'readonly' : ''}
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-indigo-400
                           ${!novo ? 'bg-gray-100' : ''}" />
            </div>
            <div class="col-span-3">
                <label class="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                <input id="cad-pt-desc" type="text" value="${escapeHtml(p.descricao || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Horas Mínimo *</label>
                <input id="cad-pt-hmin" type="number" min="0" value="${p.horas_minimo ?? ''}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Horas Máximo</label>
                <input id="cad-pt-hmax" type="number" min="0" value="${p.horas_maximo ?? ''}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="vazio = ilimitado" />
            </div>
        </div>
        <input type="hidden" id="cad-pt-id" value="${p.id || ''}">
        <button onclick="cadPortesSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
        <p class="text-xs text-amber-600 mt-2">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i>
            Verifique que as faixas de horas não se sobreponham a outros portes ativos.</p>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById(novo ? 'cad-pt-codigo' : 'cad-pt-desc')?.focus();
}
function cadPortesCancelar() {
    const p = document.getElementById('cad-portes-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadPortesSalvar() {
    const codigo = (document.getElementById('cad-pt-codigo')?.value || '').trim().toUpperCase();
    const descricao = (document.getElementById('cad-pt-desc')?.value || '').trim();
    const hmin = document.getElementById('cad-pt-hmin')?.value;
    const hmax = document.getElementById('cad-pt-hmax')?.value || null;
    const id = document.getElementById('cad-pt-id')?.value;
    if (!codigo || !descricao || hmin === '') return alert('Código, Descrição e Horas Mínimo são obrigatórios.');
    const payload = { descricao, horas_minimo: Number(hmin), horas_maximo: hmax !== null ? Number(hmax) : null };
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('portes').update(payload).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('portes').insert([{ codigo, ativo: true, ...payload }]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadPortesCancelar();
    if (typeof loadPortes === 'function') await loadPortes();
    _cadPortesLoad();
}
async function cadPortesToggle(id) {
    const { data } = await _supabase.from('portes').select('ativo').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from('portes').update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (typeof loadPortes === 'function') await loadPortes();
    _cadPortesLoad();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_classificacoes — tipos_projeto + produtos + tipos_return_benefit
// ─────────────────────────────────────────────────────────────────────────────
let _classTab = 'tipos_projeto';

async function _cadClassLoad() {
    admSetState('cad_classificacoes', 'loading');
    const el = admGetContentEl('cad_classificacoes');
    if (!el) return;
    el.innerHTML = `
    <div id="cad-class-tabs" class="flex gap-0 border-b border-gray-200 mb-4">
        <button onclick="cadClassSwitchTab('tipos_projeto')" id="cad-class-btn-tipos_projeto"
            class="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors">Tipos de Projeto</button>
        <button onclick="cadClassSwitchTab('produtos')" id="cad-class-btn-produtos"
            class="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors">Produtos</button>
        <button onclick="cadClassSwitchTab('tipos_return_benefit')" id="cad-class-btn-tipos_return_benefit"
            class="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors">Retorno / Benefício</button>
    </div>
    <div id="cad-class-actions" class="flex justify-end mb-3"></div>
    <div id="cad-class-form-panel" class="hidden mb-4"></div>
    <div id="cad-class-list"></div>`;
    admSetState('cad_classificacoes', 'content');
    cadClassSwitchTab(_classTab);
}
async function cadClassSwitchTab(tab) {
    _classTab = tab;
    const tabs = ['tipos_projeto', 'produtos', 'tipos_return_benefit'];
    tabs.forEach(t => {
        const btn = document.getElementById(`cad-class-btn-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.className = 'px-4 py-2.5 text-xs font-semibold border-b-2 border-indigo-600 text-indigo-700 transition-colors';
        } else {
            btn.className = 'px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors';
        }
    });
    const panel = document.getElementById('cad-class-form-panel');
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    const actEl = document.getElementById('cad-class-actions');
    if (actEl && _cadPodeEscrever()) {
        const labels = { tipos_projeto: 'Novo Tipo', produtos: 'Novo Produto', tipos_return_benefit: 'Novo Retorno/Benefício' };
        actEl.innerHTML = `<button onclick="cadClassNovoForm()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
            <i class="fa-solid fa-plus"></i>${labels[tab]}</button>`;
    }
    await _cadClassRender(tab);
}
async function _cadClassRender(tab) {
    const list = document.getElementById('cad-class-list');
    if (!list) return;
    list.innerHTML = `<div class="text-center py-8"><i class="fa-solid fa-circle-notch fa-spin text-indigo-400"></i></div>`;
    const { data, error } = await _supabase.from(tab).select('*').order(tab === 'tipos_projeto' ? 'codigo' : 'nome');
    if (error) { list.innerHTML = `<p class="text-red-500 text-sm p-4">Erro ao carregar.</p>`; return; }
    const rows = data || [];
    const podeEscrever = _cadPodeEscrever();
    if (tab === 'tipos_projeto') {
        list.innerHTML = _cadTable(
            ['Código', 'Descrição', 'Status', podeEscrever ? 'Ações' : ''],
            rows.map(r => {
                const btns = podeEscrever ? `
                    <button onclick="cadClassEditar('${escapeHtml(String(r.id))}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                        <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button onclick="cadClassToggle(${r.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                        <i class="fa-solid fa-power-off"></i> ${r.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
                return `<tr class="${!r.ativo ? 'opacity-50' : ''}">
                    <td class="px-3 py-2.5 font-mono font-bold text-gray-700">${escapeHtml(r.codigo)}</td>
                    <td class="px-3 py-2.5 text-gray-800">${escapeHtml(r.descricao || r.nome || '')}</td>
                    <td class="px-3 py-2.5">${_cadStatus(r.ativo)}</td>
                    <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
                </tr>`;
            }), 'Nenhum tipo cadastrado');
    } else {
        list.innerHTML = _cadTable(
            tab === 'produtos' ? ['Código', 'Nome', 'Status', podeEscrever ? 'Ações' : ''] : ['Nome', 'Status', podeEscrever ? 'Ações' : ''],
            rows.map(r => {
                const sentinela = r.codigo === 'NAO_CLASSIFICADO';
                const btns = (podeEscrever && !sentinela) ? `
                    <button onclick="cadClassEditar('${escapeHtml(String(r.id))}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mr-2">
                        <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button onclick="cadClassToggle(${r.id})" class="text-amber-600 hover:text-amber-800 text-xs font-semibold">
                        <i class="fa-solid fa-power-off"></i> ${r.ativo ? 'Inativar' : 'Reativar'}</button>` : '';
                if (tab === 'produtos') {
                    return `<tr class="${!r.ativo ? 'opacity-50' : ''}">
                        <td class="px-3 py-2.5 font-mono font-bold text-gray-700">${escapeHtml(r.codigo)}
                            ${sentinela ? '<span class="ml-1 text-[9px] bg-gray-200 text-gray-500 px-1 rounded uppercase">sentinela</span>' : ''}</td>
                        <td class="px-3 py-2.5 text-gray-800">${escapeHtml(r.nome)}</td>
                        <td class="px-3 py-2.5">${_cadStatus(r.ativo)}</td>
                        <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
                    </tr>`;
                } else {
                    return `<tr class="${!r.ativo ? 'opacity-50' : ''}">
                        <td class="px-3 py-2.5 text-gray-800">${escapeHtml(r.nome)}</td>
                        <td class="px-3 py-2.5">${_cadStatus(r.ativo)}</td>
                        <td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>
                    </tr>`;
                }
            }), 'Nenhum item cadastrado');
    }
}
function cadClassNovoForm() {
    _cadClassMostraForm(null);
}
async function cadClassEditar(id) {
    const { data } = await _supabase.from(_classTab).select('*').eq('id', Number(id)).single();
    if (data) _cadClassMostraForm(data);
}
function _cadClassMostraForm(r) {
    const panel = document.getElementById('cad-class-form-panel');
    if (!panel) return;
    const novo = !r;
    const hasCodigo = _classTab !== 'tipos_return_benefit';
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${novo ? 'Novo Item' : 'Editar Item'}</span>
            <button onclick="cadClassCancelar()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-${hasCodigo ? '2' : '1'} gap-3 mb-3">
            ${hasCodigo ? `<div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                <input id="cad-cl-codigo" type="text" value="${escapeHtml(r?.codigo || '')}" ${!novo ? 'readonly' : ''}
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-indigo-400
                           ${!novo ? 'bg-gray-100' : ''}" />
            </div>` : ''}
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">${_classTab === 'tipos_projeto' ? 'Descrição *' : 'Nome *'}</label>
                <input id="cad-cl-nome" type="text" value="${escapeHtml(r ? (r.descricao || r.nome || '') : '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <input type="hidden" id="cad-cl-id" value="${r?.id || ''}">
        <button onclick="cadClassSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById(hasCodigo && !r ? 'cad-cl-codigo' : 'cad-cl-nome')?.focus();
}
function cadClassCancelar() {
    const p = document.getElementById('cad-class-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadClassSalvar() {
    const nome = (document.getElementById('cad-cl-nome')?.value || '').trim().toUpperCase();
    const codigoEl = document.getElementById('cad-cl-codigo');
    const codigo = codigoEl ? codigoEl.value.trim().toUpperCase() : null;
    const id = document.getElementById('cad-cl-id')?.value;
    if (!nome) return alert('Nome/Descrição é obrigatório.');
    if (_classTab !== 'tipos_return_benefit' && !codigo) return alert('Código é obrigatório.');
    let payload;
    if (_classTab === 'tipos_projeto') payload = { descricao: nome };
    else if (_classTab === 'produtos') payload = { nome };
    else payload = { nome };
    let err;
    if (id) {
        ({ error: err } = await _supabase.from(_classTab).update(payload).eq('id', Number(id)));
    } else {
        const insert = { ativo: true, ...payload };
        if (_classTab === 'tipos_projeto') insert.codigo = codigo;
        if (_classTab === 'produtos') insert.codigo = codigo;
        ({ error: err } = await _supabase.from(_classTab).insert([insert]));
    }
    if (err) return alert('Erro ao salvar: ' + err.message);
    cadClassCancelar();
    if (_classTab === 'produtos' && typeof carregarProdutosData === 'function') await carregarProdutosData();
    _cadClassRender(_classTab);
}
async function cadClassToggle(id) {
    const { data } = await _supabase.from(_classTab).select('ativo').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from(_classTab).update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (_classTab === 'produtos' && typeof carregarProdutosData === 'function') await carregarProdutosData();
    _cadClassRender(_classTab);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: cad_estrategia — pilares_estrategicos + iniciativas_estrategicas
// ─────────────────────────────────────────────────────────────────────────────
async function _cadEstLoad() {
    admSetState('cad_estrategia', 'loading');
    const el = admGetContentEl('cad_estrategia');
    if (!el) return;
    el.innerHTML = `
    <div class="grid grid-cols-2 gap-6">
        <div>
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700">Pilares Estratégicos</h3>
                ${_cadPodeEscrever() ? `<button onclick="cadEstPilarNovo()"
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    <i class="fa-solid fa-plus"></i>Novo Pilar</button>` : ''}
            </div>
            <div id="cad-est-pilar-form" class="hidden mb-3"></div>
            <div id="cad-est-pilares-list"></div>
        </div>
        <div>
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700" id="cad-est-ini-titulo">Iniciativas</h3>
                ${_cadPodeEscrever() ? `<button id="cad-est-ini-btn" onclick="cadEstIniNovo()" disabled
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-300 text-gray-500 rounded cursor-not-allowed">
                    <i class="fa-solid fa-plus"></i>Nova Iniciativa</button>` : ''}
            </div>
            <div id="cad-est-ini-form" class="hidden mb-3"></div>
            <div id="cad-est-ini-list">
                <p class="text-xs text-gray-400 py-8 text-center">Selecione um pilar para ver as iniciativas</p>
            </div>
        </div>
    </div>`;
    admSetState('cad_estrategia', 'content');
    await _cadEstRenderPilares();
}
let _estPilarSel = null;
async function _cadEstRenderPilares() {
    const list = document.getElementById('cad-est-pilares-list');
    if (!list) return;
    const { data, error } = await _supabase.from('pilares_estrategicos').select('*').order('ano_fiscal,nome');
    if (error) { list.innerHTML = `<p class="text-red-500 text-xs p-2">Erro ao carregar.</p>`; return; }
    const rows = data || [];
    if (!rows.length) { list.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">Nenhum pilar cadastrado</p>`; return; }
    const podeEscrever = _cadPodeEscrever();
    list.innerHTML = `<div class="border border-gray-200 rounded-lg overflow-hidden">
        ${rows.map(p => `
        <div class="flex items-center justify-between px-3 py-2.5 border-b last:border-0 hover:bg-gray-50
                    ${_estPilarSel === p.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}
                    ${!p.ativo ? 'opacity-50' : ''} cursor-pointer"
             onclick="_cadEstSelPilar(${p.id}, '${escapeHtml(p.nome)}')">
            <div>
                <span class="text-sm font-semibold text-gray-800">${escapeHtml(p.nome)}</span>
                <span class="ml-2 text-xs text-gray-400">${p.ano_fiscal || '-'}</span>
            </div>
            <div class="flex items-center gap-2">
                ${_cadStatus(p.ativo)}
                ${podeEscrever ? `<button onclick="event.stopPropagation();cadEstPilarEditar(${p.id})" class="text-indigo-600 hover:text-indigo-800 text-xs">
                    <i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="event.stopPropagation();cadEstPilarToggle(${p.id})" class="text-amber-600 hover:text-amber-800 text-xs">
                    <i class="fa-solid fa-power-off"></i></button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}
async function _cadEstSelPilar(pilarId, pilarNome) {
    _estPilarSel = pilarId;
    _cadEstRenderPilares();
    const titulo = document.getElementById('cad-est-ini-titulo');
    if (titulo) titulo.textContent = `Iniciativas — ${pilarNome}`;
    const btn = document.getElementById('cad-est-ini-btn');
    if (btn) { btn.disabled = false; btn.className = 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700'; }
    const iniForm = document.getElementById('cad-est-ini-form');
    if (iniForm) { iniForm.classList.add('hidden'); iniForm.innerHTML = ''; }
    await _cadEstRenderIni(pilarId);
}
async function _cadEstRenderIni(pilarId) {
    const list = document.getElementById('cad-est-ini-list');
    if (!list) return;
    const { data, error } = await _supabase.from('iniciativas_estrategicas').select('*').eq('pilar_id', pilarId).order('nome');
    if (error) { list.innerHTML = `<p class="text-red-500 text-xs p-2">Erro ao carregar.</p>`; return; }
    const rows = data || [];
    const podeEscrever = _cadPodeEscrever();
    if (!rows.length) { list.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">Nenhuma iniciativa</p>`; return; }
    list.innerHTML = `<div class="border border-gray-200 rounded-lg overflow-hidden">
        ${rows.map(i => `
        <div class="flex items-center justify-between px-3 py-2.5 border-b last:border-0 ${!i.ativo ? 'opacity-50' : ''}">
            <span class="text-sm text-gray-800">${escapeHtml(i.nome)}</span>
            <div class="flex items-center gap-2">
                ${_cadStatus(i.ativo)}
                ${podeEscrever ? `<button onclick="cadEstIniEditar(${i.id})" class="text-indigo-600 hover:text-indigo-800 text-xs">
                    <i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="cadEstIniToggle(${i.id})" class="text-amber-600 hover:text-amber-800 text-xs">
                    <i class="fa-solid fa-power-off"></i></button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}
function cadEstPilarNovo() {
    _cadEstPilarForm({ id: null, nome: '', ano_fiscal: '' });
}
function cadEstPilarEditar(id) {
    _supabase.from('pilares_estrategicos').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadEstPilarForm(data);
    });
}
function _cadEstPilarForm(p) {
    const panel = document.getElementById('cad-est-pilar-form');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
        <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
                <label class="block font-medium text-gray-600 mb-1">Nome *</label>
                <input id="cad-ep-nome" type="text" value="${escapeHtml(p.nome || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block font-medium text-gray-600 mb-1">Ano Fiscal *</label>
                <input id="cad-ep-af" type="text" maxlength="10" value="${escapeHtml(p.ano_fiscal || '')}" placeholder="ex.: AF2027"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 font-mono focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <input type="hidden" id="cad-ep-id" value="${p.id || ''}">
        <div class="flex gap-2">
            <button onclick="cadEstPilarSalvar()" class="px-3 py-1.5 font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">Salvar</button>
            <button onclick="cadEstPilarCancelar()" class="px-3 py-1.5 text-gray-600 hover:text-gray-800">Cancelar</button>
        </div>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('cad-ep-nome')?.focus();
}
function cadEstPilarCancelar() {
    const p = document.getElementById('cad-est-pilar-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadEstPilarSalvar() {
    const nome = (document.getElementById('cad-ep-nome')?.value || '').trim().toUpperCase();
    const af = (document.getElementById('cad-ep-af')?.value || '').trim().toUpperCase();
    const id = document.getElementById('cad-ep-id')?.value;
    if (!nome || !af) return alert('Nome e Ano Fiscal são obrigatórios.');
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('pilares_estrategicos').update({ nome, ano_fiscal: af }).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('pilares_estrategicos').insert([{ nome, ano_fiscal: af, ativo: true }]));
    }
    if (err) return alert('Erro: ' + err.message);
    cadEstPilarCancelar();
    await _cadEstRenderPilares();
}
async function cadEstPilarToggle(id) {
    const { data } = await _supabase.from('pilares_estrategicos').select('ativo').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from('pilares_estrategicos').update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    await _cadEstRenderPilares();
}
function cadEstIniNovo() {
    if (!_estPilarSel) return;
    _cadEstIniForm({ id: null, nome: '' });
}
function cadEstIniEditar(id) {
    _supabase.from('iniciativas_estrategicas').select('*').eq('id', id).single().then(({ data }) => {
        if (data) _cadEstIniForm(data);
    });
}
function _cadEstIniForm(i) {
    const panel = document.getElementById('cad-est-ini-form');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
        <div class="mb-2">
            <label class="block font-medium text-gray-600 mb-1">Nome da Iniciativa *</label>
            <input id="cad-ei-nome" type="text" value="${escapeHtml(i.nome || '')}"
                class="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400" />
        </div>
        <input type="hidden" id="cad-ei-id" value="${i.id || ''}">
        <div class="flex gap-2">
            <button onclick="cadEstIniSalvar()" class="px-3 py-1.5 font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">Salvar</button>
            <button onclick="cadEstIniCancelar()" class="px-3 py-1.5 text-gray-600 hover:text-gray-800">Cancelar</button>
        </div>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('cad-ei-nome')?.focus();
}
function cadEstIniCancelar() {
    const p = document.getElementById('cad-est-ini-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}
async function cadEstIniSalvar() {
    const nome = (document.getElementById('cad-ei-nome')?.value || '').trim().toUpperCase();
    const id = document.getElementById('cad-ei-id')?.value;
    if (!nome) return alert('Nome é obrigatório.');
    let err;
    if (id) {
        ({ error: err } = await _supabase.from('iniciativas_estrategicas').update({ nome }).eq('id', Number(id)));
    } else {
        ({ error: err } = await _supabase.from('iniciativas_estrategicas')
            .insert([{ nome, pilar_id: _estPilarSel, ativo: true }]));
    }
    if (err) return alert('Erro: ' + err.message);
    cadEstIniCancelar();
    await _cadEstRenderIni(_estPilarSel);
}
async function cadEstIniToggle(id) {
    const { data } = await _supabase.from('iniciativas_estrategicas').select('ativo').eq('id', id).single();
    if (!data) return;
    const { error } = await _supabase.from('iniciativas_estrategicas').update({ ativo: !data.ativo }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    await _cadEstRenderIni(_estPilarSel);
}
