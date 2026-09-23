// =========================================================================
// busca/busca-global.js
// Compasso 2.0 — Release 4, "Busca Global" do pacote. Client-side sobre
// dados já carregados/consultas simples — sem SEARCH_INDEX dedicado (fora
// de proporção pro volume atual do Compasso, mesmo trim consciente do
// R3). "Permission-aware" vem de graça: projetos passam por
// filtrarProjetosPorArea (mesma regra de Meus Projetos) e tasks/raid_items
// já têm RLS (Releases 1/2) — a busca nunca alcança nada que o usuário
// não pudesse já ver em outra tela.
//
// Deep-link de tarefa reaproveita o MESMO padrão de
// js/notificacoes/notificacoes.js (_notifAbrirELer): abre o Workspace do
// projeto + Drawer, ou Meu Trabalho + modal, se a tarefa não tiver
// projeto.
// =========================================================================

let _buscaGlobalTermo = '';

function executarBuscaGlobal() {
    const input = document.getElementById('buscaGlobalInput');
    _buscaGlobalTermo = (input ? input.value : '').trim();
    if (!_buscaGlobalTermo) return;
    switchTab('busca_global');
}

async function renderBuscaGlobalView() {
    const displayTermo = document.getElementById('buscaGlobalTermoDisplay');
    if (displayTermo) displayTermo.innerText = _buscaGlobalTermo;

    const wrapper = document.getElementById('buscaGlobalResultados');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const termo = _buscaGlobalTermo;
    const termoLower = termo.toLowerCase();

    const projetosEncontrados = filtrarProjetosPorArea(
        (projectsData || []).filter(p => !p.is_subprojeto && (
            (p.codigo || '').toLowerCase().includes(termoLower) ||
            (p.nome || '').toLowerCase().includes(termoLower)
        )), 'meus_projetos'
    ).slice(0, 20);

    const [{ data: tarefasEncontradas }, { data: raidEncontrados }] = await Promise.all([
        _supabase.from('tasks').select('*').ilike('titulo', `%${termo}%`).limit(20),
        _supabase.from('raid_items').select('*').ilike('titulo', `%${termo}%`).limit(20)
    ]);

    const secoes = [];
    if (projetosEncontrados.length > 0) {
        secoes.push({ titulo: 'Projetos', itens: projetosEncontrados.map(p => ({
            texto: `${p.codigo} — ${p.nome || ''}`, sub: p.etapa_atual || 'Business Case',
            onclick: `abrirWorkspaceProjeto('${p.codigo}')`
        })) });
    }
    if ((tarefasEncontradas || []).length > 0) {
        secoes.push({ titulo: 'Tarefas', itens: tarefasEncontradas.map(t => ({
            texto: t.titulo, sub: t.projeto_codigo || 'Pessoal', onclick: `_buscaGlobalAbrirTarefa(${t.id})`
        })) });
    }
    if ((raidEncontrados || []).length > 0) {
        secoes.push({ titulo: 'Riscos e Ocorrências', itens: raidEncontrados.map(i => ({
            texto: i.titulo, sub: `${i.projeto_codigo} · ${i.tipo}`, onclick: `abrirWorkspaceProjeto('${i.projeto_codigo}')`
        })) });
    }

    if (secoes.length === 0) {
        wrapper.innerHTML = `<p class="text-xs text-gray-400 italic py-8 text-center">Nenhum resultado pra "${escapeHtml(termo)}".</p>`;
        return;
    }

    wrapper.innerHTML = secoes.map(s => `
        <div class="mb-4">
            <h4 class="text-[10px] font-black uppercase text-gray-400 mb-1.5">${escapeHtml(s.titulo)} (${s.itens.length})</h4>
            <div class="space-y-1.5">
                ${s.itens.map(i => `
                    <div class="flex items-center justify-between p-2.5 rounded border border-gray-100 bg-white hover:bg-gray-50 cursor-pointer" onclick="${i.onclick}">
                        <span class="text-xs font-bold text-gray-800 truncate">${escapeHtml(i.texto)}</span>
                        <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${escapeHtml(i.sub)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

async function _buscaGlobalAbrirTarefa(taskId) {
    let tarefa = _tarefasCache[taskId];
    if (!tarefa) {
        const { data } = await _supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
        tarefa = data;
        if (tarefa) _tarefasCache[tarefa.id] = tarefa;
    }
    if (!tarefa) return;
    if (tarefa.projeto_codigo) {
        abrirWorkspaceProjeto(tarefa.projeto_codigo, async () => {
            await mudarAbaWorkspace('tarefas');
            abrirDrawerTarefa(tarefa.id);
        });
    } else {
        abrirMeuTrabalho(() => abrirModalTarefa(tarefa.id));
    }
}
