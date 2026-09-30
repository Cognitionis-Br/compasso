// =========================================================================
// workspace-projeto/workspace-projeto.js
// Compasso 2.0 — Release 2 (Workspace Colaborativo do Projeto).
// Tela nova, SEPARADA de js/projeto-detalhe/projeto-detalhe.js (que
// continua sendo a visão de governança/financeiro, inalterada) — o
// Workspace é o "dia a dia" do projeto: stepper de fase + abas Visão
// Geral / Tarefas / Calendário / Documentos / Histórico, cada uma
// carregada sob demanda (só ao clicar a aba, então uma falha numa aba
// não derruba as outras — "blocos carregam de forma independente").
//
// Aba Tarefas reaproveita renderListaDeTarefas/renderKanbanDeTarefas de
// js/meu-trabalho/meu-trabalho.js, só filtrando por projeto_codigo em vez
// de "minhas tarefas" — mesmo motor de RPC/concorrência do Release 1.
// =========================================================================

// Release 3: +cronograma, +financeiro, +raid.
// Fase 1 (D-11 SCR-03): estrutura por grupos — Etapas + Controle + Registro.
// Legacy (tarefas/calendario/documentos): mantidas em WS_ABAS para que
// sessionStorage antigo e deep-links continuem funcionando; omitidas da
// barra visual (renderizada dinamicamente em _wsRenderAbaBotoes).
const WS_ABAS = [
    'visao_geral', 'equipe',
    'etapa_requerimentos', 'etapa_especificacao', 'etapa_execucao',
    'etapa_uat', 'etapa_golive', 'etapa_encerramento',
    'cronograma', 'financeiro', 'contratos', 'raid', 'governanca_proj',
    'historico',
    'tarefas', 'calendario', 'documentos',  // legacy — ocultas na UI
];
const WS_ABA_LABELS = {
    visao_geral:          'Visão Geral',
    equipe:               'Equipe',
    etapa_requerimentos:  'Requerimentos',
    etapa_especificacao:  'Especificação',
    etapa_execucao:       'Execução',
    etapa_uat:            'UAT',
    etapa_golive:         'Go Live',
    etapa_encerramento:   'Encerramento',
    cronograma:           'Cronograma',
    financeiro:           'Financeiro',
    contratos:            'Contratos',
    raid:                 'RAID',
    governanca_proj:      'Governança',
    historico:            'Histórico',
    tarefas:              'Tarefas',
    calendario:           'Calendário',
    documentos:           'Documentos',
};

let _wsProjetoAtual = null;
let _wsAbaAtual = 'visao_geral';
let _wsOrigemTab = null; // V72 — aba de onde o usuário veio antes de entrar no Workspace
let _wsCarregado = {};
let _wsTarefas = [];
let _wsView = 'lista';
let _wsAcaoPendente = null; // ver abrirWorkspaceProjeto — usado por notificações pra abrir direto numa tarefa

// `acaoPendente` (opcional): função async rodada depois que o Workspace
// termina de renderizar a Visão Geral — usado pra deep-link (ex.: clicar
// numa notificação de menção e cair direto na aba Tarefas com o Drawer
// já aberto na tarefa certa), sem precisar duplicar a lógica de
// carregamento aqui.
function abrirWorkspaceProjeto(codigo, acaoPendente) {
    _wsOrigemTab = (typeof abaAtualId !== 'undefined' && abaAtualId && abaAtualId !== 'workspace_projeto') ? abaAtualId : (_wsOrigemTab || 'meus_projetos'); // V72
    _wsProjetoAtual = codigo;
    try { const p = (projectsData || []).find(x => x.codigo === codigo); document.title = 'Compasso — ' + (p ? p.nome : codigo); } catch(e) {} // V70
    let _savedAba = null; // V68 — recordar última aba visitada por projeto
    if (!acaoPendente) { try { _savedAba = sessionStorage.getItem(`compassoWsAba_${codigo}`); } catch(e) {} }
    _wsAbaAtual = (_savedAba && WS_ABAS.includes(_savedAba)) ? _savedAba : 'visao_geral';
    _wsCarregado = {};
    _wsAcaoPendente = acaoPendente || null;
    switchTab('workspace_projeto');
    if (typeof routerPush === 'function') routerPush('workspace_projeto', { id: codigo });
}

async function renderWorkspaceProjeto() {
    const projeto = (typeof projectsData !== 'undefined') ? projectsData.find(p => p.codigo === _wsProjetoAtual) : null;
    if (!projeto) return alert('Projeto não encontrado. Volte a Meus Projetos e tente de novo.');

    document.getElementById('wsCodigoNomeDisplay').innerText = `${projeto.codigo} — ${projeto.nome || ''}`;
    _wsRenderStepper(projeto);
    _wsRenderAbaBotoes();
    await mudarAbaWorkspace('visao_geral');

    if (_wsAcaoPendente) {
        const acao = _wsAcaoPendente;
        _wsAcaoPendente = null;
        await acao();
    }
}

function voltarDoWorkspace() {
    switchTab(_wsOrigemTab || 'meus_projetos'); // V72 — retorna à aba de origem
}

// -------------------------------------------------------------------------
// Stepper — primeiro componente do tipo no app. Reaproveita DASH_FASES +
// dashFaseKeyRaw (js/dashboards/dashboard-filtro.js), que já normalizam
// etapa_atual pro conjunto fixo de 7 fases — evita reinventar esse mapa.
// -------------------------------------------------------------------------
function _wsRenderStepper(projeto) {
    const wrapper = document.getElementById('wsStepper');
    if (!wrapper) return;
    const fases = (typeof DASH_FASES !== 'undefined') ? DASH_FASES : [];
    const atual = (typeof dashFaseKeyRaw === 'function') ? dashFaseKeyRaw(projeto.etapa_atual) : null;
    const idxAtual = fases.findIndex(f => f.k === atual);

    const pedacos = [];
    fases.forEach((f, i) => {
        if (i > 0) {
            pedacos.push(`<div class="flex-1 h-0.5 mt-3 ${i <= idxAtual ? 'bg-indigo-700' : 'bg-gray-200'}"></div>`);
        }
        const concluida = i < idxAtual, corrente = i === idxAtual;
        pedacos.push(`
            <div class="flex flex-col items-center px-1 flex-shrink-0">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${concluida ? 'bg-indigo-700 border-indigo-700 text-white' : (corrente ? 'border-indigo-700 text-indigo-700' : 'border-gray-300 text-gray-300')}">
                    ${concluida ? '<i class="fa-solid fa-check text-[9px]"></i>' : (i + 1)}
                </div>
                <span class="text-[9px] font-bold mt-1 text-center whitespace-nowrap ${corrente ? 'text-indigo-700' : 'text-gray-400'}">${escapeHtml(f.l)}</span>
            </div>
        `);
    });
    wrapper.innerHTML = pedacos.join('');
}

function _wsRenderAbaBotoes() {
    const bar = document.getElementById('wsAbaBar');
    if (!bar) return;

    const btnCls = (a) => {
        const ativo = _wsAbaAtual === a;
        return `px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ` +
               (ativo ? 'border-indigo-700 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800');
    };
    const btn = (a) =>
        `<button id="wsBtnAba_${a}" onclick="mudarAbaWorkspace('${a}')" class="${btnCls(a)}">${WS_ABA_LABELS[a]}</button>`;
    const sep = (l) =>
        `<span class="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400 border-b-2 border-transparent self-end pb-2 shrink-0">${l}</span>`;

    bar.innerHTML =
        btn('visao_geral') +
        btn('equipe') +
        sep('Etapas') +
        btn('etapa_requerimentos') + btn('etapa_especificacao') + btn('etapa_execucao') +
        btn('etapa_uat') + btn('etapa_golive') + btn('etapa_encerramento') +
        sep('Controle') +
        btn('cronograma') + btn('financeiro') + btn('contratos') + btn('raid') + btn('governanca_proj') +
        sep('Registro') +
        btn('historico');
}

async function mudarAbaWorkspace(aba) {
    _wsAbaAtual = aba;
    try { if (_wsProjetoAtual) sessionStorage.setItem(`compassoWsAba_${_wsProjetoAtual}`, aba); } catch(e) {} // V68
    try { const p = (projectsData || []).find(x => x.codigo === _wsProjetoAtual); const abaLabel = WS_ABA_LABELS[aba] || aba; document.title = p ? `Compasso — ${p.nome} / ${abaLabel}` : 'Compasso'; } catch(e) {} // V71
    WS_ABAS.forEach(a => {
        const painel = document.getElementById(`wsAba_${a}`);
        if (painel) painel.classList.toggle('hidden', a !== aba);
        const btn = document.getElementById(`wsBtnAba_${a}`);
        if (btn) {
            btn.classList.toggle('border-indigo-700', a === aba);
            btn.classList.toggle('text-indigo-700', a === aba);
            btn.classList.toggle('text-gray-500', a !== aba);
            btn.classList.toggle('border-transparent', a !== aba);
        }
    });

    if (_wsCarregado[aba]) return; // cada aba só carrega uma vez por abertura do workspace
    _wsCarregado[aba] = true;

    if (aba === 'visao_geral') await _wsRenderVisaoGeral();
    if (aba === 'equipe' && typeof renderEquipeProjeto === 'function') await renderEquipeProjeto(_wsProjetoAtual, 'wsEquipeBody');
    else if (aba === 'equipe') _wsRenderAbaStub('wsEquipeBody', 'Equipe', 'fa-users');
    if (['etapa_requerimentos','etapa_especificacao','etapa_execucao','etapa_uat','etapa_golive','etapa_encerramento'].includes(aba)) {
        if (typeof renderEtapaProjeto === 'function') await renderEtapaProjeto(_wsProjetoAtual, aba, 'wsEtapaBody_' + aba);
        else _wsRenderAbaStub('wsEtapaBody_' + aba, WS_ABA_LABELS[aba], 'fa-diagram-project');
    }
    if (aba === 'tarefas') await _wsCarregarTarefas();
    if (aba === 'cronograma' && typeof renderCronogramaProjeto === 'function') await renderCronogramaProjeto(_wsProjetoAtual, 'wsCronogramaBody');
    if (aba === 'financeiro' && typeof renderFinanceiroProjeto === 'function') await renderFinanceiroProjeto(_wsProjetoAtual, 'wsFinanceiroBody');
    if (aba === 'contratos') {
        if (typeof renderContratosWorkspace === 'function') await renderContratosWorkspace(_wsProjetoAtual, 'wsContratosBody');
        else _wsRenderAbaStub('wsContratosBody', 'Contratos', 'fa-file-signature');
    }
    if (aba === 'raid' && typeof renderRaidProjeto === 'function') await renderRaidProjeto(_wsProjetoAtual, 'wsRaidBody');
    if (aba === 'governanca_proj') {
        if (typeof renderGovernancaWorkspace === 'function') await renderGovernancaWorkspace(_wsProjetoAtual, 'wsGovernancaBody');
        else _wsRenderAbaStub('wsGovernancaBody', 'Governança', 'fa-gavel');
    }
    if (aba === 'calendario' && typeof renderCalendarioProjeto === 'function') await renderCalendarioProjeto(_wsProjetoAtual, 'wsCalendarioBody');
    if (aba === 'documentos' && typeof renderDocumentosProjeto === 'function') await renderDocumentosProjeto(_wsProjetoAtual, 'wsDocumentosBody');
    if (aba === 'historico' && typeof renderHistoricoProjeto === 'function') await renderHistoricoProjeto(_wsProjetoAtual, 'wsHistoricoBody');
}

// Stub para abas ainda não implementadas (Fase 2+)
function _wsRenderAbaStub(bodyId, label, icon) {
    const el = document.getElementById(bodyId);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
            <i class="fa-solid ${icon} text-3xl text-gray-300 mb-4"></i>
            <h3 class="text-sm font-bold text-gray-500">${escapeHtml(label)}</h3>
            <p class="text-xs text-gray-400 mt-1">Em desenvolvimento — disponível nas próximas fases.</p>
        </div>`;
}

// -------------------------------------------------------------------------
// Aba Visão Geral — resumo leve (não duplica o Detalhe Completo).
// -------------------------------------------------------------------------
async function _wsRenderVisaoGeral() {
    const wrapper = document.getElementById('wsVisaoGeralBody');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const projeto = projectsData.find(p => p.codigo === _wsProjetoAtual);
    const [etapasResp, tarefasResp] = await Promise.all([
        _supabase.from('projeto_etapas').select('*').eq('projeto_codigo', _wsProjetoAtual),
        _supabase.from('tasks').select('id, status').eq('projeto_codigo', _wsProjetoAtual)
    ]);
    const etapas = etapasResp.data || [];
    const tarefas = tarefasResp.data || [];
    const etapaCorrente = etapas.find(e => (e.situacao || '').startsWith('EXECUCAO')) || etapas[etapas.length - 1];
    const saude = (typeof calcularSaudeProjeto === 'function') ? calcularSaudeProjeto(projeto, etapas) : null;
    const abertas = tarefas.filter(t => t.status !== 'CONCLUIDO').length;
    const btnTarefas = document.getElementById('wsBtnAba_tarefas'); // V73 — badge de tarefas abertas
    if (btnTarefas) btnTarefas.innerText = abertas > 0 ? `Tarefas (${abertas})` : 'Tarefas';

    wrapper.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Saúde</div>
                ${saude ? saude.html : '-'}
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Etapa Atual</div>
                <div class="text-sm font-bold text-gray-800">${escapeHtml((etapaCorrente && etapaCorrente.etapa) || projeto.etapa_atual || '-')}</div>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Prazo da Etapa</div>
                <div class="text-sm font-bold text-gray-800">${etapaCorrente && etapaCorrente.data_termino_planejamento ? formatDate(etapaCorrente.data_termino_planejamento) : '-'}</div>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-indigo-300" onclick="mudarAbaWorkspace('tarefas')">
                <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Tarefas Abertas</div>
                <div class="text-2xl font-black text-gray-800">${abertas}</div>
            </div>
        </div>
        <button onclick="abrirDetalheProjeto('${_wsProjetoAtual}', 'workspace')" class="text-xs font-bold text-indigo-700 hover:text-indigo-900"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Detalhes Completos (Financeiro/Governança)</button>
    `;
}

// -------------------------------------------------------------------------
// Aba Tarefas — reaproveita o motor do Release 1 (meu-trabalho.js),
// filtrado por projeto em vez de "minhas".
// -------------------------------------------------------------------------
async function _wsCarregarTarefas() {
    const { data, error } = await _supabase.from('tasks').select('*').eq('projeto_codigo', _wsProjetoAtual).order('prazo', { ascending: true, nullsFirst: false });
    if (error) return alert('Erro ao carregar tarefas do projeto: ' + error.message);
    _wsTarefas = data || [];
    _wsRenderTarefas();
}

function _wsRenderTarefas() {
    document.getElementById('wsTarefasListaContainer').classList.toggle('hidden', _wsView !== 'lista');
    document.getElementById('wsTarefasKanbanContainer').classList.toggle('hidden', _wsView !== 'kanban');
    if (_wsView === 'lista') {
        renderListaDeTarefas(_wsTarefas, 'wsTarefasListaBody', _wsCarregarTarefas, 'abrirDrawerTarefa');
    } else {
        renderKanbanDeTarefas(_wsTarefas, 'wsTarefasKanbanBody', _wsCarregarTarefas, 'abrirDrawerTarefa');
    }
}

function mudarViewWorkspaceTarefas(view) {
    _wsView = view;
    ['lista', 'kanban'].forEach(v => {
        const btn = document.getElementById(`wsBtnViewTarefas_${v}`);
        if (!btn) return;
        btn.classList.toggle('bg-indigo-700', v === _wsView);
        btn.classList.toggle('text-white', v === _wsView);
        btn.classList.toggle('text-gray-600', v !== _wsView);
    });
    _wsRenderTarefas();
}

function abrirModalNovaTarefaWorkspace() {
    abrirModalNovaTarefa(_wsProjetoAtual, _wsCarregarTarefas);
}
