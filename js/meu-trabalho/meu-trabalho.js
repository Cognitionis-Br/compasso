// =========================================================================
// meu-trabalho/meu-trabalho.js
// Compasso 2.0 — Release 1, telas R1-UX02/UX03 (Meu Trabalho — Lista e
// Kanban). Backed pela tabela `tasks` (RLS por dono) e pelas funções RPC
// de sql/2026-09-23_r1_fundacao_trabalho_pessoal.sql — toda mutação de
// status passa por fn_transicionar_tarefa (concorrência otimista +
// histórico), nunca um UPDATE direto na tabela.
//
// "CONFLITO_VERSAO" no erro do RPC é como emulamos o 409 do pacote sem
// uma API HTTP própria (PostgREST devolve a mensagem da exceção) — ver
// _mtTratarErroRpc().
// =========================================================================

const MT_STATUS_LABELS = { A_FAZER: 'A Fazer', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO: 'Aguardando', CONCLUIDO: 'Concluído' };
const MT_STATUS_CORES = { A_FAZER: 'gray', EM_ANDAMENTO: 'blue', AGUARDANDO: 'amber', CONCLUIDO: 'emerald' };
const MT_STATUS_ORDEM = ['A_FAZER', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDO'];

let _mtTarefas = [];
let _mtView = 'lista';
let _mtFiltroStatus = '';

async function renderMeuTrabalhoView() {
    const { data: prefs } = await _supabase.from('user_preferences').select('view_meu_trabalho').eq('usuario_id', currentUser.id).maybeSingle();
    _mtView = (prefs && prefs.view_meu_trabalho) || 'lista';
    _mtAtualizarBotoesView();
    await _mtCarregarTarefas();
}

async function _mtCarregarTarefas() {
    const { data, error } = await _supabase.from('tasks').select('*').order('prazo', { ascending: true, nullsFirst: false });
    if (error) return alert('Erro ao carregar tarefas: ' + error.message);
    _mtTarefas = data || [];
    _mtRender();
}

function _mtRender() {
    document.getElementById('meuTrabalhoListaContainer').classList.toggle('hidden', _mtView !== 'lista');
    document.getElementById('meuTrabalhoKanbanContainer').classList.toggle('hidden', _mtView !== 'kanban');
    if (_mtView === 'lista') _mtRenderLista(); else _mtRenderKanban();
}

async function mudarViewMeuTrabalho(view) {
    _mtView = view;
    _mtAtualizarBotoesView();
    _mtRender();
    await _supabase.from('user_preferences').upsert({ usuario_id: currentUser.id, view_meu_trabalho: view });
}

function _mtAtualizarBotoesView() {
    ['lista', 'kanban'].forEach(v => {
        const btn = document.getElementById(`mtBtnView_${v}`);
        if (!btn) return;
        btn.classList.toggle('bg-indigo-700', v === _mtView);
        btn.classList.toggle('text-white', v === _mtView);
        btn.classList.toggle('text-gray-600', v !== _mtView);
    });
}

function onMudarFiltroStatusMeuTrabalho() {
    _mtFiltroStatus = document.getElementById('mtFiltroStatus').value;
    _mtRender();
}

function _mtTarefasFiltradas() {
    return _mtFiltroStatus ? _mtTarefas.filter(t => t.status === _mtFiltroStatus) : _mtTarefas;
}

// -------------------------------------------------------------------------
// Lista
// -------------------------------------------------------------------------
function _mtRenderLista() {
    const wrapper = document.getElementById('meuTrabalhoListaBody');
    if (!wrapper) return;
    const tarefas = _mtTarefasFiltradas();
    if (tarefas.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhuma tarefa. Clique em "Nova Tarefa" pra começar.</p>';
        return;
    }
    const hoje = new Date().toISOString().split('T')[0];
    wrapper.innerHTML = tarefas.map(t => {
        const atrasada = t.prazo && t.prazo < hoje && t.status !== 'CONCLUIDO';
        return `
        <div class="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50">
            <div class="min-w-0 flex-1 cursor-pointer" onclick="abrirModalTarefa(${t.id})">
                <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(t.titulo)}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">${t.projeto_codigo ? escapeHtml(t.projeto_codigo) + ' · ' : ''}${t.prazo ? formatDate(t.prazo) : 'Sem prazo'} · ${t.progresso}%</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                ${atrasada ? renderBadgeStatus('danger', 'fa-triangle-exclamation', 'Atrasada') : ''}
                ${renderBadgeStatus(t.prioridade === 'ALTA' ? 'danger' : (t.prioridade === 'MEDIA' ? 'amber' : 'gray'), 'fa-flag', t.prioridade)}
                <select onchange="mudarStatusTarefaSelect(${t.id}, this.value, ${t.version})" class="text-[10px] font-bold border border-gray-200 rounded px-1.5 py-1 bg-white">
                    ${MT_STATUS_ORDEM.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${MT_STATUS_LABELS[s]}</option>`).join('')}
                </select>
            </div>
        </div>`;
    }).join('');
}

async function mudarStatusTarefaSelect(taskId, novoStatus, versaoAtual) {
    const t = _mtTarefas.find(x => x.id === taskId);
    if (t && t.status === novoStatus) return;
    await _mtTransicionar(taskId, novoStatus, versaoAtual);
}

// -------------------------------------------------------------------------
// Kanban — drag & drop nativo (HTML5), sem lib externa.
// -------------------------------------------------------------------------
function _mtRenderKanban() {
    const wrapper = document.getElementById('meuTrabalhoKanbanBody');
    if (!wrapper) return;
    const tarefas = _mtTarefasFiltradas();
    wrapper.innerHTML = MT_STATUS_ORDEM.map(status => {
        const doStatus = tarefas.filter(t => t.status === status);
        return `
        <div class="bg-gray-50 rounded-lg border border-gray-200 flex flex-col min-w-[220px] flex-1"
             ondragover="event.preventDefault()" ondrop="_mtOnDrop(event, '${status}')">
            <div class="p-2 border-b border-gray-200 flex items-center justify-between">
                <span class="text-[10px] font-black uppercase text-gray-500">${MT_STATUS_LABELS[status]}</span>
                <span class="text-[10px] font-bold text-gray-400">${doStatus.length}</span>
            </div>
            <div class="p-2 space-y-2 min-h-[80px]">
                ${doStatus.map(t => `
                    <div draggable="true" ondragstart="_mtOnDragStart(event, ${t.id}, ${t.version})"
                         onclick="abrirModalTarefa(${t.id})"
                         class="bg-white p-2.5 rounded border border-gray-200 shadow-sm cursor-grab hover:border-indigo-300">
                        <div class="text-xs font-bold text-gray-800">${escapeHtml(t.titulo)}</div>
                        <div class="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                            <span>${t.projeto_codigo ? escapeHtml(t.projeto_codigo) : ''}</span>
                            ${renderBadgeStatus(t.prioridade === 'ALTA' ? 'danger' : (t.prioridade === 'MEDIA' ? 'amber' : 'gray'), null, t.prioridade)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
}

function _mtOnDragStart(ev, taskId, version) {
    ev.dataTransfer.setData('text/plain', JSON.stringify({ taskId, version }));
}

async function _mtOnDrop(ev, novoStatus) {
    ev.preventDefault();
    let payload;
    try { payload = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
    await _mtTransicionar(payload.taskId, novoStatus, payload.version);
}

// -------------------------------------------------------------------------
// Transição — sempre via RPC (nunca UPDATE direto), pra respeitar o grafo
// de transições válidas e a concorrência otimista do lado do servidor.
// -------------------------------------------------------------------------
async function _mtTransicionar(taskId, novoStatus, clientVersion) {
    const { error } = await _supabase.rpc('fn_transicionar_tarefa', {
        p_task_id: taskId, p_novo_status: novoStatus, p_client_version: clientVersion
    });
    if (error) return _mtTratarErroRpc(error);
    await _mtCarregarTarefas();
}

// Emula o tratamento de HTTP 409 do pacote: recarrega o estado atual do
// servidor e avisa o usuário, em vez de deixar a UI otimista "grudada" num
// estado que já não existe mais no banco.
function _mtTratarErroRpc(error) {
    const msg = (error && error.message) || '';
    if (msg.includes('CONFLITO_VERSAO')) {
        alert('⚠️ Essa tarefa foi alterada por outra sessão enquanto você editava. A lista foi recarregada com o estado atual — tente de novo.');
    } else {
        alert('⛔ ' + (msg || 'Não foi possível concluir a operação.'));
    }
    _mtCarregarTarefas();
}

// -------------------------------------------------------------------------
// Modal de criar/editar tarefa
// -------------------------------------------------------------------------
let _mtTarefaEditandoId = null;

// Select de projeto — só os do escopo do usuário (mesma regra de Meus
// Projetos), pra nunca oferecer um código que a tarefa não poderia
// referenciar (a tabela tasks tem FK pra projetos.codigo — digitar um
// código à mão podia violar a constraint, daí o select em vez de texto
// livre).
function _mtPopularSelectProjetos(codigoAtual) {
    const select = document.getElementById('mtProjetoInput');
    if (!select) return;
    const meus = (typeof filtrarProjetosPorArea === 'function' && typeof projectsData !== 'undefined')
        ? filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos')
        : [];
    select.innerHTML = '<option value="">-- Nenhum --</option>' +
        meus.map(p => `<option value="${escapeHtml(p.codigo)}" ${p.codigo === codigoAtual ? 'selected' : ''}>${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</option>`).join('');
}

function abrirModalNovaTarefa() {
    _mtTarefaEditandoId = null;
    document.getElementById('mtModalTitulo').innerText = 'Nova Tarefa';
    document.getElementById('mtTituloInput').value = '';
    document.getElementById('mtDescricaoInput').value = '';
    document.getElementById('mtPrioridadeInput').value = 'MEDIA';
    document.getElementById('mtPrazoInput').value = '';
    _mtPopularSelectProjetos(null);
    document.getElementById('modalTarefa').classList.remove('hidden');
}

function abrirModalTarefa(taskId) {
    const t = _mtTarefas.find(x => x.id === taskId);
    if (!t) return;
    _mtTarefaEditandoId = taskId;
    document.getElementById('mtModalTitulo').innerText = 'Editar Tarefa';
    document.getElementById('mtTituloInput').value = t.titulo;
    document.getElementById('mtDescricaoInput').value = t.descricao || '';
    document.getElementById('mtPrioridadeInput').value = t.prioridade;
    document.getElementById('mtPrazoInput').value = t.prazo || '';
    _mtPopularSelectProjetos(t.projeto_codigo);
    document.getElementById('modalTarefa').classList.remove('hidden');
}

function fecharModalTarefa() {
    document.getElementById('modalTarefa').classList.add('hidden');
}

async function salvarTarefa() {
    const titulo = document.getElementById('mtTituloInput').value.trim();
    if (!titulo) return alert('Informe o título da tarefa.');
    const descricao = document.getElementById('mtDescricaoInput').value.trim() || null;
    const prioridade = document.getElementById('mtPrioridadeInput').value;
    const prazo = document.getElementById('mtPrazoInput').value || null;
    const projetoCodigo = document.getElementById('mtProjetoInput').value.trim() || null;

    let error;
    if (_mtTarefaEditandoId) {
        const t = _mtTarefas.find(x => x.id === _mtTarefaEditandoId);
        ({ error } = await _supabase.rpc('fn_atualizar_tarefa', {
            p_task_id: _mtTarefaEditandoId, p_client_version: t.version,
            p_titulo: titulo, p_descricao: descricao, p_prioridade: prioridade, p_prazo: prazo
        }));
    } else {
        ({ error } = await _supabase.rpc('fn_criar_tarefa', {
            p_titulo: titulo, p_descricao: descricao, p_projeto_codigo: projetoCodigo,
            p_prioridade: prioridade, p_prazo: prazo
        }));
    }
    if (error) return _mtTratarErroRpc(error);
    fecharModalTarefa();
    await _mtCarregarTarefas();
}
