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
// VIEW: adm_aptidoes — Aptidões e Competências (PAD-ADM-01 · Nível 1)
// Tabelas: aptidoes, usuario_aptidoes
// =============================================================================
let _aptCache = [];
let _aptUsuariosCache = [];
let _aptAbaAtiva = 'catalogo';

async function _admAptidoesLoad() {
    admSetState('adm_aptidoes', 'loading');
    const el = admGetContentEl('adm_aptidoes');
    if (!el) return;
    const [{ data: apt }, { data: ua }, { data: usu }] = await Promise.all([
        _supabase.from('aptidoes').select('*').order('categoria').order('nome'),
        _supabase.from('usuario_aptidoes').select('*, aptidoes(nome,categoria), perfis_usuarios(nome)'),
        _supabase.from('perfis_usuarios').select('id,nome').eq('ativo', true).order('nome'),
    ]);
    _aptCache = apt || [];
    _aptUsuariosCache = ua || [];
    _admAptRender(el, usu || []);
    admSetState('adm_aptidoes', 'content');
}

function _admAptRender(el, usuarios) {
    const apt = _aptCache;
    const ua  = _aptUsuariosCache;
    const tabela = apt.length === 0
        ? '<p class="text-xs text-gray-400 py-8 text-center">Nenhuma aptidão cadastrada.</p>'
        : `<table class="w-full text-xs"><thead><tr class="border-b text-gray-500 font-semibold">
            <th class="text-left py-1 pr-3">Código</th><th class="text-left py-1 pr-3">Nome</th>
            <th class="text-left py-1 pr-3">Categoria</th><th class="text-center py-1 pr-3">Nível máx.</th>
            <th class="text-center py-1 pr-3">Associados</th><th class="text-left py-1">Status</th>
            <th class="py-1"></th></tr></thead><tbody>
            ${apt.map(a => {
                const total = ua.filter(x => x.aptidao_id === a.id).length;
                return `<tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-1 pr-3 font-mono">${a.codigo}</td>
                    <td class="py-1 pr-3 font-medium">${a.nome}</td>
                    <td class="py-1 pr-3 text-gray-500">${a.categoria}</td>
                    <td class="py-1 pr-3 text-center">${a.nivel_maximo}</td>
                    <td class="py-1 pr-3 text-center">${total}</td>
                    <td class="py-1 pr-3">${a.ativo ? '<span class="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs">Ativa</span>' : '<span class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Inativa</span>'}</td>
                    <td class="py-1 flex gap-2">
                        <button class="text-indigo-600 hover:underline text-xs" onclick="admAptEditar(${a.id})">Editar</button>
                        <button class="text-gray-400 hover:underline text-xs" onclick="admAptToggle(${a.id},${a.ativo})">
                            ${a.ativo ? 'Inativar' : 'Ativar'}</button>
                    </td></tr>`;
            }).join('')}
            </tbody></table>`;

    const usuOpts  = usuarios.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');
    const aptOpts  = apt.filter(a => a.ativo).map(a => `<option value="${a.id}">${a.nome} (${a.categoria})</option>`).join('');
    const nivelOpts = [1,2,3,4,5].map(n => `<option value="${n}">${n}</option>`).join('');
    const matrizHtml = apt.length === 0 || usuarios.length === 0
        ? '<p class="text-xs text-gray-400 py-8 text-center">Cadastre aptidões e usuários primeiro.</p>'
        : `${_admOrgPode() ? `<div class="flex gap-2 mb-3 items-end flex-wrap">
            <div class="flex flex-col gap-1"><label class="text-xs text-gray-500">Usuário</label>
                <select id="apt-assoc-usu" class="border rounded text-xs px-2 py-1">${usuOpts}</select></div>
            <div class="flex flex-col gap-1"><label class="text-xs text-gray-500">Aptidão</label>
                <select id="apt-assoc-apt" class="border rounded text-xs px-2 py-1">${aptOpts}</select></div>
            <div class="flex flex-col gap-1"><label class="text-xs text-gray-500">Nível</label>
                <select id="apt-assoc-niv" class="border rounded text-xs px-2 py-1">${nivelOpts}</select></div>
            <button class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md" onclick="admAptAssociar()">Associar</button>
           </div>` : ''}
           <table class="w-full text-xs"><thead><tr class="border-b text-gray-500 font-semibold">
           <th class="text-left py-1 pr-3">Usuário</th><th class="text-left py-1 pr-3">Aptidão</th>
           <th class="text-left py-1 pr-3">Categoria</th><th class="text-center py-1 pr-3">Nível</th>
           <th class="text-left py-1 pr-3">Validado por</th><th class="py-1"></th></tr></thead><tbody>
           ${ua.length === 0 ? '<tr><td colspan="6" class="text-center py-6 text-gray-400">Nenhuma associação registrada.</td></tr>' :
           ua.map(x => `<tr class="border-b border-gray-100 hover:bg-gray-50">
               <td class="py-1 pr-3 font-medium">${x.perfis_usuarios?.nome||'—'}</td>
               <td class="py-1 pr-3">${x.aptidoes?.nome||'—'}</td>
               <td class="py-1 pr-3 text-gray-500">${x.aptidoes?.categoria||'—'}</td>
               <td class="py-1 pr-3 text-center font-semibold">${x.nivel}</td>
               <td class="py-1 pr-3 text-gray-500">${x.validado_por||'—'}</td>
               <td class="py-1"><button class="text-red-500 hover:underline text-xs" onclick="admAptRemoverAssoc(${x.id})">Remover</button></td>
           </tr>`).join('')}
           </tbody></table>`;

    el.innerHTML = `
<div class="p-4">
    <div class="flex items-center justify-between mb-3">
        <div><h2 class="text-sm font-bold text-gray-800">Aptidões e Competências</h2>
            <p class="text-xs text-gray-500">VIEW-ADM-APTIDOES · PAD-ADM-01 · ${apt.length} aptidão(ões)</p></div>
        ${_admOrgPode() ? `<button class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700" onclick="admAptNovo()">+ Nova Aptidão</button>` : ''}
    </div>
    <div class="flex gap-3 mb-4 border-b">
        <button class="pb-2 text-xs font-semibold ${_aptAbaAtiva==='catalogo'?'border-b-2 border-indigo-600 text-indigo-600':'text-gray-500'}" onclick="admAptAba('catalogo')">Catálogo</button>
        <button class="pb-2 text-xs font-semibold ${_aptAbaAtiva==='matriz'?'border-b-2 border-indigo-600 text-indigo-600':'text-gray-500'}" onclick="admAptAba('matriz')">Matriz Pessoa × Aptidão</button>
    </div>
    <div id="apt-aba-catalogo" ${_aptAbaAtiva!=='catalogo'?'hidden':''}>${tabela}</div>
    <div id="apt-aba-matriz"   ${_aptAbaAtiva!=='matriz'  ?'hidden':''}>${matrizHtml}</div>
</div>
<div id="apt-drawer" class="hidden fixed inset-0 z-50 flex justify-end">
    <div class="absolute inset-0 bg-black/30" onclick="admAptFecharDrawer()"></div>
    <div class="relative w-96 bg-white h-full shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        <h3 id="apt-drawer-titulo" class="text-sm font-bold text-gray-800">Nova Aptidão</h3>
        <input type="hidden" id="apt-form-id">
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Código <span class="text-red-500">*</span></label>
            <input id="apt-form-codigo" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: APT-TEC-001"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Nome <span class="text-red-500">*</span></label>
            <input id="apt-form-nome" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: Análise de Sistemas"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Categoria</label>
            <input id="apt-form-cat" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: Técnica, Comportamental"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Nível máximo (1–5)</label>
            <select id="apt-form-nivel" class="border rounded text-xs px-2 py-1">${nivelOpts}</select></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Descrição</label>
            <textarea id="apt-form-desc" class="border rounded text-xs px-2 py-1.5 h-16 resize-none"></textarea></div>
        <div class="flex gap-2 mt-auto pt-2">
            <button class="flex-1 px-3 py-1.5 text-xs border rounded text-gray-600" onclick="admAptFecharDrawer()">Cancelar</button>
            <button class="flex-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded" onclick="admAptSalvar()">Salvar</button>
        </div>
    </div>
</div>`;
}

function admAptAba(aba) {
    _aptAbaAtiva = aba;
    document.getElementById('apt-aba-catalogo')?.classList.toggle('hidden', aba !== 'catalogo');
    document.getElementById('apt-aba-matriz')?.classList.toggle('hidden',   aba !== 'matriz');
    document.querySelectorAll('[onclick^="admAptAba"]').forEach(b => {
        const on = b.getAttribute('onclick').includes(`'${aba}'`);
        b.className = `pb-2 text-xs font-semibold ${on ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`;
    });
}
function admAptNovo() {
    document.getElementById('apt-drawer-titulo').textContent = 'Nova Aptidão';
    document.getElementById('apt-form-id').value = '';
    ['codigo','nome','cat','desc'].forEach(f => { const e = document.getElementById(`apt-form-${f}`); if (e) e.value = ''; });
    document.getElementById('apt-form-nivel').value = '3';
    document.getElementById('apt-drawer').classList.remove('hidden');
}
function admAptEditar(id) {
    const a = _aptCache.find(x => x.id === id); if (!a) return;
    document.getElementById('apt-drawer-titulo').textContent = 'Editar Aptidão';
    document.getElementById('apt-form-id').value    = id;
    document.getElementById('apt-form-codigo').value = a.codigo;
    document.getElementById('apt-form-nome').value   = a.nome;
    document.getElementById('apt-form-cat').value    = a.categoria;
    document.getElementById('apt-form-nivel').value  = a.nivel_maximo;
    document.getElementById('apt-form-desc').value   = a.descricao || '';
    document.getElementById('apt-drawer').classList.remove('hidden');
}
function admAptFecharDrawer() { document.getElementById('apt-drawer')?.classList.add('hidden'); }
async function admAptSalvar() {
    const id = document.getElementById('apt-form-id').value;
    const codigo = document.getElementById('apt-form-codigo').value.trim();
    const nome   = document.getElementById('apt-form-nome').value.trim();
    if (!codigo || !nome) { alert('Código e Nome são obrigatórios.'); return; }
    const payload = {
        codigo, nome,
        categoria:      document.getElementById('apt-form-cat').value.trim() || 'GERAL',
        nivel_maximo:   Number(document.getElementById('apt-form-nivel').value),
        descricao:      document.getElementById('apt-form-desc').value.trim() || null,
        atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString(),
    };
    let err;
    if (id) { ({ error: err } = await _supabase.from('aptidoes').update(payload).eq('id', id)); }
    else    { payload.criado_por = _admOrgQuem(); ({ error: err } = await _supabase.from('aptidoes').insert([payload])); }
    if (err) { alert('Erro: ' + err.message); return; }
    admAptFecharDrawer(); _admAptidoesLoad();
}
async function admAptToggle(id, ativo) {
    const { error } = await _supabase.from('aptidoes')
        .update({ ativo: !ativo, atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admAptidoesLoad();
}
async function admAptAssociar() {
    const usuId = document.getElementById('apt-assoc-usu')?.value;   // UUID
    const aptId = Number(document.getElementById('apt-assoc-apt')?.value);
    const nivel = Number(document.getElementById('apt-assoc-niv')?.value);
    if (!usuId || !aptId) return;
    const { error } = await _supabase.from('usuario_aptidoes').upsert(
        { usuario_id: usuId, aptidao_id: aptId, nivel, atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() },
        { onConflict: 'usuario_id,aptidao_id' }
    );
    if (error) { alert('Erro: ' + error.message); return; }
    _admAptidoesLoad();
}
async function admAptRemoverAssoc(id) {
    if (!confirm('Remover esta associação?')) return;
    await _supabase.from('usuario_aptidoes').delete().eq('id', id);
    _admAptidoesLoad();
}

// =============================================================================
// VIEW: adm_alcadas — Alçadas de Decisão (PAD-ADM-05 · Nível 4)
// Tabela: authority_rules
// =============================================================================
let _alcCache = [];

const _DECISION_TYPE_LABEL = {
    BC_EXTRAORDINARY: 'BC Extraordinário',  FY_TRANSITION:    'Transição FY',
    FY_REOPENING:     'Reabertura FY',       FY_PACKAGE:       'Pacote FY',
    CONTRACT_APPROVAL:'Aprovação de Contrato',BUDGET_VARIATION: 'Variação Orçamentária',
    GENERIC:          'Genérico',
};
const _ALC_STATUS_BADGE = {
    DRAFT:'bg-yellow-100 text-yellow-800', PUBLISHED:'bg-green-100 text-green-800', INACTIVE:'bg-gray-100 text-gray-500',
};

async function _admAlcadasLoad() {
    admSetState('adm_alcadas', 'loading');
    const el = admGetContentEl('adm_alcadas'); if (!el) return;
    const { data } = await _supabase.from('authority_rules').select('*').order('decision_type').order('criado_em', { ascending: false });
    _alcCache = data || [];
    _admAlcRender(el);
    admSetState('adm_alcadas', 'content');
}

function _admAlcRender(el) {
    const rules = _alcCache;
    const pode  = _admOrgPode();
    const tabela = rules.length === 0
        ? '<p class="text-xs text-gray-400 py-8 text-center">Nenhuma alçada cadastrada.</p>'
        : `<table class="w-full text-xs"><thead><tr class="border-b text-gray-500 font-semibold">
            <th class="text-left py-1 pr-3">Código</th><th class="text-left py-1 pr-3">Tipo</th>
            <th class="text-left py-1 pr-3">Descrição</th><th class="text-center py-1 pr-3">Níveis</th>
            <th class="text-center py-1 pr-3">Versão</th><th class="text-left py-1 pr-3">Status</th>
            <th class="text-left py-1 pr-3">Vigência</th><th class="py-1"></th></tr></thead><tbody>
            ${rules.map(r => {
                const niveis = Array.isArray(r.niveis) ? r.niveis.length : 0;
                const badge = _ALC_STATUS_BADGE[r.status]||'bg-gray-100 text-gray-500';
                const vig = r.vigencia_inicio ? `${r.vigencia_inicio}${r.vigencia_fim?' → '+r.vigencia_fim:' →'}` : '—';
                return `<tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="admAlcVerDetalhe(${r.id})">
                    <td class="py-1 pr-3 font-mono">${r.codigo}</td>
                    <td class="py-1 pr-3">${_DECISION_TYPE_LABEL[r.decision_type]||r.decision_type}</td>
                    <td class="py-1 pr-3 text-gray-600 max-w-xs truncate">${r.descricao}</td>
                    <td class="py-1 pr-3 text-center">${niveis}</td>
                    <td class="py-1 pr-3 text-center">v${r.versao}</td>
                    <td class="py-1 pr-3"><span class="px-1.5 py-0.5 rounded text-xs ${badge}">${r.status}</span></td>
                    <td class="py-1 pr-3 text-gray-400">${vig}</td>
                    <td class="py-1">${pode ? `<div class="flex gap-2">
                        <button class="text-indigo-600 hover:underline text-xs" onclick="event.stopPropagation();admAlcEditar(${r.id})">Editar</button>
                        ${r.status==='DRAFT'?`<button class="text-green-700 hover:underline text-xs" onclick="event.stopPropagation();admAlcPublicar(${r.id})">Publicar</button>`:''}
                        ${r.status==='PUBLISHED'?`<button class="text-gray-400 hover:underline text-xs" onclick="event.stopPropagation();admAlcInativar(${r.id})">Inativar</button>`:''}
                    </div>`:''}</td></tr>`;
            }).join('')}
            </tbody></table>`;

    el.innerHTML = `
<div class="p-4">
    <div class="flex items-center justify-between mb-3">
        <div><h2 class="text-sm font-bold text-gray-800">Alçadas de Decisão</h2>
            <p class="text-xs text-gray-500">VIEW-ADM-ALCADAS · PAD-ADM-05 · R-ADM-30/31 · ${rules.length} regra(s)</p></div>
        ${pode ? `<button class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700" onclick="admAlcNovo()">+ Nova Alçada</button>` : ''}
    </div>
    <div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
        <strong>R-ADM-30:</strong> Alçada é poder de decisão de negócio, independente do perfil técnico de administrador.
        Regras em <strong>PUBLISHED</strong> são usadas pelos módulos BC e FY.
    </div>
    ${tabela}
</div>
<div id="alc-drawer" class="hidden fixed inset-0 z-50 flex justify-end">
    <div class="absolute inset-0 bg-black/30" onclick="admAlcFecharDrawer()"></div>
    <div class="relative w-[480px] bg-white h-full shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        <h3 id="alc-drawer-titulo" class="text-sm font-bold text-gray-800">Nova Alçada</h3>
        <input type="hidden" id="alc-form-id">
        <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Código <span class="text-red-500">*</span></label>
                <input id="alc-form-codigo" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: ALC-BC-001"></div>
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Tipo <span class="text-red-500">*</span></label>
                <select id="alc-form-tipo" class="border rounded text-xs px-2 py-1.5">
                    ${Object.entries(_DECISION_TYPE_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
                </select></div>
        </div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Descrição <span class="text-red-500">*</span></label>
            <textarea id="alc-form-desc" class="border rounded text-xs px-2 py-1.5 h-16 resize-none"></textarea></div>
        <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Vigência início</label>
                <input id="alc-form-vig-ini" type="date" class="border rounded text-xs px-2 py-1.5"></div>
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Vigência fim</label>
                <input id="alc-form-vig-fim" type="date" class="border rounded text-xs px-2 py-1.5"></div>
        </div>
        <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-medium text-gray-600">Níveis de aprovação</label>
                <button class="text-xs text-indigo-600 hover:underline" onclick="admAlcAddNivel()">+ Adicionar nível</button>
            </div>
            <div id="alc-niveis-container" class="flex flex-col gap-2"></div>
        </div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Condição (JSON livre)</label>
            <textarea id="alc-form-cond" class="border rounded text-xs px-2 py-1.5 h-12 resize-none font-mono" placeholder='{"valor_min": 50000}'></textarea></div>
        <div class="flex gap-2 mt-auto pt-2">
            <button class="flex-1 px-3 py-1.5 text-xs border rounded text-gray-600" onclick="admAlcFecharDrawer()">Cancelar</button>
            <button class="flex-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded" onclick="admAlcSalvar()">Salvar como Rascunho</button>
        </div>
    </div>
</div>
<div id="alc-detalhe" class="hidden fixed inset-0 z-50 flex justify-end">
    <div class="absolute inset-0 bg-black/30" onclick="admAlcFecharDetalhe()"></div>
    <div id="alc-detalhe-corpo" class="relative w-[480px] bg-white h-full shadow-2xl p-6 overflow-y-auto"></div>
</div>`;
}

function admAlcNovo() {
    document.getElementById('alc-drawer-titulo').textContent = 'Nova Alçada';
    document.getElementById('alc-form-id').value = '';
    ['codigo','desc','vig-ini','vig-fim','cond'].forEach(f => { const e = document.getElementById(`alc-form-${f}`); if (e) e.value = ''; });
    document.getElementById('alc-niveis-container').innerHTML = '';
    document.getElementById('alc-drawer').classList.remove('hidden');
}
function admAlcEditar(id) {
    const r = _alcCache.find(x => x.id === id); if (!r) return;
    document.getElementById('alc-drawer-titulo').textContent = 'Editar Alçada';
    document.getElementById('alc-form-id').value       = id;
    document.getElementById('alc-form-codigo').value   = r.codigo;
    document.getElementById('alc-form-tipo').value     = r.decision_type;
    document.getElementById('alc-form-desc').value     = r.descricao;
    document.getElementById('alc-form-vig-ini').value  = r.vigencia_inicio || '';
    document.getElementById('alc-form-vig-fim').value  = r.vigencia_fim || '';
    document.getElementById('alc-form-cond').value     = r.condicao && Object.keys(r.condicao).length ? JSON.stringify(r.condicao, null, 2) : '';
    const cont = document.getElementById('alc-niveis-container'); cont.innerHTML = '';
    (r.niveis || []).forEach((n, i) => _admAlcNivelEl(cont, i, n));
    document.getElementById('alc-drawer').classList.remove('hidden');
}
function _admAlcNivelEl(cont, i, nivel) {
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-start border rounded p-2 bg-gray-50';
    div.innerHTML = `<span class="text-xs text-gray-400 font-semibold mt-1.5 w-5">${i+1}.</span>
        <div class="flex-1 flex flex-col gap-1">
            <input type="text" class="border rounded text-xs px-2 py-1 alc-nivel-papel" value="${nivel?.papel||''}" placeholder="Papel ou pessoa">
            <input type="number" class="border rounded text-xs px-2 py-1 alc-nivel-quorum" min="1" value="${nivel?.quorum_minimo||1}" placeholder="Quórum">
            <input type="text" class="border rounded text-xs px-2 py-1 alc-nivel-desc" value="${nivel?.descricao||''}" placeholder="Descrição do nível">
        </div>
        <button class="text-red-400 hover:text-red-600 text-xs mt-1" onclick="this.closest('.flex.gap-2').remove()">✕</button>`;
    cont.appendChild(div);
}
function admAlcAddNivel() {
    const cont = document.getElementById('alc-niveis-container');
    _admAlcNivelEl(cont, cont.children.length, {});
}
function admAlcFecharDrawer() { document.getElementById('alc-drawer')?.classList.add('hidden'); }
async function admAlcSalvar() {
    const id = document.getElementById('alc-form-id').value;
    const codigo = document.getElementById('alc-form-codigo').value.trim();
    const desc   = document.getElementById('alc-form-desc').value.trim();
    if (!codigo || !desc) { alert('Código e Descrição são obrigatórios.'); return; }
    let condicao = {};
    const condRaw = document.getElementById('alc-form-cond').value.trim();
    if (condRaw) { try { condicao = JSON.parse(condRaw); } catch { alert('Condição JSON inválida.'); return; } }
    const niveis = [...document.querySelectorAll('#alc-niveis-container > div')].map((el, i) => ({
        ordem: i+1,
        papel: el.querySelector('.alc-nivel-papel')?.value.trim()||'',
        quorum_minimo: Number(el.querySelector('.alc-nivel-quorum')?.value||1),
        descricao: el.querySelector('.alc-nivel-desc')?.value.trim()||'',
    })).filter(n => n.papel);
    const exist = id ? _alcCache.find(x => x.id === Number(id)) : null;
    const payload = {
        codigo, decision_type: document.getElementById('alc-form-tipo').value,
        descricao: desc, condicao, niveis,
        versao: exist ? (exist.status==='PUBLISHED' ? exist.versao+1 : exist.versao) : 1,
        status: 'DRAFT',
        vigencia_inicio: document.getElementById('alc-form-vig-ini').value || null,
        vigencia_fim:    document.getElementById('alc-form-vig-fim').value || null,
        atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString(),
    };
    let err;
    if (id) { ({ error: err } = await _supabase.from('authority_rules').update(payload).eq('id', id)); }
    else    { payload.criado_por = _admOrgQuem(); ({ error: err } = await _supabase.from('authority_rules').insert([payload])); }
    if (err) { alert('Erro: ' + err.message); return; }
    admAlcFecharDrawer(); _admAlcadasLoad();
}
async function admAlcPublicar(id) {
    if (!confirm('Publicar esta alçada? Ela passará a ser usada pelos módulos BC e FY.')) return;
    const { error } = await _supabase.from('authority_rules')
        .update({ status: 'PUBLISHED', atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admAlcadasLoad();
}
async function admAlcInativar(id) {
    if (!confirm('Inativar esta alçada?')) return;
    const { error } = await _supabase.from('authority_rules')
        .update({ status: 'INACTIVE', atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admAlcadasLoad();
}
function admAlcVerDetalhe(id) {
    const r = _alcCache.find(x => x.id === id); if (!r) return;
    const corpo = document.getElementById('alc-detalhe-corpo');
    const badge = _ALC_STATUS_BADGE[r.status]||'';
    const niveisHtml = (r.niveis||[]).length === 0
        ? '<p class="text-xs text-gray-400">Nenhum nível configurado.</p>'
        : (r.niveis||[]).map((n,i) => `
            <div class="flex gap-3 items-start py-2 border-b border-gray-100">
                <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">${i+1}</span>
                <div><p class="text-xs font-semibold">${n.papel||'—'}</p>
                    <p class="text-xs text-gray-500">Quórum: ${n.quorum_minimo||1}${n.descricao?' · '+n.descricao:''}</p></div>
            </div>`).join('');
    corpo.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div><p class="text-xs font-mono text-gray-400">${r.codigo}</p>
                <h3 class="text-sm font-bold text-gray-800 mt-0.5">${r.descricao}</h3></div>
            <span class="px-2 py-0.5 rounded text-xs ${badge}">${r.status} v${r.versao}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs mb-4">
            <div><p class="text-gray-400 mb-0.5">Tipo</p><p class="font-medium">${_DECISION_TYPE_LABEL[r.decision_type]||r.decision_type}</p></div>
            <div><p class="text-gray-400 mb-0.5">Vigência</p><p class="font-medium">${r.vigencia_inicio||'—'}${r.vigencia_fim?' → '+r.vigencia_fim:''}</p></div>
        </div>
        <h4 class="text-xs font-semibold text-gray-700 mb-2">Níveis de aprovação</h4>
        ${niveisHtml}
        ${Object.keys(r.condicao||{}).length>0?`<h4 class="text-xs font-semibold text-gray-700 mt-3 mb-1">Condição</h4>
        <pre class="bg-gray-50 rounded p-2 text-xs overflow-x-auto">${JSON.stringify(r.condicao,null,2)}</pre>`:''}
        <button class="mt-6 w-full text-xs text-gray-500 border rounded py-1.5" onclick="admAlcFecharDetalhe()">Fechar</button>`;
    document.getElementById('alc-detalhe').classList.remove('hidden');
}
function admAlcFecharDetalhe() { document.getElementById('alc-detalhe')?.classList.add('hidden'); }

// =============================================================================
// VIEW: adm_delegacoes — Delegações de Autoridade (PAD-ADM-05 · Nível 3)
// Tabela: delegacoes
// =============================================================================
let _delCache = [];

async function _admDelegacoesLoad() {
    admSetState('adm_delegacoes', 'loading');
    const el = admGetContentEl('adm_delegacoes'); if (!el) return;
    const [{ data: del }, { data: usu }, { data: alc }] = await Promise.all([
        _supabase.from('delegacoes')
            .select('*, delegante:perfis_usuarios!delegacoes_delegante_id_fkey(nome), delegado:perfis_usuarios!delegacoes_delegado_id_fkey(nome), authority_rules(codigo,descricao)')
            .order('criado_em', { ascending: false }),
        _supabase.from('perfis_usuarios').select('id,nome').eq('ativo', true).order('nome'),
        _supabase.from('authority_rules').select('id,codigo,descricao').eq('status', 'PUBLISHED'),
    ]);
    _delCache = del || [];
    _admDelRender(el, usu || [], alc || []);
    admSetState('adm_delegacoes', 'content');
}

function _admDelRender(el, usuarios, alcadas) {
    const del  = _delCache;
    const pode = _admOrgPode();
    const hoje = new Date().toISOString().substring(0, 10);
    const _statusBadge = s => ({'ACTIVE':'bg-green-100 text-green-800','REVOKED':'bg-red-100 text-red-800','EXPIRED':'bg-gray-100 text-gray-500'}[s]||'bg-gray-100 text-gray-500');
    const tabela = del.length === 0
        ? '<p class="text-xs text-gray-400 py-8 text-center">Nenhuma delegação registrada.</p>'
        : `<table class="w-full text-xs"><thead><tr class="border-b text-gray-500 font-semibold">
            <th class="text-left py-1 pr-3">Delegante</th><th class="text-left py-1 pr-3">Delegado</th>
            <th class="text-left py-1 pr-3">Alçada</th><th class="text-left py-1 pr-3">Período</th>
            <th class="text-left py-1 pr-3">Motivo</th><th class="text-left py-1 pr-3">Status</th>
            <th class="py-1"></th></tr></thead><tbody>
            ${del.map(d => {
                const expired = d.status==='ACTIVE' && d.periodo_fim < hoje;
                const badge = expired ? 'bg-gray-100 text-gray-500' : _statusBadge(d.status);
                return `<tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-1 pr-3 font-medium">${d.delegante?.nome||'—'}</td>
                    <td class="py-1 pr-3">${d.delegado?.nome||'—'}</td>
                    <td class="py-1 pr-3 text-gray-500">${d.authority_rules?.codigo||'—'}</td>
                    <td class="py-1 pr-3 whitespace-nowrap text-gray-500">${d.periodo_inicio} → ${d.periodo_fim}</td>
                    <td class="py-1 pr-3 text-gray-600 max-w-[150px] truncate">${d.motivo}</td>
                    <td class="py-1 pr-3"><span class="px-1.5 py-0.5 rounded text-xs ${badge}">${expired?'EXPIRADA':d.status}</span></td>
                    <td class="py-1">${(pode && d.status==='ACTIVE') ? `<button class="text-red-500 hover:underline text-xs" onclick="admDelRevogar(${d.id})">Revogar</button>` : ''}</td>
                </tr>`;
            }).join('')}
            </tbody></table>`;

    const usuOpts = usuarios.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');
    const alcOpts = `<option value="">— nenhuma —</option>${alcadas.map(a => `<option value="${a.id}">${a.codigo} · ${a.descricao}</option>`).join('')}`;

    el.innerHTML = `
<div class="p-4">
    <div class="flex items-center justify-between mb-3">
        <div><h2 class="text-sm font-bold text-gray-800">Delegações de Autoridade</h2>
            <p class="text-xs text-gray-500">VIEW-ADM-DELEGACOES · PAD-ADM-05 · R-ADM-32 · ${del.length} registro(s)</p></div>
        ${pode ? `<button class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700" onclick="admDelNovo()">+ Nova Delegação</button>` : ''}
    </div>
    <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <strong>R-ADM-32:</strong> Delegação é temporária e não excede a autoridade do delegante. O delegante continua responsável.
    </div>
    ${tabela}
</div>
<div id="del-drawer" class="hidden fixed inset-0 z-50 flex justify-end">
    <div class="absolute inset-0 bg-black/30" onclick="admDelFecharDrawer()"></div>
    <div class="relative w-96 bg-white h-full shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        <h3 class="text-sm font-bold text-gray-800">Nova Delegação</h3>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Delegante <span class="text-red-500">*</span></label>
            <select id="del-form-delegante" class="border rounded text-xs px-2 py-1.5">${usuOpts}</select></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Delegado <span class="text-red-500">*</span></label>
            <select id="del-form-delegado" class="border rounded text-xs px-2 py-1.5">${usuOpts}</select></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Alçada delegada</label>
            <select id="del-form-alcada" class="border rounded text-xs px-2 py-1.5">${alcOpts}</select></div>
        <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Início <span class="text-red-500">*</span></label>
                <input id="del-form-ini" type="date" class="border rounded text-xs px-2 py-1.5"></div>
            <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Fim <span class="text-red-500">*</span></label>
                <input id="del-form-fim" type="date" class="border rounded text-xs px-2 py-1.5"></div>
        </div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Motivo <span class="text-red-500">*</span></label>
            <textarea id="del-form-motivo" class="border rounded text-xs px-2 py-1.5 h-16 resize-none" placeholder="ex.: Férias, substituição temporária"></textarea></div>
        <div class="flex gap-2 mt-auto pt-2">
            <button class="flex-1 px-3 py-1.5 text-xs border rounded text-gray-600" onclick="admDelFecharDrawer()">Cancelar</button>
            <button class="flex-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded" onclick="admDelSalvar()">Registrar</button>
        </div>
    </div>
</div>`;
}

function admDelNovo() { document.getElementById('del-drawer').classList.remove('hidden'); }
function admDelFecharDrawer() { document.getElementById('del-drawer')?.classList.add('hidden'); }
async function admDelSalvar() {
    const delante = document.getElementById('del-form-delegante')?.value;
    const delado  = document.getElementById('del-form-delegado')?.value;
    const ini     = document.getElementById('del-form-ini')?.value;
    const fim     = document.getElementById('del-form-fim')?.value;
    const motivo  = document.getElementById('del-form-motivo')?.value.trim();
    const alcId   = document.getElementById('del-form-alcada')?.value || null;
    if (!delante || !delado || !ini || !fim || !motivo) { alert('Preencha todos os campos obrigatórios.'); return; }
    if (String(delante) === String(delado)) { alert('Delegante e Delegado devem ser pessoas diferentes.'); return; }
    if (fim <= ini) { alert('A data de fim deve ser posterior ao início.'); return; }
    const { error } = await _supabase.from('delegacoes').insert([{
        delegante_id: delante, delegado_id: delado,
        authority_rule_id: alcId ? Number(alcId) : null,   // authority_rules.id é BIGINT
        periodo_inicio: ini, periodo_fim: fim, motivo,
        status: 'ACTIVE', criado_por: _admOrgQuem(), atualizado_por: _admOrgQuem(),
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    admDelFecharDrawer(); _admDelegacoesLoad();
}
async function admDelRevogar(id) {
    if (!confirm('Revogar esta delegação agora?')) return;
    const { error } = await _supabase.from('delegacoes')
        .update({ status: 'REVOKED', revogado_por: _admOrgQuem(), revogado_em: new Date().toISOString(), atualizado_por: _admOrgQuem() })
        .eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admDelegacoesLoad();
}

// =============================================================================
// VIEW: adm_sod — Segregação de Funções (PAD-ADM-05 · Nível 4)
// Tabela: sod_rules
// =============================================================================
let _sodCache = [];
const _SOD_ESCOPO_LABEL = { MESMO_OBJETO:'Mesmo objeto', MESMO_PROCESSO:'Mesmo processo', GLOBAL:'Global' };
const _SOD_STATUS_BADGE = { DRAFT:'bg-yellow-100 text-yellow-800', PUBLISHED:'bg-green-100 text-green-800', INACTIVE:'bg-gray-100 text-gray-500' };

async function _admSodLoad() {
    admSetState('adm_sod', 'loading');
    const el = admGetContentEl('adm_sod'); if (!el) return;
    const { data } = await _supabase.from('sod_rules').select('*').order('status').order('criado_em', { ascending: false });
    _sodCache = data || [];
    _admSodRender(el);
    admSetState('adm_sod', 'content');
}

function _admSodRender(el) {
    const rules = _sodCache;
    const pode  = _admOrgPode();
    const tabela = rules.length === 0
        ? '<p class="text-xs text-gray-400 py-8 text-center">Nenhuma regra SoD cadastrada.</p>'
        : `<table class="w-full text-xs"><thead><tr class="border-b text-gray-500 font-semibold">
            <th class="text-left py-1 pr-3">Código</th><th class="text-left py-1 pr-3">Ação A</th>
            <th class="text-left py-1 pr-3">Ação B</th><th class="text-left py-1 pr-3">Escopo</th>
            <th class="text-center py-1 pr-3">Exceções</th><th class="text-left py-1 pr-3">Status</th>
            <th class="py-1"></th></tr></thead><tbody>
            ${rules.map(r => {
                const exc = Array.isArray(r.excecoes) ? r.excecoes.length : 0;
                const badge = _SOD_STATUS_BADGE[r.status]||'';
                return `<tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-1 pr-3 font-mono">${r.codigo}</td>
                    <td class="py-1 pr-3 font-medium text-xs">${r.acao_a}</td>
                    <td class="py-1 pr-3 font-medium text-xs">${r.acao_b}</td>
                    <td class="py-1 pr-3 text-gray-500">${_SOD_ESCOPO_LABEL[r.escopo]||r.escopo}</td>
                    <td class="py-1 pr-3 text-center">${exc>0?`<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">${exc}</span>`:'—'}</td>
                    <td class="py-1 pr-3"><span class="px-1.5 py-0.5 rounded text-xs ${badge}">${r.status}</span></td>
                    <td class="py-1">${pode?`<div class="flex gap-2">
                        <button class="text-indigo-600 hover:underline text-xs" onclick="admSodEditar(${r.id})">Editar</button>
                        ${r.status==='DRAFT'?`<button class="text-green-700 hover:underline text-xs" onclick="admSodPublicar(${r.id})">Publicar</button>`:''}
                        ${r.status==='PUBLISHED'?`<button class="text-gray-400 hover:underline text-xs" onclick="admSodInativar(${r.id})">Inativar</button>`:''}
                    </div>`:''}</td></tr>`;
            }).join('')}
            </tbody></table>`;

    el.innerHTML = `
<div class="p-4">
    <div class="flex items-center justify-between mb-3">
        <div><h2 class="text-sm font-bold text-gray-800">Segregação de Funções (SoD)</h2>
            <p class="text-xs text-gray-500">VIEW-ADM-SOD · PAD-ADM-05 · R-ADM-33 · ${rules.length} regra(s)</p></div>
        ${pode ? `<button class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700" onclick="admSodNovo()">+ Nova Regra SoD</button>` : ''}
    </div>
    <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
        <strong>R-ADM-33:</strong> Regras SoD são verificadas no backend no momento da decisão.
        Publicar uma regra faz ela ser consultada em todos os fluxos de aprovação.
    </div>
    ${tabela}
</div>
<div id="sod-drawer" class="hidden fixed inset-0 z-50 flex justify-end">
    <div class="absolute inset-0 bg-black/30" onclick="admSodFecharDrawer()"></div>
    <div class="relative w-[480px] bg-white h-full shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        <h3 id="sod-drawer-titulo" class="text-sm font-bold text-gray-800">Nova Regra SoD</h3>
        <input type="hidden" id="sod-form-id">
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Código <span class="text-red-500">*</span></label>
            <input id="sod-form-codigo" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: SOD-BC-001"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Descrição <span class="text-red-500">*</span></label>
            <textarea id="sod-form-desc" class="border rounded text-xs px-2 py-1.5 h-12 resize-none"></textarea></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Ação A (quem preparou/criou) <span class="text-red-500">*</span></label>
            <input id="sod-form-acaoA" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: BC.CRIAR"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Ação B (quem não pode aprovar) <span class="text-red-500">*</span></label>
            <input id="sod-form-acaoB" type="text" class="border rounded text-xs px-2 py-1.5" placeholder="ex.: BC.EXTRAORDINARIO.APROVAR"></div>
        <div class="flex flex-col gap-1"><label class="text-xs font-medium text-gray-600">Escopo</label>
            <select id="sod-form-escopo" class="border rounded text-xs px-2 py-1.5">
                ${Object.entries(_SOD_ESCOPO_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
            </select></div>
        <div class="flex gap-2 mt-auto pt-2">
            <button class="flex-1 px-3 py-1.5 text-xs border rounded text-gray-600" onclick="admSodFecharDrawer()">Cancelar</button>
            <button class="flex-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded" onclick="admSodSalvar()">Salvar como Rascunho</button>
        </div>
    </div>
</div>`;
}

function admSodNovo() {
    document.getElementById('sod-drawer-titulo').textContent = 'Nova Regra SoD';
    document.getElementById('sod-form-id').value = '';
    ['codigo','desc','acaoA','acaoB'].forEach(f => { const e = document.getElementById(`sod-form-${f}`); if (e) e.value=''; });
    document.getElementById('sod-form-escopo').value = 'MESMO_OBJETO';
    document.getElementById('sod-drawer').classList.remove('hidden');
}
function admSodEditar(id) {
    const r = _sodCache.find(x => x.id === id); if (!r) return;
    document.getElementById('sod-drawer-titulo').textContent = 'Editar Regra SoD';
    document.getElementById('sod-form-id').value    = id;
    document.getElementById('sod-form-codigo').value= r.codigo;
    document.getElementById('sod-form-desc').value  = r.descricao;
    document.getElementById('sod-form-acaoA').value = r.acao_a;
    document.getElementById('sod-form-acaoB').value = r.acao_b;
    document.getElementById('sod-form-escopo').value= r.escopo;
    document.getElementById('sod-drawer').classList.remove('hidden');
}
function admSodFecharDrawer() { document.getElementById('sod-drawer')?.classList.add('hidden'); }
async function admSodSalvar() {
    const id = document.getElementById('sod-form-id').value;
    const codigo = document.getElementById('sod-form-codigo').value.trim();
    const desc   = document.getElementById('sod-form-desc').value.trim();
    const acaoA  = document.getElementById('sod-form-acaoA').value.trim();
    const acaoB  = document.getElementById('sod-form-acaoB').value.trim();
    if (!codigo || !desc || !acaoA || !acaoB) { alert('Todos os campos obrigatórios devem ser preenchidos.'); return; }
    const payload = {
        codigo, descricao: desc, acao_a: acaoA, acao_b: acaoB,
        escopo: document.getElementById('sod-form-escopo').value,
        status: 'DRAFT', atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString(),
    };
    let err;
    if (id) { ({ error: err } = await _supabase.from('sod_rules').update(payload).eq('id', id)); }
    else    { payload.criado_por = _admOrgQuem(); ({ error: err } = await _supabase.from('sod_rules').insert([payload])); }
    if (err) { alert('Erro: ' + err.message); return; }
    admSodFecharDrawer(); _admSodLoad();
}
async function admSodPublicar(id) {
    if (!confirm('Publicar esta regra SoD? Passará a ser verificada em todos os fluxos.')) return;
    const { error } = await _supabase.from('sod_rules')
        .update({ status: 'PUBLISHED', atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admSodLoad();
}
async function admSodInativar(id) {
    if (!confirm('Inativar esta regra SoD?')) return;
    const { error } = await _supabase.from('sod_rules')
        .update({ status: 'INACTIVE', atualizado_por: _admOrgQuem(), atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    _admSodLoad();
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
