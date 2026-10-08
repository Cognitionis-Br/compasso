// =============================================================================
// administracao/adm-acesso.js — Fase 1A · A3 · SCR-24 Acesso e Segurança
// VIEWs: adm_usuarios, adm_perfis, adm_sessoes
// =============================================================================

// ─── Dispatcher ──────────────────────────────────────────────────────────────
document.addEventListener('adm:view-activated', ({ detail: { tabId } }) => {
    const h = {
        adm_usuarios: _admUsuariosLoad,
        adm_perfis:   _admPerfisLoad,
        adm_sessoes:  _admSessoesLoad,
    };
    if (h[tabId]) h[tabId]();
});

// ─── Helpers locais ───────────────────────────────────────────────────────────
function _admAcessoQuem() {
    return (typeof currentUser !== 'undefined' && currentUser && currentUser.nome) ? currentUser.nome : 'sistema';
}
function _admPodeAdmin() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador)
        || (typeof ehProprietario !== 'undefined' && ehProprietario);
}
function _admAcessoStatus(ativo) {
    return ativo
        ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Ativo</span>`
        : `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Inativo</span>`;
}
function _admBtnAcao(label, icon, onclick, cls) {
    return `<button onclick="${onclick}" class="inline-flex items-center gap-1 text-xs font-semibold ${cls}">
        <i class="${icon}"></i>${label}</button>`;
}

// =============================================================================
// VIEW: adm_usuarios — perfis_usuarios + usuario_funcoes
// =============================================================================
async function _admUsuariosLoad() {
    admSetState('adm_usuarios', 'loading');

    const [{ data: usuarios, error }, { data: uf }, { data: funcoes }, { data: cargos }] = await Promise.all([
        _supabase.from('perfis_usuarios').select('*').order('nome'),
        _supabase.from('usuario_funcoes').select('usuario_id, funcao_id'),
        _supabase.from('funcoes').select('id, nome, ativo, eh_proprietario').eq('ativo', true).order('nome'),
        _supabase.from('cargos').select('id, nome').order('nome'),
    ]);

    if (error) { admSetState('adm_usuarios', 'error'); return; }

    // Oculta usuários com perfil Proprietário para quem não é Proprietário
    const ehProp = typeof ehProprietario !== 'undefined' && ehProprietario;
    const propFuncaoIds = new Set((funcoes || []).filter(f => f.eh_proprietario).map(f => f.id));
    const idsComProp = new Set((uf || []).filter(u => propFuncaoIds.has(u.funcao_id)).map(u => u.usuario_id));
    const lista = ehProp
        ? (usuarios || [])
        : (usuarios || []).filter(u => !idsComProp.has(u.id));

    // Mapa usuário → nomes de funções
    const funcaoNomeMap = Object.fromEntries((funcoes || []).map(f => [f.id, f.nome]));
    const userFuncoes = {};
    (uf || []).forEach(r => {
        if (!userFuncoes[r.usuario_id]) userFuncoes[r.usuario_id] = [];
        if (funcaoNomeMap[r.funcao_id]) userFuncoes[r.usuario_id].push(funcaoNomeMap[r.funcao_id]);
    });
    const cargoMap = Object.fromEntries((cargos || []).map(c => [c.id, c.nome]));

    // Injecta botão "Novo Usuário" no header
    const actEl = document.getElementById('adm-header-actions-adm_usuarios');
    if (actEl && !actEl.dataset.cadInit && _admPodeAdmin()) {
        actEl.dataset.cadInit = '1';
        actEl.innerHTML = `<button onclick="admUsuariosNovoForm()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                   bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
            <i class="fa-solid fa-user-plus"></i>Novo Usuário</button>`;
    }

    const el = admGetContentEl('adm_usuarios');
    if (!el) return;
    el.innerHTML = `
        <div id="adm-usuarios-form-panel" class="hidden mb-4"></div>
        <div id="adm-usuarios-list"></div>`;

    _admUsuariosRender(lista, userFuncoes, cargoMap, funcoes || []);
    admSetState('adm_usuarios', lista.length ? 'content' : 'empty');
}

function _admUsuariosRender(lista, userFuncoes, cargoMap, todasFuncoes) {
    const list = document.getElementById('adm-usuarios-list');
    if (!list) return;
    const podeEscrever = _admPodeAdmin();
    if (!lista.length) {
        list.innerHTML = `<div class="py-12 text-center text-gray-400"><i class="fa-solid fa-users text-2xl mb-2 block"></i>Nenhum usuário cadastrado</div>`;
        return;
    }
    list.innerHTML = `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Nome</th>
                <th class="px-3 py-2.5 text-left font-medium">E-mail</th>
                <th class="px-3 py-2.5 text-left font-medium">Área / Cargo</th>
                <th class="px-3 py-2.5 text-left font-medium">Perfis</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                ${podeEscrever ? '<th class="px-3 py-2.5 text-left font-medium">Ações</th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${lista.map(u => {
                const inativo = u.ativo === false;
                const cargo = cargoMap[u.cargo_id] || '-';
                const fns = (userFuncoes[u.id] || []).map(n =>
                    `<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 mr-1">${escapeHtml(n)}</span>`
                ).join('');
                const btns = podeEscrever ? `
                    ${!inativo ? _admBtnAcao('Editar', 'fa-solid fa-pen-to-square', `admUsuariosEditar('${u.id}')`, 'text-indigo-600 hover:text-indigo-800 mr-2') : ''}
                    ${_admBtnAcao(inativo ? 'Reativar' : 'Inativar',
                        inativo ? 'fa-solid fa-rotate-left' : 'fa-solid fa-user-slash',
                        `admUsuariosToggle('${u.id}', ${!inativo})`,
                        inativo ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-500 hover:text-red-700')}` : '';
                return `<tr class="${inativo ? 'opacity-50' : ''}">
                    <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(u.nome)}
                        ${u.senha_provisoria ? '<span class="ml-1 text-[9px] bg-amber-100 text-amber-600 px-1 rounded uppercase">senha provisória</span>' : ''}</td>
                    <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(u.email || '-')}</td>
                    <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(u.area || '-')} · ${escapeHtml(cargo)}</td>
                    <td class="px-3 py-2.5">${fns || '<span class="text-gray-400 italic text-xs">Sem perfil</span>'}</td>
                    <td class="px-3 py-2.5">${_admAcessoStatus(u.ativo)}</td>
                    ${podeEscrever ? `<td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>` : ''}
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
}

function admUsuariosNovoForm() {
    const panel = document.getElementById('adm-usuarios-form-panel');
    if (!panel) return;
    // Popula áreas e cargos disponíveis para o select
    const areasOpts = (typeof areasData !== 'undefined' ? areasData.filter(a => a.ativo !== false) : [])
        .map(a => `<option value="${escapeHtml(a.nome)}">${escapeHtml(a.nome)}</option>`).join('');
    const cargosOpts = (typeof cargosData !== 'undefined' ? cargosData.filter(c => c.ativo !== false) : [])
        .map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">Novo Usuário</span>
            <button onclick="admUsuariosFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
                <input id="admU-nome" type="text" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">E-mail *</label>
                <input id="admU-email" type="email" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Área</label>
                <select id="admU-area" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="">-- Sem área --</option>${areasOpts}
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Cargo *</label>
                <select id="admU-cargo" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="" selected disabled>-- Selecione --</option>${cargosOpts}
                </select>
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-medium text-gray-600 mb-1">Senha provisória *</label>
                <div class="flex gap-2">
                    <input id="admU-senha" type="text" class="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400" />
                    <button onclick="admUsuariosGerarSenha()" type="button"
                        class="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50">Gerar</button>
                </div>
            </div>
        </div>
        <button onclick="admUsuariosSalvarNovo()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-user-plus mr-1"></i>Criar Usuário</button>
        <p class="text-xs text-gray-400 mt-2">O usuário precisará trocar a senha no primeiro acesso. Atribua um perfil após a criação.</p>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('admU-nome')?.focus();
}

function admUsuariosGerarSenha() {
    const el = document.getElementById('admU-senha');
    if (el) el.value = Math.random().toString(36).slice(-8) + 'Aa1!';
}

async function admUsuariosSalvarNovo() {
    const nome = (document.getElementById('admU-nome')?.value || '').trim().toUpperCase();
    const email = (document.getElementById('admU-email')?.value || '').trim().toLowerCase();
    const area = (document.getElementById('admU-area')?.value || '') || null;
    const cargoId = document.getElementById('admU-cargo')?.value;
    const senha = (document.getElementById('admU-senha')?.value || '').trim();
    if (!nome || !email || !senha) return alert('Nome, e-mail e senha são obrigatórios.');
    if (!cargoId) return alert('Cargo é obrigatório.');
    if (senha.length < 6) return alert('Senha mínima: 6 caracteres.');

    const { data, error } = await _supabase.functions.invoke('admin-create-user', {
        body: { nome, email, area, senha_provisoria: senha }
    });
    if (error) {
        let msg = error.message;
        try { const b = await error.context?.json(); if (b?.error) msg = b.error; } catch (_) {}
        return alert('Erro ao criar usuário: ' + msg);
    }
    if (data?.error) return alert('Erro ao criar usuário: ' + data.error);
    if (data?.usuario_id) {
        await _supabase.from('perfis_usuarios').update({ cargo_id: Number(cargoId) }).eq('id', data.usuario_id);
    }
    alert(`Usuário criado. Senha provisória: ${senha}\nAtribua um perfil em Administração → Perfis.`);
    admUsuariosFecharForm();
    _admUsuariosLoad();
}

function admUsuariosFecharForm() {
    const p = document.getElementById('adm-usuarios-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

function admUsuariosEditar(id) {
    _supabase.from('perfis_usuarios').select('*').eq('id', id).single().then(async ({ data: u }) => {
        if (!u) return;
        const { data: cargos } = await _supabase.from('cargos').select('id,nome').eq('ativo', true).order('nome');
        const cargoAtual = u.cargo_id ? cargos?.find(c => c.id === u.cargo_id) : null;
        const cargosOpts = [
            ...(cargoAtual && !cargos?.find(c => c.id === u.cargo_id && c.ativo !== false)
                ? [{ id: u.cargo_id, nome: (cargoAtual?.nome || '-') + ' (inativo)' }] : []),
            ...(cargos || [])
        ].map(c => `<option value="${c.id}" ${c.id === u.cargo_id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('');
        const areasOpts = (typeof areasData !== 'undefined' ? areasData.filter(a => a.ativo !== false) : [])
            .map(a => `<option value="${escapeHtml(a.nome)}" ${u.area === a.nome ? 'selected' : ''}>${escapeHtml(a.nome)}</option>`).join('');
        const panel = document.getElementById('adm-usuarios-form-panel');
        if (!panel) return;
        panel.innerHTML = `
        <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-semibold text-indigo-800">Editar Usuário</span>
                <button onclick="admUsuariosFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p class="text-xs text-gray-500 mb-3">E-mail: <strong>${escapeHtml(u.email)}</strong> — não pode ser alterado aqui.</p>
            <div class="grid grid-cols-3 gap-3 mb-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                    <input id="admU-edit-nome" type="text" value="${escapeHtml(u.nome || '')}"
                        class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Área</label>
                    <select id="admU-edit-area" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                        <option value="">-- Sem área --</option>${areasOpts}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Cargo *</label>
                    <select id="admU-edit-cargo" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                        ${cargosOpts}
                    </select>
                </div>
            </div>
            <input type="hidden" id="admU-edit-id" value="${u.id}">
            <button onclick="admUsuariosSalvarEdicao()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
        </div>`;
        panel.classList.remove('hidden');
        document.getElementById('admU-edit-nome')?.focus();
    });
}

async function admUsuariosSalvarEdicao() {
    const id = document.getElementById('admU-edit-id')?.value;
    const nome = (document.getElementById('admU-edit-nome')?.value || '').trim().toUpperCase();
    const area = document.getElementById('admU-edit-area')?.value || null;
    const cargoId = document.getElementById('admU-edit-cargo')?.value;
    if (!nome) return alert('Nome é obrigatório.');
    if (!cargoId) return alert('Cargo é obrigatório.');
    const { error } = await _supabase.from('perfis_usuarios')
        .update({ nome, area, cargo_id: Number(cargoId) }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    admUsuariosFecharForm();
    _admUsuariosLoad();
}

async function admUsuariosToggle(id, inativar) {
    const msg = inativar
        ? 'Deseja inativar este usuário? Ele perderá acesso no próximo login.'
        : 'Deseja reativar este usuário?';
    if (!confirm(msg)) return;
    const payload = inativar
        ? { ativo: false, excluido_por: _admAcessoQuem(), excluido_em: new Date().toISOString() }
        : { ativo: true, excluido_por: null, excluido_em: null };
    const { error } = await _supabase.from('perfis_usuarios').update(payload).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    _admUsuariosLoad();
}

// =============================================================================
// VIEW: adm_perfis — funcoes + catalogo_atividades + funcao_atividades
// =============================================================================
// Estratégia: chama loadFuncoes() para popular os globais (funcoesData,
// atividadesData, funcaoAtividadesData, usuarioFuncoesData, usuariosData)
// e então renderiza a VIEW no ADM content. Para salvar um perfil, o form
// ADM usa os mesmos IDs de input que saveFuncao() e salvarFuncoesUsuario()
// esperam — reusa a lógica de negócio validada sem duplicá-la.

let _admPerfisTab = 'perfis';

async function _admPerfisLoad() {
    admSetState('adm_perfis', 'loading');
    if (typeof loadFuncoes === 'function') {
        await loadFuncoes(); // popula funcoesData, atividadesData, etc.
    }
    const el = admGetContentEl('adm_perfis');
    if (!el) return;
    el.innerHTML = `
    <div class="flex gap-0 border-b border-gray-200 mb-4">
        <button onclick="admPerfisTab('perfis')" id="adm-perfis-btn-perfis"
            class="px-4 py-2.5 text-xs font-semibold border-b-2 border-indigo-600 text-indigo-700 transition-colors">Perfis</button>
        <button onclick="admPerfisTab('atribuicoes')" id="adm-perfis-btn-atribuicoes"
            class="px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">Atribuições</button>
    </div>
    <div id="adm-perfis-form-panel" class="hidden mb-4"></div>
    <div id="adm-perfis-content"></div>`;
    admSetState('adm_perfis', 'content');
    admPerfisTab('perfis');
}

function admPerfisTab(tab) {
    _admPerfisTab = tab;
    ['perfis', 'atribuicoes'].forEach(t => {
        const btn = document.getElementById(`adm-perfis-btn-${t}`);
        if (!btn) return;
        if (t === tab) btn.className = 'px-4 py-2.5 text-xs font-semibold border-b-2 border-indigo-600 text-indigo-700 transition-colors';
        else btn.className = 'px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors';
    });
    const fp = document.getElementById('adm-perfis-form-panel');
    if (fp) { fp.classList.add('hidden'); fp.innerHTML = ''; }
    if (tab === 'perfis') _admPerfisRenderLista();
    else _admPerfisRenderAtribuicoes();
}

function _admPerfisRenderLista() {
    const c = document.getElementById('adm-perfis-content');
    if (!c) return;
    const lista = (typeof funcoesData !== 'undefined' ? funcoesData : [])
        .filter(f => (typeof ehProprietario === 'undefined' || !ehProprietario)
            ? !(f.eh_proprietario === true) : true);
    const podeEscrever = _admPodeAdmin();

    // Botão "Novo Perfil"
    const actEl = document.getElementById('adm-header-actions-adm_perfis');
    if (actEl && !actEl.dataset.cadInit && podeEscrever) {
        actEl.dataset.cadInit = '1';
        actEl.innerHTML = `<button onclick="admPerfisNovoForm()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
            <i class="fa-solid fa-plus"></i>Novo Perfil</button>`;
    }

    if (!lista.length) {
        c.innerHTML = `<div class="py-12 text-center text-gray-400"><i class="fa-solid fa-id-card text-2xl mb-2 block"></i>Nenhum perfil cadastrado</div>`;
        return;
    }
    const badge = (txt, color) =>
        `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-${color}-100 text-${color}-700">${txt}</span>`;

    c.innerHTML = `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Nome</th>
                <th class="px-3 py-2.5 text-left font-medium">Descrição</th>
                <th class="px-3 py-2.5 text-left font-medium">Flags</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                ${podeEscrever ? '<th class="px-3 py-2.5 text-left font-medium">Ações</th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${lista.map(f => {
                const flags = [
                    f.acesso_irrestrito ? badge('Acesso Irrestrito', 'amber') : '',
                    f.eh_proprietario ? badge('Proprietário', 'purple') : '',
                    f.ignora_restricao_area ? badge('Ignora Restr. Área', 'sky') : '',
                    f.restringe_por_atividade_responsavel ? badge('Operador', 'orange') : '',
                ].filter(Boolean).join(' ');
                const btns = podeEscrever ? `
                    ${_admBtnAcao('Editar', 'fa-solid fa-pen-to-square', `admPerfisEditar(${f.id})`, 'text-indigo-600 hover:text-indigo-800 mr-2')}
                    ${f.ativo !== false
                        ? _admBtnAcao('Inativar', 'fa-solid fa-ban', `admPerfisToggle(${f.id}, false)`, 'text-red-500 hover:text-red-700')
                        : _admBtnAcao('Reativar', 'fa-solid fa-rotate-left', `admPerfisToggle(${f.id}, true)`, 'text-emerald-600 hover:text-emerald-800')}` : '';
                return `<tr class="${f.ativo === false ? 'opacity-50' : ''}">
                    <td class="px-3 py-2.5 font-semibold text-gray-800">${escapeHtml(f.nome)}</td>
                    <td class="px-3 py-2.5 text-gray-500 text-xs">${escapeHtml(f.descricao || '-')}</td>
                    <td class="px-3 py-2.5">${flags || '<span class="text-gray-300 italic text-xs">—</span>'}</td>
                    <td class="px-3 py-2.5">${_admAcessoStatus(f.ativo !== false)}</td>
                    ${podeEscrever ? `<td class="px-3 py-2.5 whitespace-nowrap">${btns}</td>` : ''}
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
}

function admPerfisNovoForm() {
    _admPerfisAbrirForm(null);
}
function admPerfisEditar(id) {
    const f = (typeof funcoesData !== 'undefined' ? funcoesData : []).find(x => x.id === id);
    if (f) _admPerfisAbrirForm(f);
}

function _admPerfisAbrirForm(f) {
    // IDs prefixados adm-pf-* evitam colisão com o form legado de funcoes_permissoes
    // que coexiste no DOM (index.html:~3095). renderMatrizPermissoesFormulario() escreve
    // em funcaoMatrizPermissoesContainer pelo ID — renomeamos o container legado antes
    // de chamar a função para que ela encontre apenas o container do ADM panel.
    const panel = document.getElementById('adm-perfis-form-panel');
    if (!panel) return;
    const ehProp = typeof ehProprietario !== 'undefined' && ehProprietario;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-semibold text-indigo-800">${f ? 'Editar Perfil' : 'Novo Perfil'}</span>
            <button onclick="admPerfisFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input id="adm-pf-nome" type="text" value="${escapeHtml(f?.nome || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                <input id="adm-pf-desc" type="text" value="${escapeHtml(f?.descricao || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <div class="flex flex-wrap gap-4 mb-4">
            <label class="flex items-center gap-2 text-xs">
                <input id="adm-pf-irrestrito" type="checkbox" ${f?.acesso_irrestrito ? 'checked' : ''}
                    class="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                Acesso Irrestrito (Administrador)
            </label>
            <label class="flex items-center gap-2 text-xs">
                <input id="adm-pf-ignora-area" type="checkbox" ${f?.ignora_restricao_area ? 'checked' : ''}
                    class="w-4 h-4 rounded border-gray-300 text-sky-600" />
                Ignora Restrição de Área
            </label>
            <label class="flex items-center gap-2 text-xs">
                <input id="adm-pf-operador" type="checkbox" ${f?.restringe_por_atividade_responsavel ? 'checked' : ''}
                    class="w-4 h-4 rounded border-gray-300 text-orange-500" />
                Operador (restringe por atividade)
            </label>
            ${ehProp ? `<label id="adm-pf-prop-box" class="flex items-center gap-2 text-xs">
                <input id="adm-pf-proprietario" type="checkbox" ${f?.eh_proprietario ? 'checked' : ''}
                    class="w-4 h-4 rounded border-gray-300 text-purple-600" />
                É Proprietário
            </label>` : ''}
        </div>
        <div class="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Atividades permitidas</div>
        <div id="funcaoMatrizPermissoesContainer" class="mb-4"></div>
        <input type="hidden" id="adm-pf-id" value="${f?.id || ''}">
        <button onclick="_admPerfisFormSalvar(event)" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>${f ? 'Atualizar Perfil' : 'Salvar Perfil'}</button>
    </div>`;
    panel.classList.remove('hidden');

    // Renomeia temporariamente o container legado para que renderMatrizPermissoesFormulario()
    // encontre apenas o container recém-criado acima (mesmo ID, diferente posição no DOM).
    if (typeof renderMatrizPermissoesFormulario === 'function') {
        const legacyMatriz = document.getElementById('funcaoMatrizPermissoesContainer');
        // legacyMatriz SERÁ o do ADM panel porque acabamos de setar panel.innerHTML —
        // mas o container legado do index.html tem o mesmo ID e vem ANTES no DOM.
        // Forçamos a encontrar o do ADM panel pelo contexto do painel.
        const admMatriz = panel.querySelector('#funcaoMatrizPermissoesContainer');
        if (admMatriz) admMatriz.id = 'adm-pf-matriz-temp';
        // Agora renomeamos o legado para liberar o ID canonical
        const allMatriz = document.querySelectorAll('#funcaoMatrizPermissoesContainer');
        allMatriz.forEach(el => { if (el !== admMatriz) el.id = '_admPfLegacyBak'; });
        if (admMatriz) admMatriz.id = 'funcaoMatrizPermissoesContainer';

        let marcadas;
        if (f && typeof funcaoAtividadesData !== 'undefined') {
            marcadas = new Map();
            funcaoAtividadesData.filter(fa => fa.funcao_id === f.id).forEach(fa => {
                marcadas.set(fa.atividade_id, {
                    c: fa.pode_consultar !== false,
                    i: fa.pode_incluir === true,
                    a: fa.pode_alterar === true,
                    d: fa.pode_deletar === true,
                });
            });
        }
        renderMatrizPermissoesFormulario(marcadas);

        // Guarda a referência do container ADM com ID próprio e restaura o legado
        if (admMatriz) admMatriz.id = 'adm-pf-matriz';
        document.querySelectorAll('#_admPfLegacyBak').forEach(el => { el.id = 'funcaoMatrizPermissoesContainer'; });
    }
    document.getElementById('adm-pf-nome')?.focus();
}

async function _admPerfisFormSalvar(e) {
    e.preventDefault();
    if (!_admPodeAdmin()) return alert('Apenas ADMINISTRADOR ou PROPRIETÁRIO podem criar ou alterar perfis.');
    const id   = (document.getElementById('adm-pf-id')?.value || '').trim();
    const nome = (document.getElementById('adm-pf-nome')?.value || '').trim().toUpperCase();
    const desc = (document.getElementById('adm-pf-desc')?.value || '').trim();
    const irrestrito  = document.getElementById('adm-pf-irrestrito')?.checked || false;
    const ignoraArea  = document.getElementById('adm-pf-ignora-area')?.checked || false;
    const operador    = document.getElementById('adm-pf-operador')?.checked || false;
    const eProp       = document.getElementById('adm-pf-proprietario')?.checked || false;
    const acessoIrr   = eProp || irrestrito;

    if (!nome) return alert('Informe o nome do perfil.');

    // Segurança: só Proprietário gerencia perfil Proprietário
    if (typeof podeGerenciarProprietario === 'function' && !podeGerenciarProprietario()) {
        const orig = id ? (funcoesData || []).find(f => f.id === Number(id)) : null;
        const ehFProp = typeof ehFuncaoProprietario === 'function' ? ehFuncaoProprietario(orig) : false;
        if (eProp || ehFProp) return alert('Apenas o PROPRIETÁRIO pode criar, alterar ou marcar um perfil como Proprietário.');
    }

    // Lê checkboxes de atividade SOMENTE dentro do container ADM (adm-pf-matriz)
    const matrizEl = document.getElementById('adm-pf-matriz');
    const porAtiv = new Map();
    (matrizEl ? matrizEl : document).querySelectorAll('.funcao-form-ativ-checkbox').forEach(c => {
        if (!c.checked) return;
        const aid = Number(c.getAttribute('data-atividade-id'));
        if (!porAtiv.has(aid)) porAtiv.set(aid, { pode_consultar: false, pode_incluir: false, pode_alterar: false, pode_deletar: false });
        porAtiv.get(aid)[c.getAttribute('data-campo')] = true;
    });
    for (const p of porAtiv.values()) {
        if (p.pode_incluir || p.pode_alterar || p.pode_deletar) p.pode_consultar = true;
    }
    if (porAtiv.size === 0 && !acessoIrr) return alert('Selecione pelo menos uma atividade (ou marque Acesso Irrestrito).');

    const payload = {
        nome, descricao: desc,
        acesso_irrestrito: acessoIrr,
        eh_proprietario: eProp,
        ignora_restricao_area: ignoraArea,
        restringe_por_atividade_responsavel: operador,
    };

    let funcaoId;
    if (id) {
        funcaoId = Number(id);
        const { error } = await _supabase.from('funcoes').update(payload).eq('id', funcaoId);
        if (error) return alert('Erro ao atualizar: ' + error.message);
    } else {
        const { data, error } = await _supabase.from('funcoes').insert([payload]).select();
        if (error) return alert('Erro ao cadastrar: ' + error.message);
        funcaoId = data?.[0]?.id;
        if (!funcaoId) return alert('Perfil criado, mas não foi possível obter o ID. Recarregue e edite para ajustar as atividades.');
    }

    const { error: delErr } = await _supabase.from('funcao_atividades').delete().eq('funcao_id', funcaoId);
    if (delErr) return alert('Perfil salvo, mas houve erro ao atualizar atividades: ' + delErr.message);
    if (porAtiv.size > 0) {
        const rows = [...porAtiv.entries()].map(([atividade_id, p]) => ({ funcao_id: funcaoId, atividade_id, ...p }));
        const { error: insErr } = await _supabase.from('funcao_atividades').insert(rows);
        if (insErr) return alert('Perfil salvo, mas houve erro ao salvar atividades: ' + insErr.message);
    }

    alert(id ? 'Perfil atualizado com sucesso.' : 'Perfil cadastrado com sucesso.');
    admPerfisFecharForm();
    if (typeof loadFuncoes === 'function') await loadFuncoes();
    if (typeof carregarPermissoesUsuarioAtual === 'function') await carregarPermissoesUsuarioAtual();
    if (typeof aplicarVisibilidadeMenu === 'function') aplicarVisibilidadeMenu();
    _admPerfisLoad();
}

function admPerfisFecharForm() {
    const p = document.getElementById('adm-perfis-form-panel');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

async function admPerfisToggle(id, ativar) {
    if (!_admPodeAdmin()) return alert('Sem permissão.');
    const f = (typeof funcoesData !== 'undefined' ? funcoesData : []).find(x => x.id === id);
    if (!ativar && f) {
        const emUso = (typeof usuarioFuncoesData !== 'undefined' ? usuarioFuncoesData : []).filter(uf => uf.funcao_id === id);
        if (emUso.length > 0) return alert(`Não é possível inativar: ${emUso.length} usuário(s) usam este perfil. Remova a atribuição antes.`);
    }
    if (!confirm(ativar ? 'Reativar este perfil?' : 'Inativar este perfil?')) return;
    const payload = ativar
        ? { ativo: true, excluido_por: null, excluido_em: null }
        : { ativo: false, excluido_por: _admAcessoQuem(), excluido_em: new Date().toISOString() };
    const { error } = await _supabase.from('funcoes').update(payload).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    if (typeof loadFuncoes === 'function') await loadFuncoes();
    admPerfisTab('perfis');
}

function _admPerfisRenderAtribuicoes() {
    const c = document.getElementById('adm-perfis-content');
    if (!c) return;
    const usuarios = typeof usuariosData !== 'undefined' ? usuariosData : [];
    const funcoes = (typeof funcoesData !== 'undefined' ? funcoesData : []).filter(f => f.ativo !== false);
    const atribuiveis = funcoes.filter(f =>
        (typeof ehProprietario !== 'undefined' && ehProprietario) || !f.eh_proprietario);
    const uf = typeof usuarioFuncoesData !== 'undefined' ? usuarioFuncoesData : [];
    const podeEscrever = _admPodeAdmin();

    if (!usuarios.length) {
        c.innerHTML = `<div class="py-8 text-center text-gray-400 text-sm">Nenhum usuário cadastrado.</div>`;
        return;
    }

    const idsComProp = new Set(
        uf.filter(u => funcoes.find(f => f.id === u.funcao_id && f.eh_proprietario)).map(u => u.usuario_id)
    );
    const ehProp = typeof ehProprietario !== 'undefined' && ehProprietario;
    const usuariosVisiveis = ehProp ? usuarios : usuarios.filter(u => !idsComProp.has(u.id));

    c.innerHTML = `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium w-1/3">Usuário</th>
                <th class="px-3 py-2.5 text-left font-medium">Perfis atribuídos</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${usuariosVisiveis.map(u => {
                const atribuidos = new Set(uf.filter(x => x.usuario_id === u.id).map(x => x.funcao_id));
                const checkboxes = atribuiveis.map(f => `
                    <label class="inline-flex items-center gap-1 mr-3 mb-1 cursor-pointer select-none">
                        <input type="checkbox" class="usuario-funcao-checkbox w-3.5 h-3.5"
                            data-usuario="${u.id}" data-funcao="${f.id}" ${atribuidos.has(f.id) ? 'checked' : ''}>
                        <span class="text-xs font-semibold uppercase">${escapeHtml(f.nome)}</span>
                    </label>`).join('');
                return `<tr>
                    <td class="px-3 py-2.5">
                        <div class="font-semibold text-gray-800">${escapeHtml(u.nome)}</div>
                        <div class="text-xs text-gray-400">${escapeHtml(u.email || '')}</div>
                    </td>
                    <td class="px-3 py-2.5">
                        <div class="flex flex-wrap items-center">${checkboxes}</div>
                        ${podeEscrever ? `<button onclick="admPerfisAtribuirSalvar('${u.id}')"
                            class="mt-1.5 px-2.5 py-1 text-xs font-semibold bg-gray-800 text-white rounded hover:bg-gray-900">
                            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>` : ''}
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
}

async function admPerfisAtribuirSalvar(usuarioId) {
    if (typeof salvarFuncoesUsuario === 'function') {
        await salvarFuncoesUsuario(usuarioId);
        if (typeof loadFuncoes === 'function') await loadFuncoes();
        admPerfisTab('atribuicoes');
    }
}

// =============================================================================
// VIEW: adm_sessoes — tabelas não implementadas ainda (A4+)
// =============================================================================
function _admSessoesLoad() {
    admSetState('adm_sessoes', 'na');
    const el = admGetContentEl('adm_sessoes');
    if (!el) return;
    el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
        <i class="fa-solid fa-clock text-3xl text-gray-300 mb-3"></i>
        <p class="text-sm font-semibold text-gray-500 mb-1">Gestão de Sessões</p>
        <p class="text-xs text-gray-400 max-w-sm">
            Esta VIEW requer acesso às tabelas de sessões do Supabase Auth
            (<code>auth.sessions</code>), que não são acessíveis pelo cliente
            público. Uma implementação via Edge Function está prevista para A4.
        </p>
    </div>`;
    // Sobrescreve o estado "na" padrão com conteúdo informativo
    admSetState('adm_sessoes', 'content');
}
