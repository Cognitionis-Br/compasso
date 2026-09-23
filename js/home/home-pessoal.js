// =========================================================================
// home/home-pessoal.js
// Compasso 2.0 — Home pessoal (tela R1-UX01). AJUSTADO (padronização
// visual, 2026-09-23): layout comparado direto contra SCR-001 do pacote
// (docs/revisao telas/10_Assets_Visuais.zip) — saudação + 5 KPIs,
// Projetos em Destaque, Minhas Tarefas (abas Hoje/Atraso/Próximas),
// Atividade Recente, Próximos Compromissos. Todo dado é real — nenhuma
// métrica do mock sem fonte já existente foi inventada (ver plano
// "Padronização Visual — Casca + Início" pra detalhes de cada uma).
//
// Tarefas vêm de `tasks` (Release 1). RAID de `raid_items` (Release 3,
// RLS via fn_usuario_tem_acesso_projeto já limita ao escopo do usuário).
// "Decisões Pendentes" reaproveita obterMinhasAprovacoes()
// (js/aprovacoes/minhas-aprovacoes.js, Release 3/4) — mesma função da
// tela Minhas Aprovações, sem duplicar os 5 filtros.
// =========================================================================

let _homeTarefas = [];
let _homeAbaTarefas = 'hoje';

async function renderHomePessoalView() {
    const saudacao = document.getElementById('homeSaudacao');
    if (saudacao) saudacao.innerText = `Olá, ${(currentUser && currentUser.nome) ? currentUser.nome.split(' ')[0] : ''}!`;
    const dataHoje = document.getElementById('homeDataHoje');
    if (dataHoje) dataHoje.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const [tarefasResp, raidResp, aprovacoes] = await Promise.all([
        _supabase.from('tasks').select('*').neq('status', 'CONCLUIDO').order('prazo', { ascending: true, nullsFirst: false }),
        _supabase.from('raid_items').select('id').not('status', 'in', '(RESOLVIDO,CANCELADO)'),
        (typeof obterMinhasAprovacoes === 'function') ? obterMinhasAprovacoes() : Promise.resolve([])
    ]);

    _homeTarefas = tarefasResp.data || [];
    const hoje = new Date().toISOString().split('T')[0];
    const dueToday = _homeTarefas.filter(t => t.prazo === hoje).length;
    const overdue = _homeTarefas.filter(t => t.prazo && t.prazo < hoje).length;

    const meusProjetos = (typeof filtrarProjetosPorArea === 'function' && typeof projectsData !== 'undefined')
        ? filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos')
        : [];

    let naoLidas = 0;
    if (currentUser && currentUser.id) {
        const { count } = await _supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('destinatario_user_id', currentUser.id).is('lida_em', null);
        naoLidas = count || 0;
    }

    _renderHomeMetricCards({
        meusProjetos: meusProjetos.length, minhasTarefas: _homeTarefas.length,
        riscosAtivos: (raidResp.data || []).length, decisoesPendentes: aprovacoes.length, naoLidas
    });
    _renderHomeMeusProjetos(meusProjetos);
    mudarAbaHomeTarefas(_homeAbaTarefas);
    await _renderHomeAtividadeRecente();
    await _renderHomeProximosCompromissos();
}

function _renderHomeMetricCards({ meusProjetos, minhasTarefas, riscosAtivos, decisoesPendentes, naoLidas }) {
    const wrapper = document.getElementById('homeMetricCards');
    if (!wrapper) return;
    const cards = [
        { label: 'Meus Projetos', valor: meusProjetos, icone: 'fa-diagram-project', cor: 'text-indigo-600', bg: 'bg-indigo-50', acao: "switchTab('meus_projetos')" },
        { label: 'Minhas Tarefas', valor: minhasTarefas, icone: 'fa-list-check', cor: 'text-blue-600', bg: 'bg-blue-50', acao: "switchTab('meu_trabalho')" },
        { label: 'Riscos Ativos', valor: riscosAtivos, icone: 'fa-triangle-exclamation', cor: riscosAtivos > 0 ? 'text-amber-600' : 'text-gray-500', bg: 'bg-amber-50', acao: '' },
        { label: 'Decisões Pendentes', valor: decisoesPendentes, icone: 'fa-stamp', cor: decisoesPendentes > 0 ? 'text-danger-600' : 'text-gray-500', bg: 'bg-danger-50', acao: "switchTab('minhas_aprovacoes')" },
        { label: 'Não Lidas', valor: naoLidas, icone: 'fa-bell', cor: naoLidas > 0 ? 'text-indigo-600' : 'text-gray-500', bg: 'bg-indigo-50', acao: "switchTab('notificacoes')" }
    ];
    wrapper.innerHTML = cards.map(c => `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${c.acao ? 'cursor-pointer hover:border-indigo-200' : ''} transition" ${c.acao ? `onclick="${c.acao}"` : ''}>
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg ${c.bg} ${c.cor} flex items-center justify-center flex-shrink-0"><i class="fa-solid ${c.icone}"></i></div>
                <div class="min-w-0">
                    <div class="text-xl font-black text-gray-900 leading-none">${c.valor}</div>
                    <div class="text-[10px] font-bold uppercase text-gray-400 mt-0.5 truncate">${c.label}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function _renderHomeMeusProjetos(meus) {
    const wrapper = document.getElementById('homeMeusProjetos');
    if (!wrapper) return;
    if (meus.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-6 text-center">Nenhum projeto no seu escopo.</p>';
        return;
    }
    wrapper.innerHTML = meus.slice(0, 5).map(p => {
        const saude = (typeof calcularSaudeProjeto === 'function') ? calcularSaudeProjeto(p, []) : null;
        return `
        <div class="flex items-center justify-between p-2.5 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="abrirWorkspaceProjeto('${p.codigo}')">
            <div class="min-w-0">
                <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(p.etapa_atual || 'Business Case')}</div>
            </div>
            ${saude ? saude.html : ''}
        </div>`;
    }).join('');
}

// Abas Hoje/Em Atraso/Próximas sobre a MESMA lista já carregada
// (_homeTarefas) — sem consulta nova a cada troca de aba.
function mudarAbaHomeTarefas(aba) {
    _homeAbaTarefas = aba;
    const hoje = new Date().toISOString().split('T')[0];
    const rotulos = { hoje: 'Hoje', atraso: 'Em Atraso', proximas: 'Próximas' };
    ['hoje', 'atraso', 'proximas'].forEach(a => {
        const btn = document.getElementById(`homeAbaTarefas_${a}`);
        if (!btn) return;
        btn.innerText = rotulos[a];
        btn.classList.toggle('border-indigo-600', a === aba);
        btn.classList.toggle('text-indigo-700', a === aba);
        btn.classList.toggle('border-transparent', a !== aba);
        btn.classList.toggle('text-gray-400', a !== aba);
    });

    let filtradas;
    if (aba === 'hoje') filtradas = _homeTarefas.filter(t => t.prazo === hoje);
    else if (aba === 'atraso') filtradas = _homeTarefas.filter(t => t.prazo && t.prazo < hoje);
    else filtradas = _homeTarefas.filter(t => !t.prazo || t.prazo > hoje);

    const wrapper = document.getElementById('homePrioridades');
    if (!wrapper) return;
    if (filtradas.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-6 text-center">Nada por aqui.</p>';
        return;
    }
    wrapper.innerHTML = filtradas.slice(0, 5).map(t => `
        <div class="flex items-center justify-between p-2.5 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="switchTab('meu_trabalho')">
            <div class="min-w-0">
                <div class="text-xs font-bold text-gray-800 truncate">${escapeHtml(t.titulo)}</div>
                <div class="text-[10px] text-gray-400">${t.projeto_codigo ? escapeHtml(t.projeto_codigo) + ' · ' : ''}${t.prazo ? formatDate(t.prazo) : 'Sem prazo'}</div>
            </div>
            ${renderBadgeStatus(t.prioridade === 'ALTA' ? 'danger' : (t.prioridade === 'MEDIA' ? 'amber' : 'gray'), 'fa-flag', t.prioridade)}
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
        .limit(6);
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

// Próximos prazos reais (tarefas + etapas onde o usuário é responsável) —
// sem widget de calendário novo (isso já existe na aba Calendário do
// Workspace, Release 2); aqui é só uma lista simples ordenada por data.
async function _renderHomeProximosCompromissos() {
    const wrapper = document.getElementById('homeProximosCompromissos');
    if (!wrapper) return;
    const hoje = new Date().toISOString().split('T')[0];

    const { data: etapasProprias } = (currentUser && currentUser.email)
        ? await _supabase.from('projeto_etapas').select('projeto_codigo, etapa, data_termino_planejamento').ilike('responsavel_etapa_email', currentUser.email).gte('data_termino_planejamento', hoje)
        : { data: [] };

    const compromissos = [
        ..._homeTarefas.filter(t => t.prazo && t.prazo >= hoje).map(t => ({ data: t.prazo, texto: t.titulo, sub: t.projeto_codigo || 'Pessoal', icone: 'fa-list-check' })),
        ...(etapasProprias || []).map(e => ({ data: e.data_termino_planejamento, texto: e.etapa, sub: e.projeto_codigo, icone: 'fa-flag-checkered' }))
    ].sort((a, b) => new Date(a.data) - new Date(b.data)).slice(0, 6);

    if (compromissos.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhum compromisso próximo.</p>';
        return;
    }
    wrapper.innerHTML = compromissos.map(c => `
        <div class="flex items-center gap-3 text-xs border-b border-gray-50 pb-1.5">
            <div class="w-8 text-center flex-shrink-0">
                <div class="text-[9px] font-bold uppercase text-gray-400">${new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                <div class="text-sm font-black text-gray-700">${new Date(c.data + 'T00:00:00').getDate()}</div>
            </div>
            <i class="fa-solid ${c.icone} text-gray-300"></i>
            <div class="min-w-0 flex-1">
                <div class="font-bold text-gray-700 truncate">${escapeHtml(c.texto)}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(c.sub)}</div>
            </div>
        </div>
    `).join('');
}
