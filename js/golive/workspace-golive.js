// =========================================================================
// golive/workspace-golive.js
// Compasso 2.0 — Fase 6 (cap.08): workspace de Go Live (SCR-03 → SCR-12).
//
// Abas implementadas:
//   Resumo          — estado, próxima janela, banner REQUER_RATIFICACAO
//   Rollback (RF-06)— critérios definidos antes da 1ª tentativa
//   Tentativas      — tabela de tentativas + go/no-go (GLV-01 a 07)
//   Aceite          — decisão formal
// Abas stub:
//   Plano, Ocorrências, Histórico
// =========================================================================

let _glProjetoAtual   = null;
let _glAbaAtual       = 'gl_resumo';
let _glCriterios      = [];
let _glTentativas     = [];
let _glBlocoPlano     = null;
let _glPlanoVersao    = 1;
let _glModoRetificacao = false;

const GL_ESTADO_META = {
    GO_LIVE_PLANNING:    { label: 'Planejamento',        cor: 'indigo' },
    GO_NO_GO:            { label: 'Go/No-Go',            cor: 'amber'  },
    GO_LIVE_IN_PROGRESS: { label: 'Em Execução',         cor: 'green'  },
    GO_LIVE_ROLLED_BACK: { label: 'Rollback Executado',  cor: 'red'    },
    GO_LIVE_DONE:        { label: 'Tentativa Concluída', cor: 'indigo' },
    GO_LIVE_ACCEPTANCE:  { label: 'Aguardando Aceite',   cor: 'amber'  },
    GO_LIVE_ACCEPTED:    { label: 'Go Live Aceito',      cor: 'green'  },
    GO_LIVE_ACCEPTED_WITH_RESTRICTIONS: { label: 'Aceito com Restrições', cor: 'amber' },
};

const TENTATIVA_RESULTADO_BADGE = {
    EM_EXECUCAO:  '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">Em execução</span>',
    SUCESSO:      '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Sucesso</span>',
    FALHA:        '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Rollback</span>',
    NAO_INICIADA: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Não iniciada</span>',
};

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
async function renderWorkspaceGolive(projeto, bodyId) {
    _glProjetoAtual = projeto;
    const el = document.getElementById(bodyId);
    if (!el) return;

    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    await _glCarregarDados();

    el.innerHTML = `
        ${_glRenderStepper()}
        ${_glRenderInfoStrip()}
        ${_glRenderTabBar()}
        <div class="p-4 space-y-3">
            <div id="glBody_gl_resumo"></div>
            <div id="glBody_gl_plano" class="hidden"></div>
            <div id="glBody_gl_rollback" class="hidden"></div>
            <div id="glBody_gl_tentativas" class="hidden"></div>
            <div id="glBody_gl_ocorrencias" class="hidden"></div>
            <div id="glBody_gl_aceite" class="hidden"></div>
            <div id="glBody_gl_historico" class="hidden"></div>
        </div>`;

    mudarAbaGolive('gl_resumo');
}

// -------------------------------------------------------------------------
// DADOS
// -------------------------------------------------------------------------
async function _glCarregarDados() {
    _glCriterios = []; _glTentativas = [];
    _glBlocoPlano = null; _glPlanoVersao = 1;
    if (!_glProjetoAtual) return;
    const codigo = _glProjetoAtual.codigo;
    try {
        const { data: c } = await _supabase.from('golive_criterios_rollback').select('*')
            .eq('projeto_codigo', codigo).eq('ativo', true).order('id');
        _glCriterios = c || [];

        const { data: t } = await _supabase.from('golive_tentativas').select('*')
            .eq('projeto_codigo', codigo).order('numero');
        _glTentativas = t || [];

        const { data: planos } = await _supabase.from('plano_entrega').select('id, versao')
            .eq('projeto_codigo', codigo).order('versao', { ascending: false }).limit(1);
        if (planos?.length) {
            _glPlanoVersao = planos[0].versao;
            const { data: blocos } = await _supabase.from('plano_entrega_bloco').select('*')
                .eq('plano_id', planos[0].id).eq('bloco', 'GO_LIVE');
            _glBlocoPlano = blocos?.[0] || null;
        }
    } catch (_) {}
}

// -------------------------------------------------------------------------
// STEPPER
// -------------------------------------------------------------------------
function _glRenderStepper() {
    const fases = [
        { label: 'Requerimentos', done: true  },
        { label: 'Especificação', done: true  },
        { label: 'Execução',      done: true  },
        { label: 'UAT',           done: true  },
        { label: 'Go Live',       done: false, active: true },
        { label: 'Encerramento',  done: false },
    ];
    const items = fases.map((f, i) => {
        const circleCls = f.done ? 'background:#16a34a;color:#fff' : (f.active ? 'background:#4338ca;color:#fff' : 'background:#e5e7eb;color:#64748b');
        const labelCls  = f.done ? 'color:#166534' : (f.active ? 'color:#3730a3;font-weight:800' : 'color:#64748b');
        const lineCls   = f.done ? '#16a34a' : '#e5e7eb';
        const inner     = f.done ? '✓' : (i + 1);
        const line      = i < fases.length - 1 ? `<div style="flex-grow:1;height:2px;margin-top:-18px;background:${lineCls};"></div>` : '';
        return `
            <div style="display:flex;align-items:center;${i < fases.length - 1 ? 'flex-grow:1;' : ''}">
                <div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:90px;flex-shrink:0;">
                    <div style="width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;${circleCls}">${inner}</div>
                    <span style="font-size:10.5px;${labelCls};text-align:center;line-height:1.2;">${f.label}</span>
                </div>
                ${line}
            </div>`;
    }).join('');
    return `<div style="height:64px;flex-shrink:0;box-sizing:border-box;padding:10px 20px;display:flex;align-items:center;background:#fff;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;width:100%;">${items}</div>
    </div>`;
}

// -------------------------------------------------------------------------
// INFO STRIP
// -------------------------------------------------------------------------
function _glRenderInfoStrip() {
    const p = _glProjetoAtual;
    const estado = (p.golive_estado || 'GO_LIVE_PLANNING').toUpperCase();
    const meta = GL_ESTADO_META[estado] || { label: estado, cor: 'slate' };
    const badgeCls = { indigo: 'bg-indigo-100 text-indigo-800', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700' }[meta.cor] || 'bg-slate-100 text-slate-700';

    // Verificar se bloco Go Live requer ratificação (lido do plano de entrega via cache)
    const blocoRequer = _glBlocoRequerRatificacao
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Bloco requer ratificação</span>`
        : '';
    const gonogoBlock = _glBlocoRequerRatificacao
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Go/no-go bloqueado</span>`
        : '';

    return `
        <div class="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-5 flex-wrap">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-gray-400 font-semibold">${escapeHtml(p.codigo)} · Go Live</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeCls}">${meta.label}</span>
                    ${blocoRequer}${gonogoBlock}
                </div>
                <h1 class="text-lg font-black text-[#0f1e3d] truncate mt-0.5">${escapeHtml(p.nome || '')}</h1>
            </div>
            <div class="flex gap-5 flex-shrink-0">
                ${[['Owner', p.pessoa_responsavel || '—'], ['FY', p.ano_fiscal || '—']]
                    .map(([l, v]) => `<div class="flex flex-col gap-0.5"><span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${l}</span><b class="text-sm text-[#0f1e3d]">${escapeHtml(String(v))}</b></div>`).join('')}
            </div>
        </div>`;
}

let _glBlocoRequerRatificacao = false;

// -------------------------------------------------------------------------
// TAB BAR
// -------------------------------------------------------------------------
function _glRenderTabBar() {
    function btn(id, label) {
        return `<button id="glTab_${id}" onclick="mudarAbaGolive('${id}')" class="gl-tab-btn px-2 py-1.5 text-xs text-gray-500 border-b-2 border-transparent whitespace-nowrap hover:text-gray-800">${label}</button>`;
    }
    function sep() { return `<div class="w-px h-5 bg-gray-200 mx-1 self-end mb-1.5"></div>`; }
    function grp(label, btns) {
        return `<div class="flex flex-col gap-0.5">
            <span class="text-[9px] font-bold uppercase tracking-widest text-[#93a4c3] pl-0.5">${label}</span>
            <div class="flex">${btns.join('')}</div>
        </div>`;
    }
    return `
        <div class="flex items-end gap-1.5 bg-white border-b border-gray-200 px-3 pt-1.5 pb-0 flex-wrap">
            <div class="flex flex-col gap-0.5">
                <span class="text-[9px] font-bold uppercase tracking-widest text-transparent pl-0.5">—</span>
                <div class="flex">${btn('gl_resumo','Resumo')}</div>
            </div>
            ${sep()}
            ${grp('Preparação', [btn('gl_plano','Plano'), btn('gl_rollback','Rollback')])}
            ${sep()}
            ${grp('Execução', [btn('gl_tentativas','Tentativas'), btn('gl_ocorrencias','Ocorrências')])}
            ${sep()}
            ${grp('Decisão', [btn('gl_aceite','Aceite')])}
            ${sep()}
            ${grp('Registro', [btn('gl_historico','Histórico')])}
        </div>`;
}

function mudarAbaGolive(aba) {
    _glAbaAtual = aba;
    document.querySelectorAll('.gl-tab-btn').forEach(b => {
        const on = b.id === `glTab_${aba}`;
        b.classList.toggle('text-indigo-700', on);
        b.classList.toggle('border-indigo-600', on);
        b.classList.toggle('font-bold', on);
        b.classList.toggle('text-gray-500', !on);
        b.classList.toggle('border-transparent', !on);
    });
    ['gl_resumo','gl_plano','gl_rollback','gl_tentativas','gl_ocorrencias','gl_aceite','gl_historico'].forEach(id => {
        const el = document.getElementById(`glBody_${id}`);
        if (el) el.classList.toggle('hidden', id !== aba);
    });
    if (aba === 'gl_resumo')          _glRenderResumo();
    else if (aba === 'gl_plano')      _glRenderPlano();
    else if (aba === 'gl_rollback')   _glRenderRollback();
    else if (aba === 'gl_tentativas') _glRenderTentativas();
    else if (aba === 'gl_aceite')     _glRenderAceite();
    else _glRenderStub(aba);
}

// -------------------------------------------------------------------------
// ABA: RESUMO
// -------------------------------------------------------------------------
function _glRenderResumo() {
    const el = document.getElementById('glBody_gl_resumo');
    if (!el || !_glProjetoAtual) return;
    const p = _glProjetoAtual;
    const estado = (p.golive_estado || 'GO_LIVE_PLANNING').toUpperCase();

    let bannerHtml = '';
    if (_glBlocoRequerRatificacao) {
        bannerHtml = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2 items-start">
                <i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5 flex-shrink-0"></i>
                <div class="flex-1">
                    <b>O UAT retificou o seu bloco.</b>
                    <span class="ml-1">A janela de Go Live precisa ser ratificada ou retificada antes do go/no-go. Responsável notificado.</span>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button onclick="_glRatificarBlocoGolive()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg">Ratificar</button>
                    <button onclick="mudarAbaGolive('gl_plano')" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg">Retificar janela</button>
                </div>
            </div>`;
    }

    const kpis = [
        { lbl: 'Estado',       val: (GL_ESTADO_META[estado] || { label: estado }).label, sub: 'SCR-12 Go Live' },
        { lbl: 'Tentativas',   val: String(_glTentativas.length), sub: `${_glTentativas.filter(t => t.resultado === 'SUCESSO').length} com sucesso` },
        { lbl: 'Critérios Rollback', val: String(_glCriterios.length), sub: _glCriterios.length > 0 ? 'Definidos' : 'Não definidos' },
    ];

    const cardsHtml = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            ${kpis.map(c => `
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
                    <p class="text-base font-black text-gray-800 mt-1">${c.val}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
                </div>`).join('')}
        </div>`;

    let acaoHtml = '';
    if (estado === 'GO_LIVE_PLANNING' && !_glBlocoRequerRatificacao) {
        if (_glCriterios.length === 0) {
            acaoHtml = `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2 items-start">
                    <i class="fa-solid fa-info-circle text-blue-500 mt-0.5 flex-shrink-0"></i>
                    <div><b>Defina os critérios de rollback antes da primeira tentativa (RF-06).</b> <span class="ml-1">Uma ocorrência classificada como "Crítica" não obriga rollback sozinha; o rollback acontece quando um critério é excedido.</span></div>
                </div>
                <div class="flex justify-end">
                    <button onclick="mudarAbaGolive('gl_rollback')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-shield-halved mr-1"></i>Definir critérios de rollback
                    </button>
                </div>`;
        } else {
            acaoHtml = `
                <div class="flex justify-end gap-2">
                    <button onclick="mudarAbaGolive('gl_rollback')" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Ver rollback</button>
                    <button onclick="mudarAbaGolive('gl_tentativas')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-rocket mr-1"></i>Nova tentativa (go/no-go)
                    </button>
                </div>`;
        }
    } else if (['GO_LIVE_ACCEPTED','GO_LIVE_ACCEPTED_WITH_RESTRICTIONS'].includes(estado)) {
        acaoHtml = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2">
                <i class="fa-solid fa-check-circle text-green-600 mt-0.5 flex-shrink-0"></i>
                <b>Go Live aceito. Encerramento habilitado.</b>
            </div>`;
    }

    el.innerHTML = `<div class="space-y-3">${bannerHtml}${cardsHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// ABA: ROLLBACK (RF-06)
// -------------------------------------------------------------------------
function _glRenderRollback() {
    const el = document.getElementById('glBody_gl_rollback');
    if (!el || !_glProjetoAtual) return;

    const EFEITO_BADGE = {
        ROLLBACK:        '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Rollback</span>',
        ROLLBACK_PARCIAL:'<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Rollback parcial</span>',
        DECISAO_COMITE:  '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Decisão do comitê</span>',
    };

    const rows = _glCriterios.map((c, i) => `
        <tr>
            <td class="px-3 py-2 font-bold text-xs text-gray-800">C${i + 1}</td>
            <td class="px-3 py-2 text-xs text-gray-700">${escapeHtml(c.criterio || '')}</td>
            <td class="px-3 py-2 text-xs text-gray-600">${escapeHtml(c.limite || '')}</td>
            <td class="px-3 py-2">${EFEITO_BADGE[c.efeito] || ''}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(c.tempo_max || '—')}</td>
        </tr>`).join('');

    el.innerHTML = `
        <div class="space-y-3">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex gap-2 items-start">
                <i class="fa-solid fa-shield-halved text-amber-500 mt-0.5 flex-shrink-0"></i>
                <div>
                    <b>RF-06 — Rollback por critério, não por severidade.</b>
                    <span class="ml-1">Uma ocorrência classificada como "Crítica" não dispara rollback sozinha. O rollback ocorre quando um critério da tabela abaixo é excedido. Os critérios são aprovados no go/no-go e ficam congelados durante a tentativa.</span>
                </div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                    <span class="text-sm font-bold text-gray-800">Critérios de rollback</span>
                    <button onclick="_glAdicionarCriterio()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">
                        <i class="fa-solid fa-plus mr-1"></i>Adicionar critério
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">ID</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Critério / Cenário</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Limite</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Efeito</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tempo máx.</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows || `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-gray-400">Nenhum critério definido. Adicione os critérios antes da primeira tentativa (RF-06).</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: TENTATIVAS
// -------------------------------------------------------------------------
function _glRenderTentativas() {
    const el = document.getElementById('glBody_gl_tentativas');
    if (!el || !_glProjetoAtual) return;

    const podeFazerTentativa = _glCriterios.length > 0 && !_glBlocoRequerRatificacao;

    const rows = _glTentativas.map(t => `
        <tr>
            <td class="px-3 py-2 font-bold text-xs text-gray-800">T${t.numero}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(t.ambiente || '—')}</td>
            <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${t.dt_inicio ? new Date(t.dt_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
            <td class="px-3 py-2">${TENTATIVA_RESULTADO_BADGE[t.resultado] || ''}</td>
            <td class="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">${escapeHtml(t.criterio_excedido || (t.resultado === 'SUCESSO' ? 'Nenhum critério excedido' : '—'))}</td>
        </tr>`).join('');

    el.innerHTML = `
        <div class="space-y-3">
            ${!podeFazerTentativa ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2">
                    <i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5 flex-shrink-0"></i>
                    <span>${_glBlocoRequerRatificacao ? '<b>Bloco de Go Live requer ratificação.</b> Ratifique ou retifique antes do go/no-go.' : '<b>Defina os critérios de rollback</b> na aba Rollback antes de iniciar a primeira tentativa (RF-06).'}</span>
                </div>` : ''}
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                    <span class="text-sm font-bold text-gray-800">Tentativas de Go Live</span>
                    ${podeFazerTentativa ? `<button onclick="_glAbrirGoNoGo()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800"><i class="fa-solid fa-rocket mr-1"></i>Nova tentativa (go/no-go)</button>` : ''}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ambiente</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Início</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Resultado</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Critério</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows || `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-gray-400">Nenhuma tentativa registrada.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <b>RF-06:</b> Nenhuma tentativa pode ser apagada. Falha com critério excedido exige registrar o rollback executado antes da próxima tentativa.
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: ACEITE
// -------------------------------------------------------------------------
function _glRenderAceite() {
    const el = document.getElementById('glBody_gl_aceite');
    if (!el || !_glProjetoAtual) return;
    const p = _glProjetoAtual;
    const estado = (p.golive_estado || 'GO_LIVE_PLANNING').toUpperCase();
    const jaAceito = ['GO_LIVE_ACCEPTED','GO_LIVE_ACCEPTED_WITH_RESTRICTIONS'].includes(estado);
    const temSucesso = _glTentativas.some(t => t.resultado === 'SUCESSO');

    const checks = [
        { id: 'GLV-01', label: 'UAT aceito (com ou sem restrições)',             ok: ['UAT_ACCEPTED','UAT_ACCEPTED_WITH_RESTRICTIONS'].includes(p.uat_estado) },
        { id: 'GLV-02', label: 'Bloco de Go Live ratificado ou retificado',       ok: !_glBlocoRequerRatificacao },
        { id: 'GLV-03', label: 'Critérios de rollback definidos',                 ok: _glCriterios.length > 0 },
        { id: 'GLV-04', label: 'Runbook e prontidão operacional confirmados',     ok: false },
        { id: 'GLV-05', label: 'Janela aprovada e comunicação enviada',           ok: false },
        { id: 'GLV-06', label: 'Correções de tentativas anteriores concluídas',   ok: temSucesso },
        { id: 'GLV-07', label: 'Responsáveis da janela e decisão de rollback confirmados', ok: false },
    ];

    const todasOk = temSucesso && !_glBlocoRequerRatificacao;

    const checklistHtml = `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Checklist de Aceite do Go Live</span>
            </div>
            <div class="divide-y divide-gray-50">
                ${checks.map(c => `
                    <div class="flex items-center gap-3 px-4 py-2.5">
                        <div class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${c.ok ? 'bg-green-100' : 'bg-red-50'}">
                            <i class="fa-solid ${c.ok ? 'fa-check text-green-700' : 'fa-times text-red-400'} text-[10px]"></i>
                        </div>
                        <span class="text-xs font-bold text-gray-400 flex-shrink-0">${c.id}</span>
                        <span class="text-xs text-gray-700">${c.label}</span>
                    </div>`).join('')}
            </div>
        </div>`;

    if (jaAceito) {
        el.innerHTML = `<div class="space-y-3">${checklistHtml}
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2">
                <i class="fa-solid fa-check-circle text-green-600 mt-0.5"></i>
                <b>Go Live aceito. Encerramento habilitado.</b>
            </div></div>`;
        return;
    }

    const acaoHtml = todasOk
        ? `<div class="flex justify-end gap-2">
               <button onclick="_glRegistrarAceite('COM_RESTRICOES')" class="px-4 py-2 rounded-lg text-xs font-bold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">Aceitar com restrições</button>
               <button onclick="_glRegistrarAceite('ACEITO')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">Aceitar Go Live</button>
           </div>`
        : `<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2">
               <i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5"></i>
               <span>Há critérios não atendidos. É necessário pelo menos uma tentativa com sucesso e o bloco ratificado.</span>
           </div>`;

    el.innerHTML = `<div class="space-y-3">${checklistHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// AÇÕES
// -------------------------------------------------------------------------
async function _glAdicionarCriterio() {
    if (!_glProjetoAtual) return;
    const criterio  = prompt('Critério / Cenário (ex.: Indisponibilidade do motor):');
    if (!criterio) return;
    const limite    = prompt('Limite (ex.: > 30 min contínuos):') || '—';
    const efeitos   = ['ROLLBACK','ROLLBACK_PARCIAL','DECISAO_COMITE'];
    const efeito    = prompt('Efeito (ROLLBACK / ROLLBACK_PARCIAL / DECISAO_COMITE):', 'ROLLBACK')?.toUpperCase();
    if (!efeitos.includes(efeito)) { alert('Efeito inválido.'); return; }
    const tempo     = prompt('Tempo máximo para a ação (ex.: 15 min):') || '';
    try {
        await _supabase.from('golive_criterios_rollback').insert({
            projeto_codigo: _glProjetoAtual.codigo,
            criterio, limite, efeito, tempo_max: tempo,
            criado_por: currentUser?.email || '',
        });
        await _glCarregarDados();
        mudarAbaGolive('gl_rollback');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _glAbrirGoNoGo() {
    if (!_glProjetoAtual) return;
    const numero = _glTentativas.length + 1;
    const amb = prompt(`Tentativa T${numero} — Ambiente (ex.: Homologação, Produção):`) || 'Homologação';
    const decisao = confirm(`Go/No-Go para T${numero} em ${amb}?\n\nOK = GO (inicia tentativa)\nCancelar = NO-GO (não inicia)`);
    if (!decisao) {
        alert('No-Go registrado. Tentativa não iniciada.');
        return;
    }
    try {
        await _supabase.from('golive_tentativas').insert({
            projeto_codigo: _glProjetoAtual.codigo,
            numero, ambiente: amb, dt_inicio: new Date().toISOString(),
            resultado: 'EM_EXECUCAO', iniciado_por: currentUser?.email || '',
            gonogo_decidido_por: currentUser?.email || '',
            gonogo_decidido_em: new Date().toISOString(),
        });
        await _supabase.from('projetos').update({ golive_estado: 'GO_LIVE_IN_PROGRESS' }).eq('codigo', _glProjetoAtual.codigo);
        _glProjetoAtual = { ..._glProjetoAtual, golive_estado: 'GO_LIVE_IN_PROGRESS' };
        const idx = projectsData.findIndex(p => p.codigo === _glProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], golive_estado: 'GO_LIVE_IN_PROGRESS' };
        await _glCarregarDados();
        mudarAbaGolive('gl_tentativas');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _glRatificarBlocoGolive() {
    if (!_glProjetoAtual) return;
    if (!confirm('Ratificar bloco de Go Live sem alterações?')) return;
    try {
        if (_glBlocoPlano?.id) {
            await _supabase.from('plano_entrega_bloco').update({ status: 'RATIFICADO' }).eq('id', _glBlocoPlano.id);
        }
        const dtAnt = _glBlocoPlano ? `${_glBlocoPlano.dt_inicio || '—'} – ${_glBlocoPlano.dt_fim || '—'}` : '—';
        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: _glProjetoAtual.codigo,
            data_acao:      new Date().toISOString().split('T')[0],
            etapa: 'Go Live', bloco: 'Go Live', acao: 'Ratificado',
            autor: currentUser?.email || '',
            justificativa: 'Bloco ratificado após retificação do UAT.',
            datas_antes: dtAnt, datas_depois: dtAnt,
            versao: _glPlanoVersao,
        });
        _glBlocoRequerRatificacao = false;
        await _glCarregarDados();
        mudarAbaGolive('gl_resumo');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

// -------------------------------------------------------------------------
// ABA: PLANO (Go Live)
// -------------------------------------------------------------------------
function _glRenderPlano() {
    const el = document.getElementById('glBody_gl_plano');
    if (!el || !_glProjetoAtual) return;

    if (_glModoRetificacao) {
        el.innerHTML = `<div class="space-y-3">${_glRenderFormRetificacao()}</div>`;
        return;
    }

    const b = _glBlocoPlano;
    const blocoHtml = b
        ? `<div class="grid grid-cols-3 gap-3">
            ${[
                { lbl: 'Início planejado', val: b.dt_inicio ? formatDate(b.dt_inicio) : '—' },
                { lbl: 'Fim planejado',    val: b.dt_fim   ? formatDate(b.dt_fim)   : '—' },
                { lbl: 'Status do bloco',  val: b.status || '—' },
            ].map(c => `<div class="bg-white border border-gray-200 rounded-lg p-3">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${c.lbl}</span>
                <p class="text-sm font-black text-gray-800 mt-1">${c.val}</p>
            </div>`).join('')}
        </div>`
        : `<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">Plano de Entrega não definido. Crie o plano na etapa de Execução primeiro.</div>`;

    const ratHtml = b && (b.status === 'PLANEJADO' || b.status === 'REQUER_RATIFICACAO')
        ? `<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0"></i>
            <div class="flex-1 text-xs text-amber-900">
                <b>Bloco Go Live aguarda ratificação.</b> Confirme as datas sem alteração (Ratificar) ou ajuste-as com justificativa (Retificar).
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button onclick="_glRatificarBlocoGolive()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">Ratificar</button>
                <button onclick="_glModoRetificacao=true; _glRenderPlano()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">Retificar janela</button>
            </div>
        </div>` : '';

    el.innerHTML = `<div class="space-y-3">
        ${ratHtml}
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Plano de Go Live · Bloco do Plano de Entrega (D-12)</span>
            </div>
            <div class="p-4 space-y-3">${blocoHtml}</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                <span class="text-sm font-bold text-gray-800">Critérios de Rollback</span>
                <button onclick="mudarAbaGolive('gl_rollback')" class="text-xs text-indigo-700 font-bold hover:text-indigo-900">Ver critérios →</button>
            </div>
            <div class="p-3 text-xs text-gray-500">${_glCriterios.length
                ? `${_glCriterios.length} critério${_glCriterios.length > 1 ? 's' : ''} de rollback definido${_glCriterios.length > 1 ? 's' : ''}. Acesse a aba Rollback para detalhes.`
                : 'Nenhum critério de rollback definido ainda. Use a aba Rollback para adicionar (RF-06).'}</div>
        </div>
    </div>`;
}

function _glRenderFormRetificacao() {
    const b = _glBlocoPlano;
    return `
        <div class="bg-white border border-amber-300 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex justify-between items-center">
                <span class="text-sm font-bold text-amber-900"><i class="fa-solid fa-pencil mr-1"></i>Retificar janela de Go Live</span>
                <button onclick="_glModoRetificacao=false; _glRenderPlano()" class="text-xs text-gray-500 hover:text-gray-800 font-semibold">Cancelar</button>
            </div>
            <div class="p-4 space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Data início atual</label>
                        <p class="text-xs text-gray-600 mt-1">${b?.dt_inicio ? formatDate(b.dt_inicio) : '—'}</p>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2 block">Nova data de início</label>
                        <input type="date" id="glRetifNovoInicio" value="${b?.dt_inicio || ''}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Data fim atual</label>
                        <p class="text-xs text-gray-600 mt-1">${b?.dt_fim ? formatDate(b.dt_fim) : '—'}</p>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2 block">Nova data de fim</label>
                        <input type="date" id="glRetifNovaFim" value="${b?.dt_fim || ''}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Justificativa <span class="text-red-500">*</span></label>
                    <textarea id="glRetifJustificativa" rows="3" placeholder="Motivo da alteração de janela (obrigatório)..."
                        class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5 resize-none"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="_glModoRetificacao=false; _glRenderPlano()" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button onclick="_glConfirmarRetificacao()" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-check mr-1"></i>Confirmar (v${_glPlanoVersao + 1})
                    </button>
                </div>
            </div>
        </div>`;
}

async function _glConfirmarRetificacao() {
    if (!_glProjetoAtual) return;
    const novoInicio    = document.getElementById('glRetifNovoInicio')?.value;
    const novaFim       = document.getElementById('glRetifNovaFim')?.value;
    const justificativa = document.getElementById('glRetifJustificativa')?.value?.trim();
    if (!novoInicio || !novaFim) { alert('Preencha as novas datas.'); return; }
    if (!justificativa) { alert('A justificativa é obrigatória.'); return; }

    const codigo     = _glProjetoAtual.codigo;
    const novaVersao = _glPlanoVersao + 1;
    const dtAnt      = `${_glBlocoPlano?.dt_inicio || '—'} – ${_glBlocoPlano?.dt_fim || '—'}`;

    try {
        const { data: planos } = await _supabase.from('plano_entrega').select('id')
            .eq('projeto_codigo', codigo).order('versao', { ascending: false }).limit(1);
        if (!planos?.length) throw new Error('Plano não encontrado.');
        const { data: todosB } = await _supabase.from('plano_entrega_bloco').select('*').eq('plano_id', planos[0].id);

        const { data: novoPlano, error: ep } = await _supabase.from('plano_entrega').insert({
            projeto_codigo: codigo, versao: novaVersao, eh_baseline: false, criado_por: currentUser?.email || '',
        }).select().single();
        if (ep) throw ep;

        for (const b of ['EXECUCAO', 'UAT', 'GO_LIVE']) {
            const ba = todosB?.find(x => x.bloco === b);
            const st = b === 'GO_LIVE' ? 'RETIFICADO' : 'RATIFICADO';
            await _supabase.from('plano_entrega_bloco').insert({
                plano_id: novoPlano.id, bloco: b,
                dt_inicio:   b === 'GO_LIVE' ? novoInicio : (ba?.dt_inicio || null),
                dt_fim:      b === 'GO_LIVE' ? novaFim    : (ba?.dt_fim    || null),
                responsavel: ba?.responsavel || null, descricao: ba?.descricao || null, status: st,
            });
        }

        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: codigo, data_acao: new Date().toISOString().split('T')[0],
            etapa: 'Go Live', bloco: 'Go Live', acao: 'Retificado',
            autor: currentUser?.email || '', justificativa,
            datas_antes: dtAnt, datas_depois: `${novoInicio} – ${novaFim}`, versao: novaVersao,
        });

        _glBlocoRequerRatificacao = false;
        _glModoRetificacao = false;
        await _glCarregarDados();
        _glRenderPlano();
    } catch (err) {
        alert('Erro ao retificar: ' + (err.message || JSON.stringify(err)));
    }
}

async function _glRegistrarAceite(tipo) {
    if (!_glProjetoAtual) return;
    const novoEstado = tipo === 'ACEITO' ? 'GO_LIVE_ACCEPTED' : 'GO_LIVE_ACCEPTED_WITH_RESTRICTIONS';
    if (!confirm(`${tipo === 'ACEITO' ? 'Aceitar' : 'Aceitar com restrições'} o Go Live? Esta ação habilita o Encerramento.`)) return;
    try {
        await _supabase.from('projetos').update({ golive_estado: novoEstado }).eq('codigo', _glProjetoAtual.codigo);
        _glProjetoAtual = { ..._glProjetoAtual, golive_estado: novoEstado };
        const idx = projectsData.findIndex(p => p.codigo === _glProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], golive_estado: novoEstado };
        mudarAbaGolive('gl_aceite');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

// -------------------------------------------------------------------------
// STUBS
// -------------------------------------------------------------------------
function _glRenderStub(aba) {
    const labels = {
        gl_plano:       { l: 'Plano',       i: 'fa-calendar' },
        gl_ocorrencias: { l: 'Ocorrências', i: 'fa-triangle-exclamation' },
        gl_historico:   { l: 'Histórico',   i: 'fa-clock-rotate-left' },
    };
    const info = labels[aba] || { l: aba, i: 'fa-diagram-project' };
    const el = document.getElementById(`glBody_${aba}`);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid ${info.i} text-3xl mb-3 opacity-40"></i>
            <span class="text-sm font-semibold">${info.l}</span>
            <span class="text-xs mt-1">Em desenvolvimento — Fase 6+</span>
        </div>`;
}
