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
    const primeiroNome = (currentUser && currentUser.nome) ? currentUser.nome.split(' ')[0] : '';
    const saudacao = document.getElementById('homeSaudacao');
    if (saudacao) saudacao.innerText = `Olá, ${(currentUser && currentUser.nome) ? currentUser.nome : ''}`;
    const areaEl = document.getElementById('homeAreaUsuario');
    if (areaEl) areaEl.innerText = (currentUser && currentUser.area) ? currentUser.area : '';
    const avatarEl = document.getElementById('homeAvatarUsuario');
    if (avatarEl) {
        const base = (currentUser && (currentUser.nome || currentUser.email)) || '??';
        const partes = base.trim().split(/\s+/);
        avatarEl.innerText = (partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : base.substring(0, 2)).toUpperCase();
    }
    const dataHoje = document.getElementById('homeDataHoje');
    if (dataHoje) dataHoje.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const [tarefasResp] = await Promise.all([
        _supabase.from('tasks').select('*').neq('status', 'CONCLUIDO').order('prazo', { ascending: true, nullsFirst: false })
    ]);

    _homeTarefas = tarefasResp.data || [];

    const meusProjetos = (typeof filtrarProjetosPorArea === 'function' && typeof projectsData !== 'undefined')
        ? filtrarProjetosPorArea(projectsData.filter(p => !p.is_subprojeto), 'meus_projetos')
        : [];

    _renderHomeMetricCardsEStatus(meusProjetos);
    _renderHomeMeusProjetos(meusProjetos);
    mudarAbaHomeTarefas(_homeAbaTarefas);
    await _renderHomeAtividadeRecente();
    await _renderHomeProximosCompromissos();
    await _renderHomeEntregasMes();
}

// Estrutura de topo (SCR-02, 2026-09-25): 4 KPIs (Projetos/Em Atenção/
// Atrasados/Concluídos) + donut "Distribuição por Status" — os dois
// vindos da MESMA classificação real já usada em Meus Projetos e no
// Dashboard (calcularSaudeProjeto), sem inventar categoria nova.
function _renderHomeMetricCardsEStatus(meusProjetos) {
    const contagem = { SAUDAVEL: 0, ATENCAO: 0, CRITICO: 0, HOLD: 0, INATIVO: 0, CONCLUIDO: 0 };
    meusProjetos.forEach(p => {
        if ((p.etapa_atual || '').toUpperCase() === 'CONCLUIDO') { contagem.CONCLUIDO++; return; }
        const status = (typeof calcularSaudeProjeto === 'function') ? calcularSaudeProjeto(p, []).status : 'SAUDAVEL';
        contagem[status] = (contagem[status] || 0) + 1;
    });

    const wrapper = document.getElementById('homeMetricCards');
    if (wrapper) {
        const cards = [
            { label: 'Projetos', valor: meusProjetos.length, icone: 'fa-diagram-project', cor: 'text-gray-800', bg: 'bg-gray-100', acao: "switchTab('meus_projetos')" },
            { label: 'Em Atenção', valor: contagem.ATENCAO, icone: 'fa-triangle-exclamation', cor: 'text-amber-600', bg: 'bg-amber-50', acao: "switchTab('meus_projetos')" },
            { label: 'Atrasados', valor: contagem.CRITICO, icone: 'fa-circle-exclamation', cor: 'text-danger-600', bg: 'bg-danger-50', acao: "switchTab('meus_projetos')" },
            { label: 'Concluídos', valor: contagem.CONCLUIDO, icone: 'fa-circle-check', cor: 'text-emerald-600', bg: 'bg-emerald-50', acao: "switchTab('meus_projetos')" }
        ];
        wrapper.innerHTML = cards.map(c => `
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-indigo-200 transition" onclick="${c.acao}">
                <div class="text-2xl font-black ${c.cor} leading-none">${c.valor}</div>
                <div class="text-[11px] font-bold text-gray-400 mt-1">${c.label}</div>
            </div>
        `).join('');
    }

    _renderHomeDonutStatus(contagem);
}

// Donut hand-rolled em SVG (stroke-dasharray) — mesmo princípio das
// barras HTML já usadas em js/dashboards/dashboard-resumo.js (sem lib de
// gráfico), só que em anel por ser isso que a referência mostra.
function _renderHomeDonutStatus(contagem) {
    const wrapper = document.getElementById('homeDistribuicaoStatus');
    if (!wrapper) return;
    const segmentos = [
        { chave: 'SAUDAVEL', rotulo: 'Saudável', cor: '#10b981' },
        { chave: 'ATENCAO', rotulo: 'Atenção', cor: '#f59e0b' },
        { chave: 'CRITICO', rotulo: 'Atrasado', cor: '#dc2626' },
        { chave: 'HOLD', rotulo: 'Em Hold', cor: '#94a3b8' },
        { chave: 'CONCLUIDO', rotulo: 'Concluído', cor: '#4338ca' },
        { chave: 'INATIVO', rotulo: 'Inativo', cor: '#d1d5db' }
    ].map(s => ({ ...s, n: contagem[s.chave] || 0 })).filter(s => s.n > 0);

    const total = segmentos.reduce((acc, s) => acc + s.n, 0);
    if (total === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhum projeto no seu escopo.</p>';
        return;
    }

    const R = 40, C = 2 * Math.PI * R;
    let acumulado = 0;
    const arcos = segmentos.map(s => {
        const frac = s.n / total;
        const dash = frac * C;
        const offset = -acumulado * C;
        acumulado += frac;
        return `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${s.cor}" stroke-width="14" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"></circle>`;
    }).join('');

    wrapper.innerHTML = `
        <div class="flex items-center gap-5">
            <svg viewBox="0 0 100 100" class="w-28 h-28 flex-shrink-0">
                ${arcos}
                <text x="50" y="54" text-anchor="middle" class="fill-gray-800" style="font-size:20px; font-weight:800;">${total}</text>
            </svg>
            <div class="flex flex-col gap-1.5 text-[11px]">
                ${segmentos.map(s => `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${s.cor}"></span>${s.rotulo} <b class="tabular-nums ml-auto">${s.n}</b></span>`).join('')}
            </div>
        </div>`;
}

// Entregas do mês — tasks concluídas (tasks.concluido_em) nos últimos 6
// meses, escopo do usuário (mesma regra de Meu Trabalho). Barras HTML,
// mesmo padrão hand-rolled do resto do dashboard.
async function _renderHomeEntregasMes() {
    const wrapper = document.getElementById('homeEntregasMes');
    if (!wrapper || !currentUser) return;

    const inicio = new Date();
    inicio.setMonth(inicio.getMonth() - 5, 1);
    inicio.setHours(0, 0, 0, 0);

    const { data } = await _supabase.from('tasks').select('concluido_em')
        .or(`assigned_user_id.eq.${currentUser.id},criado_por.eq.${currentUser.id}`)
        .not('concluido_em', 'is', null)
        .gte('concluido_em', inicio.toISOString());

    const meses = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        meses.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), n: 0 });
    }
    (data || []).forEach(t => {
        const d = new Date(t.concluido_em);
        const chave = `${d.getFullYear()}-${d.getMonth()}`;
        const m = meses.find(x => x.chave === chave);
        if (m) m.n++;
    });

    const max = Math.max(...meses.map(m => m.n), 1);
    wrapper.innerHTML = `
        <div class="flex items-end justify-between gap-2 h-32">
            ${meses.map(m => `
                <div class="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div class="text-[10px] font-bold text-gray-500">${m.n || ''}</div>
                    <div class="w-full bg-indigo-500 rounded-t" style="height:${Math.max((m.n / max) * 100, m.n > 0 ? 6 : 2)}%"></div>
                    <div class="text-[10px] font-bold uppercase text-gray-400">${m.rotulo}</div>
                </div>
            `).join('')}
        </div>`;
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
