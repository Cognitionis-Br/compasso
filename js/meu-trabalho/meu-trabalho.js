// =========================================================================
// meu-trabalho/meu-trabalho.js
// Compasso 2.0 — Release 1, telas R1-UX02/UX03 (Meu Trabalho — Lista e
// Kanban). Backed pela tabela `tasks` e pelas funções RPC de
// sql/2026-09-23_r1_fundacao_trabalho_pessoal.sql — toda mutação de
// status passa por fn_transicionar_tarefa (concorrência otimista +
// histórico + checagem de dependência, esta última do Release 2), nunca
// um UPDATE direto na tabela.
//
// "CONFLITO_VERSAO"/"DEPENDENCIA_PENDENTE" no erro do RPC é como emulamos
// o 409/422 do pacote sem uma API HTTP própria — ver tratarErroRpcTarefa().
//
// Release 2: as funções de renderização (renderListaDeTarefas/
// renderKanbanDeTarefas) e o modal de tarefa foram generalizados pra
// serem reaproveitados também pela aba "Tarefas" do Workspace do Projeto
// (js/workspace-projeto/workspace-projeto.js) — a diferença entre "Meu
// Trabalho" (só minhas tarefas) e "Projeto - Tarefas" (todas as tarefas
// daquele projeto, colaborativo) é só QUAL consulta popula `tarefas`;
// renderização, drag&drop e RPC são os mesmos.
// =========================================================================

const MT_STATUS_LABELS = { A_FAZER: 'A Fazer', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO: 'Aguardando', CONCLUIDO: 'Concluído' };
const MT_STATUS_ORDEM = ['A_FAZER', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDO'];

// Cache global id->tarefa, alimentado por QUALQUER tela que renderize
// tarefas (Meu Trabalho ou o Workspace de um projeto) — permite que
// abrirModalTarefa(id), chamado de um onclick inline, ache a tarefa
// certa não importa de onde veio.
const _tarefasCache = {};

let _mtTarefas = [];
let _mtView = 'lista';
let _mtFiltroStatus = '';
let _mtAcaoPendente = null; // ver abrirMeuTrabalho — mesmo padrão de abrirWorkspaceProjeto, pra deep-link de notificação

// `acaoPendente` (opcional): função async rodada depois que a lista
// termina de carregar — usado por notificações pra abrir Meu Trabalho já
// com o modal de uma tarefa específica aberto (tarefa sem projeto).
function abrirMeuTrabalho(acaoPendente) {
    _mtAcaoPendente = acaoPendente || null;
    switchTab('meu_trabalho');
}

async function renderMeuTrabalhoView() {
    const { data: prefs } = await _supabase.from('user_preferences').select('view_meu_trabalho').eq('usuario_id', currentUser.id).maybeSingle();
    _mtView = (prefs && prefs.view_meu_trabalho) || 'lista';
    _mtAtualizarBotoesView();
    await _mtCarregarTarefas();
    if (_mtAcaoPendente) {
        const acao = _mtAcaoPendente;
        _mtAcaoPendente = null;
        await acao();
    }
}

async function _mtCarregarTarefas() {
    const { data, error } = await _supabase.from('tasks').select('*')
        .or(`assigned_user_id.eq.${currentUser.id},criado_por.eq.${currentUser.id}`)
        .order('prazo', { ascending: true, nullsFirst: false });
    if (error) return alert('Erro ao carregar tarefas: ' + error.message);
    _mtTarefas = data || [];
    _mtRender();
}

function _mtRender() {
    document.getElementById('meuTrabalhoListaContainer').classList.toggle('hidden', _mtView !== 'lista');
    document.getElementById('meuTrabalhoKanbanContainer').classList.toggle('hidden', _mtView !== 'kanban');
    const tarefas = _mtFiltroStatus ? _mtTarefas.filter(t => t.status === _mtFiltroStatus) : _mtTarefas;
    if (_mtView === 'lista') {
        renderListaDeTarefas(tarefas, 'meuTrabalhoListaBody', _mtCarregarTarefas);
    } else {
        renderKanbanDeTarefas(tarefas, 'meuTrabalhoKanbanBody', _mtCarregarTarefas);
    }
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

// -------------------------------------------------------------------------
// Renderização compartilhada — Lista. `aoRecarregar` é chamado depois de
// qualquer mutação de status bem-sucedida (cada tela recarrega a SUA
// própria consulta: "minhas tarefas" ou "tarefas do projeto X").
// -------------------------------------------------------------------------
function renderListaDeTarefas(tarefas, wrapperElId, aoRecarregar, aoAbrirFn) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    aoAbrirFn = aoAbrirFn || 'abrirModalTarefa';
    tarefas.forEach(t => { _tarefasCache[t.id] = t; });
    const callbackId = _registrarCallbackRecarregar(aoRecarregar);
    if (tarefas.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhuma tarefa. Clique em "Nova Tarefa" pra começar.</p>';
        return;
    }
    const hoje = new Date().toISOString().split('T')[0];
    wrapper.innerHTML = tarefas.map(t => {
        const atrasada = t.prazo && t.prazo < hoje && t.status !== 'CONCLUIDO';
        return `
        <div class="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50">
            <div class="min-w-0 flex-1 cursor-pointer" onclick="${aoAbrirFn}(${t.id})">
                <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(t.titulo)}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">${t.projeto_codigo ? escapeHtml(t.projeto_codigo) + ' · ' : ''}${t.prazo ? formatDate(t.prazo) : 'Sem prazo'} · ${t.progresso}%</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                ${atrasada ? renderBadgeStatus('danger', 'fa-triangle-exclamation', 'Atrasada') : ''}
                ${renderBadgeStatus(t.prioridade === 'ALTA' ? 'danger' : (t.prioridade === 'MEDIA' ? 'amber' : 'gray'), 'fa-flag', t.prioridade)}
                <select onchange="_dispatchMudarStatus(${t.id}, this.value, ${t.version}, '${callbackId}')" class="text-[10px] font-bold border border-gray-200 rounded px-1.5 py-1 bg-white">
                    ${MT_STATUS_ORDEM.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${MT_STATUS_LABELS[s]}</option>`).join('')}
                </select>
            </div>
        </div>`;
    }).join('');
}

async function _dispatchMudarStatus(taskId, novoStatus, versaoAtual, callbackId) {
    const t = _tarefasCache[taskId];
    if (t && t.status === novoStatus) return;
    await transicionarTarefaEAtualizar(taskId, novoStatus, versaoAtual, _resolverCallbackRecarregar(callbackId));
}

// Pequeno registro de callbacks — evita colocar função como atributo HTML
// (não dá pra serializar closures em onclick=""), sem precisar de um
// framework de eventos só pra isso.
let _callbackRecarregarSeq = 0;
const _callbacksRecarregar = {};
function _registrarCallbackRecarregar(fn) {
    const id = String(++_callbackRecarregarSeq);
    _callbacksRecarregar[id] = fn;
    return id;
}
function _resolverCallbackRecarregar(id) {
    return _callbacksRecarregar[id] || (() => {});
}

// -------------------------------------------------------------------------
// Renderização compartilhada — Kanban. Drag & drop nativo (HTML5), sem
// lib externa.
// -------------------------------------------------------------------------
function renderKanbanDeTarefas(tarefas, wrapperElId, aoRecarregar, aoAbrirFn) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    aoAbrirFn = aoAbrirFn || 'abrirModalTarefa';
    tarefas.forEach(t => { _tarefasCache[t.id] = t; });
    const callbackId = _registrarCallbackRecarregar(aoRecarregar);
    wrapper.innerHTML = MT_STATUS_ORDEM.map(status => {
        const doStatus = tarefas.filter(t => t.status === status);
        return `
        <div class="bg-gray-50 rounded-lg border border-gray-200 flex flex-col min-w-[220px] flex-1"
             ondragover="event.preventDefault()" ondrop="_kanbanOnDrop(event, '${status}', '${callbackId}')">
            <div class="p-2 border-b border-gray-200 flex items-center justify-between">
                <span class="text-[10px] font-black uppercase text-gray-500">${MT_STATUS_LABELS[status]}</span>
                <span class="text-[10px] font-bold text-gray-400">${doStatus.length}</span>
            </div>
            <div class="p-2 space-y-2 min-h-[80px]">
                ${doStatus.map(t => `
                    <div draggable="true" ondragstart="_kanbanOnDragStart(event, ${t.id}, ${t.version})"
                         onclick="${aoAbrirFn}(${t.id})"
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

function _kanbanOnDragStart(ev, taskId, version) {
    ev.dataTransfer.setData('text/plain', JSON.stringify({ taskId, version }));
}

async function _kanbanOnDrop(ev, novoStatus, callbackId) {
    ev.preventDefault();
    let payload;
    try { payload = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
    await transicionarTarefaEAtualizar(payload.taskId, novoStatus, payload.version, _resolverCallbackRecarregar(callbackId));
}

// -------------------------------------------------------------------------
// Transição — sempre via RPC (nunca UPDATE direto), pra respeitar o grafo
// de transições válidas, a checagem de dependência (Release 2) e a
// concorrência otimista do lado do servidor.
// -------------------------------------------------------------------------
async function transicionarTarefaEAtualizar(taskId, novoStatus, clientVersion, aoRecarregar) {
    const { error } = await _supabase.rpc('fn_transicionar_tarefa', {
        p_task_id: taskId, p_novo_status: novoStatus, p_client_version: clientVersion
    });
    if (error) tratarErroRpcTarefa(error);
    if (aoRecarregar) await aoRecarregar();
}

// Emula o tratamento de HTTP 409/422 do pacote: recarrega o estado atual
// do servidor e avisa o usuário, em vez de deixar a UI otimista "grudada"
// num estado que já não existe mais no banco.
function tratarErroRpcTarefa(error) {
    const msg = (error && error.message) || '';
    if (msg.includes('CONFLITO_VERSAO')) {
        alert('⚠️ Essa tarefa foi alterada por outra sessão enquanto você editava. A lista foi recarregada com o estado atual — tente de novo.');
    } else if (msg.includes('DEPENDENCIA_PENDENTE')) {
        alert('⛔ Essa tarefa depende de outra(s) ainda não concluída(s). Conclua as dependências antes.');
    } else {
        alert('⛔ ' + (msg || 'Não foi possível concluir a operação.'));
    }
}

// -------------------------------------------------------------------------
// Modal de criar/editar tarefa — compartilhado entre Meu Trabalho e o
// Workspace do Projeto. `projetoCodigoFixo` (Release 2): quando aberto a
// partir da aba Tarefas de um projeto, trava o campo de projeto nesse
// código em vez de deixar escolher.
// -------------------------------------------------------------------------
let _mtTarefaEditandoId = null;
let _mtAoSalvarCallbackId = null;

// Select de projeto — só os do escopo do usuário (mesma regra de Meus
// Projetos), pra nunca oferecer um código que a tarefa não poderia
// referenciar (a tabela tasks tem FK pra projetos.codigo — digitar um
// código à mão podia violar a constraint, daí o select em vez de texto
// livre).
function _mtPopularSelectProjetos(codigoAtual, projetoCodigoFixo) {
    const select = document.getElementById('mtProjetoInput');
    if (!select) return;
    if (projetoCodigoFixo) {
        const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === projetoCodigoFixo) : null;
        select.innerHTML = `<option value="${escapeHtml(projetoCodigoFixo)}" selected>${escapeHtml(projetoCodigoFixo)}${p ? ' — ' + escapeHtml(p.nome || '') : ''}</option>`;
        select.disabled = true;
        return;
    }
    select.disabled = false;
    const meus = (typeof filtrarProjetosPorArea === 'function' && typeof projectsData !== 'undefined')
        ? filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos')
        : [];
    select.innerHTML = '<option value="">-- Nenhum --</option>' +
        meus.map(p => `<option value="${escapeHtml(p.codigo)}" ${p.codigo === codigoAtual ? 'selected' : ''}>${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</option>`).join('');
}

function abrirModalNovaTarefa(projetoCodigoFixo, aoSalvar) {
    _mtTarefaEditandoId = null;
    _mtAoSalvarCallbackId = aoSalvar ? _registrarCallbackRecarregar(aoSalvar) : null;
    document.getElementById('mtModalTitulo').innerText = 'Nova Tarefa';
    document.getElementById('mtTituloInput').value = '';
    document.getElementById('mtDescricaoInput').value = '';
    document.getElementById('mtPrioridadeInput').value = 'MEDIA';
    document.getElementById('mtPrazoInput').value = '';
    _mtPopularSelectProjetos(null, projetoCodigoFixo);
    document.getElementById('modalTarefa').classList.remove('hidden');
}

function abrirModalTarefa(taskId) {
    const t = _tarefasCache[taskId];
    if (!t) return;
    _mtTarefaEditandoId = taskId;
    _mtAoSalvarCallbackId = null;
    document.getElementById('mtModalTitulo').innerText = 'Editar Tarefa';
    document.getElementById('mtTituloInput').value = t.titulo;
    document.getElementById('mtDescricaoInput').value = t.descricao || '';
    document.getElementById('mtPrioridadeInput').value = t.prioridade;
    document.getElementById('mtPrazoInput').value = t.prazo || '';
    _mtPopularSelectProjetos(t.projeto_codigo, null);
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
        const t = _tarefasCache[_mtTarefaEditandoId];
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
    if (error) return tratarErroRpcTarefa(error);
    fecharModalTarefa();
    if (_mtAoSalvarCallbackId) await _resolverCallbackRecarregar(_mtAoSalvarCallbackId)();
    else if (document.getElementById('view-meu_trabalho') && !document.getElementById('view-meu_trabalho').classList.contains('hidden')) await _mtCarregarTarefas();
}
