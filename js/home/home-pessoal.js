// =========================================================================
// home/home-pessoal.js
// Compasso 2.0 — Release 1 (Fundação e Trabalho Pessoal), tela R1-UX01
// (Home). Substitui o antigo placeholder estático de #view-home por um
// resumo pessoal: KPIs, prioridades (tasks), meus projetos e atividade
// recente — ver o plano "Compasso 2.0 — Release 1".
//
// Tarefas vêm da tabela `tasks` (Release 1, RLS por dono — ver
// sql/2026-09-23_r1_fundacao_trabalho_pessoal.sql). "Aprovações
// pendentes" reaproveita o motor de etapas existente (fases_etapas +
// projeto_etapas + usuarioTemAtividade), sem tabela nova: uma etapa conta
// como pendência quando exige decisão, já chegou a 100% de evolução, não
// tem decisão registrada, e o usuário logado tem a atividade de aprovação
// correspondente (o nome da atividade é o próprio nome da etapa, ex.
// "APROVAR REQUERIMENTOS TI").
// =========================================================================

async function renderHomePessoalView() {
    const saudacao = document.getElementById('homeSaudacao');
    if (saudacao) saudacao.innerText = `Olá, ${(currentUser && currentUser.nome) ? currentUser.nome.split(' ')[0] : ''}`;

    const [tarefasResp, etapasDecisaoResp] = await Promise.all([
        _supabase.from('tasks').select('*').neq('status', 'CONCLUIDO').order('prazo', { ascending: true, nullsFirst: false }),
        _supabase.from('fases_etapas').select('etapa').eq('requer_decisao_aprovacao', true)
    ]);

    const tarefas = tarefasResp.data || [];
    const hoje = new Date().toISOString().split('T')[0];
    const dueToday = tarefas.filter(t => t.prazo === hoje).length;
    const overdue = tarefas.filter(t => t.prazo && t.prazo < hoje).length;

    let pendingApprovals = 0;
    const etapasComDecisao = (etapasDecisaoResp.data || []).map(e => e.etapa);
    if (etapasComDecisao.length > 0) {
        const { data: etapasPendentes } = await _supabase
            .from('projeto_etapas')
            .select('projeto_codigo, etapa')
            .in('etapa', etapasComDecisao)
            .eq('percentual_evolucao', 100)
            .is('decisao_resultado', null);
        pendingApprovals = (etapasPendentes || []).filter(e =>
            ehAdministrador || ehProprietario || (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade(e.etapa))
        ).length;
    }

    _renderHomeMetricCards({ openTasks: tarefas.length, dueToday, overdue, pendingApprovals });
    _renderHomePrioridades(tarefas.slice(0, 5));
    _renderHomeMeusProjetos();
    await _renderHomeAtividadeRecente();
}

function _renderHomeMetricCards({ openTasks, dueToday, overdue, pendingApprovals }) {
    const wrapper = document.getElementById('homeMetricCards');
    if (!wrapper) return;
    const cards = [
        { label: 'Tarefas Abertas', valor: openTasks, icone: 'fa-list-check', cor: 'text-gray-700', acao: "switchTab('meu_trabalho')" },
        { label: 'Vencem Hoje', valor: dueToday, icone: 'fa-calendar-day', cor: dueToday > 0 ? 'text-amber-600' : 'text-gray-700', acao: "switchTab('meu_trabalho')" },
        { label: 'Atrasadas', valor: overdue, icone: 'fa-triangle-exclamation', cor: overdue > 0 ? 'text-danger-700' : 'text-gray-700', acao: "switchTab('meu_trabalho')" },
        { label: 'Aprovações Pendentes', valor: pendingApprovals, icone: 'fa-stamp', cor: pendingApprovals > 0 ? 'text-indigo-700' : 'text-gray-700', acao: '' }
    ];
    wrapper.innerHTML = cards.map(c => `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${c.acao ? 'cursor-pointer hover:border-gray-300' : ''} transition" ${c.acao ? `onclick="${c.acao}"` : ''}>
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase text-gray-400">${c.label}</span>
                <i class="fa-solid ${c.icone} ${c.cor} text-sm"></i>
            </div>
            <div class="text-2xl font-black ${c.cor} mt-1">${c.valor}</div>
        </div>
    `).join('');
}

function _renderHomePrioridades(tarefas) {
    const wrapper = document.getElementById('homePrioridades');
    if (!wrapper) return;
    if (tarefas.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-6 text-center">Nenhuma tarefa em aberto. <button onclick="switchTab(\'meu_trabalho\')" class="text-indigo-700 font-bold hover:underline">Criar uma agora</button>.</p>';
        return;
    }
    wrapper.innerHTML = tarefas.map(t => `
        <div class="flex items-center justify-between p-2.5 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="switchTab('meu_trabalho')">
            <div class="min-w-0">
                <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(t.titulo)}</div>
                <div class="text-[10px] text-gray-400">${t.projeto_codigo ? escapeHtml(t.projeto_codigo) + ' · ' : ''}${t.prazo ? 'Prazo: ' + formatDate(t.prazo) : 'Sem prazo'}</div>
            </div>
            ${renderBadgeStatus(t.prioridade === 'ALTA' ? 'danger' : (t.prioridade === 'MEDIA' ? 'amber' : 'gray'), 'fa-flag', t.prioridade)}
        </div>
    `).join('');
}

function _renderHomeMeusProjetos() {
    const wrapper = document.getElementById('homeMeusProjetos');
    if (!wrapper) return;
    const meus = (typeof filtrarProjetosPorArea === 'function' && typeof projectsData !== 'undefined')
        ? filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos')
        : [];
    if (meus.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhum projeto no seu escopo.</p>';
        return;
    }
    wrapper.innerHTML = meus.slice(0, 6).map(p => `
        <div class="p-2 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="switchTab('meus_projetos')">
            <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</div>
            <div class="text-[10px] text-gray-400">${escapeHtml(p.etapa_atual || 'Business Case')}</div>
        </div>
    `).join('');
}

async function _renderHomeAtividadeRecente() {
    const wrapper = document.getElementById('homeAtividadeRecente');
    if (!wrapper) return;
    const { data: historico } = await _supabase
        .from('task_history')
        .select('*, tasks(titulo)')
        .order('alterado_em', { ascending: false })
        .limit(10);
    if (!historico || historico.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhuma atividade recente.</p>';
        return;
    }
    wrapper.innerHTML = historico.map(h => `
        <div class="text-xs text-gray-600 flex items-center justify-between border-b border-gray-50 pb-1.5">
            <span><b>${escapeHtml((h.tasks && h.tasks.titulo) || 'Tarefa')}</b> — ${escapeHtml(h.campo)}: ${escapeHtml(h.de_valor || '-')} → ${escapeHtml(h.para_valor || '-')}</span>
            <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${formatDateTime(h.alterado_em)}</span>
        </div>
    `).join('');
}
