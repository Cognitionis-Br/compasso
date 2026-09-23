// =========================================================================
// workspace-projeto/drawer-tarefa.js
// Compasso 2.0 — Release 2. Painel lateral (drawer) de uma tarefa —
// checklist, comentários (com menção opcional via seletor de usuário, não
// parsing de @texto), anexos e dependências. Aberto a partir da aba
// Tarefas do Workspace (js/workspace-projeto/workspace-projeto.js);
// tarefas "pessoais" (sem projeto, de Meu Trabalho) continuam usando o
// modal simples do Release 1 (js/meu-trabalho/meu-trabalho.js).
// =========================================================================

let _drawerTaskId = null;
let _drawerUsuariosCache = null; // [{id, nome}] — carregado uma vez, reaproveitado pro seletor de menção

async function _drawerCarregarUsuarios() {
    if (_drawerUsuariosCache) return _drawerUsuariosCache;
    const { data } = await _supabase.from('perfis_usuarios').select('id, nome').order('nome');
    _drawerUsuariosCache = data || [];
    return _drawerUsuariosCache;
}

async function abrirDrawerTarefa(taskId) {
    const t = _tarefasCache[taskId];
    if (!t) return;
    _drawerTaskId = taskId;

    document.getElementById('drawerTarefaTitulo').innerText = t.titulo;
    document.getElementById('drawerTarefaDescricao').innerText = t.descricao || 'Sem descrição.';
    document.getElementById('drawerTarefaProjeto').innerText = t.projeto_codigo || '-';

    const selectStatus = document.getElementById('drawerTarefaStatusSelect');
    selectStatus.innerHTML = MT_STATUS_ORDEM.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${MT_STATUS_LABELS[s]}</option>`).join('');
    selectStatus.onchange = async () => {
        const tarefaAtual = _tarefasCache[_drawerTaskId];
        await transicionarTarefaEAtualizar(_drawerTaskId, selectStatus.value, tarefaAtual.version, async () => {
            await _wsCarregarTarefas();
            await abrirDrawerTarefa(_drawerTaskId); // recarrega o próprio drawer com a versão nova
        });
    };

    document.getElementById('drawerTarefa').classList.remove('hidden');

    await Promise.all([
        _drawerRenderChecklist(),
        _drawerRenderComentarios(),
        _drawerRenderAnexos(),
        _drawerRenderDependencias()
    ]);
}

function fecharDrawerTarefa() {
    document.getElementById('drawerTarefa').classList.add('hidden');
    _drawerTaskId = null;
}

// -------------------------------------------------------------------------
// Checklist
// -------------------------------------------------------------------------
async function _drawerRenderChecklist() {
    const wrapper = document.getElementById('drawerChecklistBody');
    if (!wrapper) return;
    const { data, error } = await _supabase.from('task_checklist_items').select('*').eq('task_id', _drawerTaskId).order('id');
    if (error) { wrapper.innerHTML = `<p class="text-[11px] text-danger-600">Erro ao carregar checklist: ${escapeHtml(error.message)}</p>`; return; }
    const itens = data || [];
    wrapper.innerHTML = itens.length === 0
        ? '<p class="text-[11px] text-gray-400 italic">Nenhum item ainda.</p>'
        : itens.map(i => `
            <label class="flex items-center gap-2 text-xs py-1 cursor-pointer">
                <input type="checkbox" ${i.concluido ? 'checked' : ''} onchange="_drawerAlternarChecklist(${i.id}, this.checked)">
                <span class="${i.concluido ? 'line-through text-gray-400' : 'text-gray-700'}">${escapeHtml(i.texto)}</span>
            </label>
        `).join('');
}

async function _drawerAlternarChecklist(itemId, concluido) {
    await _supabase.from('task_checklist_items').update({ concluido }).eq('id', itemId);
    await _drawerRenderChecklist();
}

async function drawerAdicionarChecklistItem() {
    const input = document.getElementById('drawerChecklistNovoInput');
    const texto = input.value.trim();
    if (!texto) return;
    const { error } = await _supabase.from('task_checklist_items').insert([{ task_id: _drawerTaskId, texto }]);
    if (error) return alert('Erro ao adicionar item: ' + error.message);
    input.value = '';
    await _drawerRenderChecklist();
}

// -------------------------------------------------------------------------
// Comentários + menção (seletor de usuário, não parsing de @texto)
// -------------------------------------------------------------------------
async function _drawerRenderComentarios() {
    const wrapper = document.getElementById('drawerComentariosBody');
    if (!wrapper) return;
    const [{ data: comentarios, error }, usuarios] = await Promise.all([
        _supabase.from('task_comments').select('*').eq('task_id', _drawerTaskId).order('criado_em'),
        _drawerCarregarUsuarios()
    ]);
    if (error) { wrapper.innerHTML = `<p class="text-[11px] text-danger-600">Erro ao carregar comentários: ${escapeHtml(error.message)}</p>`; return; }
    const nomesPorId = Object.fromEntries(usuarios.map(u => [u.id, u.nome]));
    wrapper.innerHTML = (comentarios || []).length === 0
        ? '<p class="text-[11px] text-gray-400 italic">Nenhum comentário ainda.</p>'
        : comentarios.map(c => `
            <div class="text-xs border-b border-gray-50 pb-2 mb-2">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-700">${escapeHtml(nomesPorId[c.autor_id] || 'Usuário')}</span>
                    <span class="text-[10px] text-gray-400">${formatDateTime(c.criado_em)}</span>
                </div>
                <div class="text-gray-600 mt-0.5">${escapeHtml(c.conteudo)}</div>
            </div>
        `).join('');

    const selectMencionar = document.getElementById('drawerMencionarSelect');
    if (selectMencionar) {
        selectMencionar.innerHTML = '<option value="">Mencionar alguém (opcional)</option>' +
            usuarios.filter(u => u.id !== currentUser.id).map(u => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('');
    }
}

async function drawerAdicionarComentario() {
    const input = document.getElementById('drawerComentarioInput');
    const conteudo = input.value.trim();
    if (!conteudo) return;
    const mencionadoId = document.getElementById('drawerMencionarSelect').value || null;

    const { data: comentario, error } = await _supabase.from('task_comments')
        .insert([{ task_id: _drawerTaskId, autor_id: currentUser.id, conteudo }])
        .select().single();
    if (error) return alert('Erro ao comentar: ' + error.message);

    if (mencionadoId) {
        await _supabase.from('task_mentions').insert([{ task_comment_id: comentario.id, mentioned_user_id: mencionadoId }]);
    }

    input.value = '';
    document.getElementById('drawerMencionarSelect').value = '';
    await _drawerRenderComentarios();
}

// -------------------------------------------------------------------------
// Anexos — mesmo padrão de contratos_pendencias_anexos (js/contratos/pendencias.js).
// -------------------------------------------------------------------------
async function _drawerRenderAnexos() {
    const wrapper = document.getElementById('drawerAnexosBody');
    if (!wrapper) return;
    const { data, error } = await _supabase.from('task_attachments').select('*').eq('task_id', _drawerTaskId).order('enviado_em', { ascending: false });
    if (error) { wrapper.innerHTML = `<p class="text-[11px] text-danger-600">Erro ao carregar anexos: ${escapeHtml(error.message)}</p>`; return; }
    const anexos = data || [];
    if (anexos.length === 0) {
        wrapper.innerHTML = '<p class="text-[11px] text-gray-400 italic">Nenhum anexo ainda.</p>';
        return;
    }
    wrapper.innerHTML = (await Promise.all(anexos.map(async a => {
        const { data: assinado } = await _supabase.storage.from('task-anexos').createSignedUrl(a.storage_path, 300);
        const link = assinado && assinado.signedUrl ? assinado.signedUrl : '#';
        return `<div class="flex items-center justify-between text-xs py-1">
            <a href="${link}" target="_blank" class="text-indigo-700 hover:text-indigo-900 font-bold truncate"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(a.nome_original)}</a>
            <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${formatDate(a.enviado_em)}</span>
        </div>`;
    }))).join('');
}

async function drawerEnviarAnexo(input) {
    const arquivo = input.files && input.files[0];
    if (!arquivo) return;
    const storagePath = `${_drawerTaskId}/${Date.now()}_${arquivo.name}`;
    const { error: erroUpload } = await _supabase.storage.from('task-anexos').upload(storagePath, arquivo);
    if (erroUpload) { input.value = ''; return alert('Erro ao enviar anexo: ' + erroUpload.message); }

    await _supabase.from('task_attachments').insert([{
        task_id: _drawerTaskId, storage_path: storagePath, nome_original: arquivo.name,
        tipo_mime: arquivo.type || null, tamanho_bytes: arquivo.size, enviado_por: currentUser.id
    }]);
    input.value = '';
    await _drawerRenderAnexos();
}

// -------------------------------------------------------------------------
// Dependências
// -------------------------------------------------------------------------
async function _drawerRenderDependencias() {
    const wrapper = document.getElementById('drawerDependenciasBody');
    const selectAdicionar = document.getElementById('drawerDependenciaSelect');
    if (!wrapper) return;

    const tarefaAtual = _tarefasCache[_drawerTaskId];
    const [{ data: dependencias, error }, { data: tarefasDoProjeto }] = await Promise.all([
        _supabase.from('task_dependencies').select('id, depende_de_task_id, tasks!task_dependencies_depende_de_task_id_fkey(titulo, status)').eq('task_id', _drawerTaskId),
        tarefaAtual && tarefaAtual.projeto_codigo
            ? _supabase.from('tasks').select('id, titulo').eq('projeto_codigo', tarefaAtual.projeto_codigo).neq('id', _drawerTaskId)
            : Promise.resolve({ data: [] })
    ]);
    if (error) { wrapper.innerHTML = `<p class="text-[11px] text-danger-600">Erro ao carregar dependências: ${escapeHtml(error.message)}</p>`; return; }

    const deps = dependencias || [];
    wrapper.innerHTML = deps.length === 0
        ? '<p class="text-[11px] text-gray-400 italic">Nenhuma dependência.</p>'
        : deps.map(d => `
            <div class="flex items-center justify-between text-xs py-1">
                <span class="truncate">${escapeHtml((d.tasks && d.tasks.titulo) || ('Tarefa #' + d.depende_de_task_id))} ${d.tasks ? renderBadgeStatus(d.tasks.status === 'CONCLUIDO' ? 'emerald' : 'gray', null, MT_STATUS_LABELS[d.tasks.status] || d.tasks.status) : ''}</span>
                <button onclick="drawerRemoverDependencia(${d.id})" class="text-danger-600 hover:text-danger-800 flex-shrink-0 ml-2"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');

    if (selectAdicionar) {
        const idsJaDependentes = new Set(deps.map(d => d.depende_de_task_id));
        const disponiveis = (tarefasDoProjeto || []).filter(t => !idsJaDependentes.has(t.id));
        selectAdicionar.innerHTML = '<option value="">-- Selecione uma tarefa --</option>' +
            disponiveis.map(t => `<option value="${t.id}">${escapeHtml(t.titulo)}</option>`).join('');
    }
}

async function drawerAdicionarDependencia() {
    const select = document.getElementById('drawerDependenciaSelect');
    const dependeDeId = Number(select.value);
    if (!dependeDeId) return;
    const { error } = await _supabase.from('task_dependencies').insert([{ task_id: _drawerTaskId, depende_de_task_id: dependeDeId }]);
    if (error) return alert('Erro ao adicionar dependência: ' + error.message);
    await _drawerRenderDependencias();
}

async function drawerRemoverDependencia(dependenciaId) {
    await _supabase.from('task_dependencies').delete().eq('id', dependenciaId);
    await _drawerRenderDependencias();
}
