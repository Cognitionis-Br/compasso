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

// Release 3: +cronograma, +financeiro, +raid (reaproveitam motores já
// existentes — ver js/workspace-projeto/cronograma-projeto.js,
// financeiro-projeto.js, raid-projeto.js).
const WS_ABAS = ['visao_geral', 'tarefas', 'cronograma', 'financeiro', 'raid', 'calendario', 'documentos', 'historico'];
const WS_ABA_LABELS = {
    visao_geral: 'Visão Geral', tarefas: 'Tarefas', cronograma: 'Cronograma', financeiro: 'Financeiro',
    raid: 'Riscos e Ocorrências', calendario: 'Calendário', documentos: 'Documentos', historico: 'Histórico'
};

let _wsProjetoAtual = null;
let _wsAbaAtual = 'visao_geral';
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
    _wsProjetoAtual = codigo;
    _wsAbaAtual = 'visao_geral';
    _wsCarregado = {};
    _wsAcaoPendente = acaoPendente || null;
    switchTab('workspace_projeto');
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
    switchTab('meus_projetos');
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
    WS_ABAS.forEach(a => {
        const btn = document.getElementById(`wsBtnAba_${a}`);
        if (btn) btn.innerText = WS_ABA_LABELS[a];
    });
}

async function mudarAbaWorkspace(aba) {
    _wsAbaAtual = aba;
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
    if (aba === 'tarefas') await _wsCarregarTarefas();
    if (aba === 'cronograma' && typeof renderCronogramaProjeto === 'function') await renderCronogramaProjeto(_wsProjetoAtual, 'wsCronogramaBody');
    if (aba === 'financeiro' && typeof renderFinanceiroProjeto === 'function') await renderFinanceiroProjeto(_wsProjetoAtual, 'wsFinanceiroBody');
    if (aba === 'raid' && typeof renderRaidProjeto === 'function') await renderRaidProjeto(_wsProjetoAtual, 'wsRaidBody');
    if (aba === 'calendario' && typeof renderCalendarioProjeto === 'function') await renderCalendarioProjeto(_wsProjetoAtual, 'wsCalendarioBody');
    if (aba === 'documentos' && typeof renderDocumentosProjeto === 'function') await renderDocumentosProjeto(_wsProjetoAtual, 'wsDocumentosBody');
    if (aba === 'historico' && typeof renderHistoricoProjeto === 'function') await renderHistoricoProjeto(_wsProjetoAtual, 'wsHistoricoBody');
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
