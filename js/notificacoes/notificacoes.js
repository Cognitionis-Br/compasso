// =========================================================================
// notificacoes/notificacoes.js
// Compasso 2.0 — Release 1, tela R1-UX05 (Notificações). Central de
// alertas in-app — backed pela tabela `notifications` (RLS por
// destinatário, sql/2026-09-23_r1_fundacao_trabalho_pessoal.sql). É
// paralela à fila de e-mail existente (js/email-gestao/) — não a
// substitui, é um canal a mais.
// =========================================================================

async function atualizarContadorNotificacoes() {
    const badge = document.getElementById('notifSinoContador');
    if (!badge || !currentUser || !currentUser.id) return;
    const { count } = await _supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_user_id', currentUser.id)
        .is('lida_em', null);
    if (count > 0) {
        badge.innerText = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

let _notificacoesCache = {}; // id -> notificação, alimenta _notifAbrirELer

async function renderNotificacoesView() {
    const wrapper = document.getElementById('notificacoesLista');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const { data, error } = await _supabase
        .from('notifications')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(100);
    if (error) { wrapper.innerHTML = `<p class="text-xs text-danger-600 py-4 text-center">Erro ao carregar: ${escapeHtml(error.message)}</p>`; return; }

    const notificacoes = data || [];
    _notificacoesCache = Object.fromEntries(notificacoes.map(n => [n.id, n]));
    if (notificacoes.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhuma notificação por aqui ainda.</p>';
        return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    const grupos = {
        'Não lidas': notificacoes.filter(n => !n.lida_em),
        'Hoje': notificacoes.filter(n => n.lida_em && n.criado_em.split('T')[0] === hoje),
        'Anteriores': notificacoes.filter(n => n.lida_em && n.criado_em.split('T')[0] !== hoje)
    };

    wrapper.innerHTML = Object.entries(grupos).filter(([, lista]) => lista.length > 0).map(([titulo, lista]) => `
        <div class="mb-4">
            <h4 class="text-[10px] font-black uppercase text-gray-400 mb-1.5">${titulo} (${lista.length})</h4>
            <div class="space-y-1.5">
                ${lista.map(n => {
                    const clicavel = !!(n.link_task_id || n.link_tab);
                    return `
                    <div class="flex items-start justify-between p-2.5 rounded border ${n.lida_em ? 'border-gray-100 bg-white' : 'border-indigo-200 bg-indigo-50'} ${clicavel ? 'cursor-pointer hover:bg-gray-50' : ''}"
                         ${clicavel ? `onclick="_notifAbrirELer(${n.id})"` : ''}>
                        <div class="min-w-0">
                            <div class="text-xs font-bold text-gray-800">${escapeHtml(n.titulo)}</div>
                            <div class="text-[10px] text-gray-400 mt-0.5">${formatDateTime(n.criado_em)}</div>
                        </div>
                        ${!n.lida_em ? `<button onclick="event.stopPropagation(); marcarNotificacaoLida(${n.id})" class="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex-shrink-0 ml-2">Marcar lida</button>` : ''}
                    </div>
                `;}).join('')}
            </div>
        </div>
    `).join('');
}

async function marcarNotificacaoLida(id) {
    await _supabase.rpc('fn_marcar_notificacao_lida', { p_notification_id: id });
    await Promise.all([renderNotificacoesView(), atualizarContadorNotificacoes()]);
}

// CORRIGIDO (a pedido do usuário): antes só fazia switchTab(link_tab) —
// pra menção isso caía sempre em "Meu Trabalho" genérico, sem nunca abrir
// a tarefa/comentário de verdade. Agora usa link_task_id
// (sql/2026-09-23_fix_notificacao_link_tarefa.sql) pra abrir direto no
// Workspace do projeto (aba Tarefas + Drawer already aberto) ou, se a
// tarefa não tiver projeto, no modal simples de Meu Trabalho.
async function _notifAbrirELer(id) {
    const notif = _notificacoesCache[id];
    await _supabase.rpc('fn_marcar_notificacao_lida', { p_notification_id: id });
    await atualizarContadorNotificacoes();
    if (!notif) return;

    if (notif.link_task_id) {
        let tarefa = _tarefasCache[notif.link_task_id];
        if (!tarefa) {
            const { data } = await _supabase.from('tasks').select('*').eq('id', notif.link_task_id).maybeSingle();
            tarefa = data;
            if (tarefa) _tarefasCache[tarefa.id] = tarefa;
        }
        if (tarefa && tarefa.projeto_codigo) {
            abrirWorkspaceProjeto(tarefa.projeto_codigo, async () => {
                await mudarAbaWorkspace('tarefas');
                abrirDrawerTarefa(tarefa.id);
            });
            return;
        }
        if (tarefa) {
            abrirMeuTrabalho(() => abrirModalTarefa(tarefa.id));
            return;
        }
    }
    if (notif.link_tab) switchTab(notif.link_tab);
}

async function marcarTodasNotificacoesLidas() {
    await _supabase.rpc('fn_marcar_todas_notificacoes_lidas');
    await Promise.all([renderNotificacoesView(), atualizarContadorNotificacoes()]);
}
