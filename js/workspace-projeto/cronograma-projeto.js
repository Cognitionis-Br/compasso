// =========================================================================
// workspace-projeto/cronograma-projeto.js
// Compasso 2.0 — V7: aba Cronograma do Workspace com Gantt interativo
// (Frappe Gantt 0.5.0, carregado sob demanda via CDN jsdelivr).
//
// Mantém no topo a trilha de fases existente (obterSegmentosFaseProjeto +
// renderTrilhaSegmentos de roadmap.js). Abaixo, Gantt completo sobre
// schedule_items persistidos em Supabase.
// =========================================================================

let _gantt = null;
let _ganttItens = [];
let _ganttProjetoCodigo = null;
let _ganttViewMode = 'Week';
let _ganttEditandoId = null; // null = novo, número = editando

// ── Carregamento dinâmico de Frappe Gantt ─────────────────────────────
function _ganttCarregarLib() {
    return new Promise(resolve => {
        if (window.Gantt) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.5.0/dist/frappe-gantt.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.5.0/dist/frappe-gantt.min.js';
        script.onload = resolve;
        script.onerror = () => { console.error('[Gantt] Falha ao carregar Frappe Gantt'); resolve(); };
        document.head.appendChild(script);
    });
}

// ── Entrada principal ─────────────────────────────────────────────────
async function renderCronogramaProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState('Carregando cronograma...');

    _ganttProjetoCodigo = projetoCodigo;
    _gantt = null;

    const projeto = (typeof projectsData !== 'undefined')
        ? projectsData.find(p => p.codigo === projetoCodigo) : null;

    const [{ data: etapasDoProjeto }, libOk, { data: itens, error }] = await Promise.all([
        _supabase.from('projeto_etapas').select('*').eq('projeto_codigo', projetoCodigo),
        _ganttCarregarLib(),
        _supabase.from('schedule_items').select('*')
            .eq('projeto_codigo', projetoCodigo)
            .order('ordem', { ascending: true })
    ]);

    if (error) {
        wrapper.innerHTML = `<p class="text-xs text-danger-600 py-4 text-center">Erro ao carregar cronograma: ${escapeHtml(error.message)}</p>`;
        return;
    }
    _ganttItens = itens || [];

    // ── Trilha de fases ───────────────────────────────────────────────
    let trilhaHtml = '';
    if (typeof obterSegmentosFaseProjeto === 'function' && typeof renderTrilhaSegmentos === 'function') {
        const segs = obterSegmentosFaseProjeto(projetoCodigo, etapasDoProjeto || []);
        if (segs.length > 0) {
            trilhaHtml = `
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
                <div class="text-[10px] text-gray-400 mb-2">
                    Visão de Fases · AF ${escapeHtml((projeto && projeto.ano_fiscal) || '-')}
                    <span class="ml-1">· barra rachurada = atrasado</span>
                </div>
                ${renderTrilhaSegmentos(segs, projetoCodigo, etapasDoProjeto || [], projeto && projeto.ano_fiscal, 0)}
            </div>`;
        }
    }

    // ── Gantt ─────────────────────────────────────────────────────────
    const semTarefas = _ganttItens.length === 0;
    const ganttAreaHtml = semTarefas
        ? `<p class="text-xs text-gray-400 italic py-10 text-center">
               <i class="fa-solid fa-diagram-gantt text-2xl text-gray-200 block mb-2"></i>
               Nenhuma tarefa ainda. Clique em <strong>+ Nova Tarefa</strong> para começar.
           </p>`
        : `<div class="overflow-x-auto"><svg id="wsFrappeGantt"></svg></div>`;

    wrapper.innerHTML = `
        ${trilhaHtml}

        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-3">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <i class="fa-solid fa-diagram-gantt mr-1.5 text-indigo-500"></i>Gantt de Tarefas
                </span>
                <div class="flex items-center gap-2">
                    ${!semTarefas ? `<div class="flex rounded overflow-hidden border border-gray-200 text-[10px] font-bold">
                        ${['Day','Week','Month'].map(m => `
                        <button onclick="_ganttMudarView('${m}')" id="ganttViewBtn_${m}"
                            class="px-2 py-1 ${m === _ganttViewMode
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'}">
                            ${m === 'Day' ? 'Dia' : m === 'Week' ? 'Semana' : 'Mês'}
                        </button>`).join('')}
                    </div>` : ''}
                    <button onclick="_ganttAbrirModal(null)"
                        class="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 flex items-center gap-1">
                        <i class="fa-solid fa-plus"></i> Nova Tarefa
                    </button>
                </div>
            </div>
            <div id="ganttContainer" class="p-3 min-h-[120px]">
                ${ganttAreaHtml}
            </div>
        </div>

        ${!semTarefas ? _ganttRenderTabela() : ''}

        ${_ganttHtmlModal()}
    `;

    if (!semTarefas && window.Gantt) _ganttInstanciar();
}

function _ganttInstanciar() {
    const tasks = _ganttItens.map(it => ({
        id: String(it.id),
        name: it.titulo,
        start: it.data_inicio,
        end: it.data_fim,
        progress: Number(it.progresso) || 0,
        dependencies: it.dependencias || ''
    }));

    try {
        _gantt = new Gantt('#wsFrappeGantt', tasks, {
            view_mode: _ganttViewMode,
            date_format: 'YYYY-MM-DD',
            bar_height: 22,
            bar_corner_radius: 3,
            padding: 16,
            on_click: t => _ganttAbrirModal(Number(t.id)),
            on_date_change: (t, s, e) => _ganttSalvarDatas(Number(t.id), s, e),
            on_progress_change: (t, p) => _ganttSalvarProgresso(Number(t.id), p)
        });
    } catch (e) {
        console.error('[Gantt] Erro ao instanciar:', e);
    }
}

function _ganttMudarView(mode) {
    _ganttViewMode = mode;
    ['Day','Week','Month'].forEach(m => {
        const btn = document.getElementById(`ganttViewBtn_${m}`);
        if (!btn) return;
        btn.className = `px-2 py-1 ${m === mode
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-500 hover:bg-gray-50'}`;
    });
    if (_gantt) _gantt.change_view_mode(mode);
}

// ── Tabela de tarefas ─────────────────────────────────────────────────
function _ganttRenderTabela() {
    const linhas = _ganttItens.map(it => `
        <tr class="hover:bg-gray-50">
            <td class="p-2 text-xs font-medium max-w-[180px] truncate" title="${escapeHtml(it.titulo)}">${escapeHtml(it.titulo)}</td>
            <td class="p-2 text-xs font-mono whitespace-nowrap">${it.data_inicio}</td>
            <td class="p-2 text-xs font-mono whitespace-nowrap">${it.data_fim}</td>
            <td class="p-2 min-w-[100px]">
                <div class="flex items-center gap-1.5">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden">
                        <div class="h-full bg-indigo-500 rounded" style="width:${Number(it.progresso)||0}%"></div>
                    </div>
                    <span class="text-[10px] text-gray-500 tabular-nums w-7">${Math.round(Number(it.progresso)||0)}%</span>
                </div>
            </td>
            <td class="p-2 text-xs text-gray-500 max-w-[120px] truncate">${escapeHtml(it.responsavel || '—')}</td>
            <td class="p-2 text-right whitespace-nowrap">
                <button onclick="_ganttAbrirModal(${it.id})" class="text-indigo-600 hover:text-indigo-800 text-xs mr-2" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="_ganttDeletar(${it.id})" class="text-red-400 hover:text-red-700 text-xs" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`).join('');

    return `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b border-gray-100 bg-gray-50">
                        <th class="p-2 text-[10px] font-bold uppercase text-gray-400">Tarefa</th>
                        <th class="p-2 text-[10px] font-bold uppercase text-gray-400">Início</th>
                        <th class="p-2 text-[10px] font-bold uppercase text-gray-400">Fim</th>
                        <th class="p-2 text-[10px] font-bold uppercase text-gray-400">Progresso</th>
                        <th class="p-2 text-[10px] font-bold uppercase text-gray-400">Responsável</th>
                        <th class="p-2"></th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────
function _ganttHtmlModal() {
    return `
    <div id="ganttModal" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 id="ganttModalTitulo" class="font-bold text-gray-800 text-sm"></h3>
                <button onclick="_ganttFecharModal()" class="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div class="px-5 py-4 space-y-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1">Título <span class="text-red-500">*</span></label>
                    <input id="ganttFldTitulo" type="text" maxlength="200"
                        class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                        placeholder="Nome da tarefa">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Início <span class="text-red-500">*</span></label>
                        <input id="ganttFldInicio" type="date"
                            class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Fim <span class="text-red-500">*</span></label>
                        <input id="ganttFldFim" type="date"
                            class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Progresso (%)</label>
                        <input id="ganttFldProgresso" type="number" min="0" max="100" step="5" value="0"
                            class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-1">Responsável</label>
                        <input id="ganttFldResponsavel" type="text" maxlength="100"
                            class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                            placeholder="Nome">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1">Depende de</label>
                    <select id="ganttFldDeps" multiple
                        class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 h-20"></select>
                    <p class="text-[10px] text-gray-400 mt-0.5">Ctrl+clique para selecionar múltiplas tarefas</p>
                </div>
                <div id="ganttErro" class="hidden text-xs text-red-600 bg-red-50 rounded px-3 py-2"></div>
            </div>
            <div class="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                <button onclick="_ganttFecharModal()"
                    class="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900">Cancelar</button>
                <button onclick="_ganttSalvar()"
                    class="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">
                    <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar
                </button>
            </div>
        </div>
    </div>`;
}

function _ganttAbrirModal(id) {
    _ganttEditandoId = id;
    const modal = document.getElementById('ganttModal');
    if (!modal) return;

    document.getElementById('ganttModalTitulo').textContent = id ? 'Editar Tarefa' : 'Nova Tarefa';
    document.getElementById('ganttErro').classList.add('hidden');

    const selDeps = document.getElementById('ganttFldDeps');
    selDeps.innerHTML = _ganttItens
        .filter(it => it.id !== id)
        .map(it => `<option value="${it.id}">${escapeHtml(it.titulo)}</option>`)
        .join('');

    if (id) {
        const it = _ganttItens.find(x => x.id === id);
        if (!it) return;
        document.getElementById('ganttFldTitulo').value = it.titulo;
        document.getElementById('ganttFldInicio').value = it.data_inicio;
        document.getElementById('ganttFldFim').value = it.data_fim;
        document.getElementById('ganttFldProgresso').value = Number(it.progresso) || 0;
        document.getElementById('ganttFldResponsavel').value = it.responsavel || '';
        const ids = (it.dependencias || '').split(',').map(s => s.trim()).filter(Boolean);
        Array.from(selDeps.options).forEach(o => { o.selected = ids.includes(o.value); });
    } else {
        document.getElementById('ganttFldTitulo').value = '';
        document.getElementById('ganttFldInicio').value = '';
        document.getElementById('ganttFldFim').value = '';
        document.getElementById('ganttFldProgresso').value = 0;
        document.getElementById('ganttFldResponsavel').value = '';
        Array.from(selDeps.options).forEach(o => { o.selected = false; });
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('ganttFldTitulo').focus(), 50);
}

function _ganttFecharModal() {
    const modal = document.getElementById('ganttModal');
    if (modal) modal.classList.add('hidden');
}

async function _ganttSalvar() {
    const titulo = (document.getElementById('ganttFldTitulo').value || '').trim();
    const inicio = document.getElementById('ganttFldInicio').value;
    const fim    = document.getElementById('ganttFldFim').value;
    const progresso  = Number(document.getElementById('ganttFldProgresso').value) || 0;
    const responsavel = (document.getElementById('ganttFldResponsavel').value || '').trim();
    const deps = Array.from(document.getElementById('ganttFldDeps').selectedOptions)
        .map(o => o.value).join(', ');

    const erroEl = document.getElementById('ganttErro');
    if (!titulo || !inicio || !fim) {
        erroEl.textContent = 'Título, data de início e data de fim são obrigatórios.';
        erroEl.classList.remove('hidden');
        return;
    }
    if (fim < inicio) {
        erroEl.textContent = 'Data de fim deve ser igual ou posterior ao início.';
        erroEl.classList.remove('hidden');
        return;
    }
    erroEl.classList.add('hidden');

    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : null;
    const payload = {
        projeto_codigo: _ganttProjetoCodigo,
        titulo, data_inicio: inicio, data_fim: fim,
        progresso, responsavel: responsavel || null,
        dependencias: deps,
        ordem: _ganttEditandoId
            ? (_ganttItens.find(x => x.id === _ganttEditandoId)?.ordem ?? 0)
            : _ganttItens.length,
        atualizado_em: new Date().toISOString()
    };

    let err;
    if (_ganttEditandoId) {
        const { error } = await _supabase.from('schedule_items').update(payload).eq('id', _ganttEditandoId);
        err = error;
    } else {
        payload.criado_por = user;
        const { error } = await _supabase.from('schedule_items').insert([payload]);
        err = error;
    }

    if (err) {
        erroEl.textContent = 'Erro ao salvar: ' + err.message;
        erroEl.classList.remove('hidden');
        return;
    }
    _ganttFecharModal();
    await renderCronogramaProjeto(_ganttProjetoCodigo, 'wsCronogramaBody');
}

// ── Callbacks de drag-and-drop do Gantt ───────────────────────────────
async function _ganttSalvarDatas(id, novoInicio, novoFim) {
    const fmt = d => d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
    await _supabase.from('schedule_items').update({
        data_inicio: fmt(novoInicio),
        data_fim: fmt(novoFim),
        atualizado_em: new Date().toISOString()
    }).eq('id', id);
}

async function _ganttSalvarProgresso(id, progresso) {
    await _supabase.from('schedule_items').update({
        progresso: Math.min(100, Math.max(0, Math.round(progresso))),
        atualizado_em: new Date().toISOString()
    }).eq('id', id);
}

async function _ganttDeletar(id) {
    if (!confirm('Excluir esta tarefa do cronograma?')) return;
    const { error } = await _supabase.from('schedule_items').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await renderCronogramaProjeto(_ganttProjetoCodigo, 'wsCronogramaBody');
}
