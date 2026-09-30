// =========================================================================
// encerramento/workspace-encerramento.js
// Compasso 2.0 — Fase 6 (cap.09): workspace de Encerramento (SCR-14).
//
// Regras críticas:
//   - Nenhuma pendência fica sem tratamento na submissão (ENV-02)
//   - Project encerrado fica inteiro somente leitura
//   - Reabertura exige justificativa, Impact Preview e autoridade
//   - Encerramento anterior preservado como ciclo 1
//
// Abas implementadas:
//   Resumo      — checklist ENV-01 a 08 + contadores de pendências
//   Pendências  — lista consolidada com Resolver/Transferir/Cancelar
//   Aprovação   — submissão + decisão formal
//   Reabertura  — pedido excepcional (CMP-01/RF-06)
// Abas stub:
//   Resultados, Documentos, Histórico
// =========================================================================

let _encProjetoAtual  = null;
let _encAbaAtual      = 'enc_resumo';
let _encPendencias    = [];

const ENC_ESTADO_META = {
    CLOSING:          { label: 'Em Encerramento',  cor: 'indigo' },
    CLOSURE_REVIEW:   { label: 'Aguardando Aprovação', cor: 'amber' },
    CLOSED:           { label: 'Encerrado',        cor: 'slate'  },
    REOPEN_REQUESTED: { label: 'Reabertura Solicitada', cor: 'amber' },
    REOPENED:         { label: 'Reaberto',         cor: 'green'  },
};

const TIPO_LABEL = {
    RESTRICAO_UAT:    'Restrição de aceite · UAT',
    RESTRICAO_GOLIVE: 'Restrição de aceite · Go Live',
    TAREFA:           'Tarefa · Execução',
    RISCO:            'Risco · RAID',
    OCORRENCIA:       'Ocorrência · Go Live',
    CONTRATO:         'Contrato · Financeiro',
    ITEM_ACEITO:      'Item aceito · M06/M07',
};

const STATUS_PENDENCIA = {
    SEM_TRATAMENTO: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Sem tratamento</span>',
    PENDENTE_ACEITE: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Aguarda aceite</span>',
    TRATADO: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Tratado</span>',
};

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
async function renderWorkspaceEncerramento(projeto, bodyId) {
    _encProjetoAtual = projeto;
    const el = document.getElementById(bodyId);
    if (!el) return;

    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    await _encCarregarDados();

    el.innerHTML = `
        ${_encRenderStepper()}
        ${_encRenderInfoStrip()}
        ${_encRenderTabBar()}
        <div class="p-4 space-y-3">
            <div id="encBody_enc_resumo"></div>
            <div id="encBody_enc_pendencias" class="hidden"></div>
            <div id="encBody_enc_resultados" class="hidden"></div>
            <div id="encBody_enc_documentos" class="hidden"></div>
            <div id="encBody_enc_aprovacao" class="hidden"></div>
            <div id="encBody_enc_reabertura" class="hidden"></div>
            <div id="encBody_enc_historico" class="hidden"></div>
        </div>`;

    mudarAbaEncerramento('enc_resumo');
}

// -------------------------------------------------------------------------
// DADOS
// -------------------------------------------------------------------------
async function _encCarregarDados() {
    _encPendencias = [];
    if (!_encProjetoAtual) return;
    const codigo = _encProjetoAtual.codigo;
    try {
        const { data: p } = await _supabase.from('encerramento_pendencias').select('*')
            .eq('projeto_codigo', codigo).order('criado_em');
        _encPendencias = p || [];
    } catch (_) {}
}

// -------------------------------------------------------------------------
// STEPPER
// -------------------------------------------------------------------------
function _encRenderStepper() {
    const fases = [
        { label: 'Requerimentos', done: true  },
        { label: 'Especificação', done: true  },
        { label: 'Execução',      done: true  },
        { label: 'UAT',           done: true  },
        { label: 'Go Live',       done: true  },
        { label: 'Encerramento',  done: false, active: true },
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
function _encRenderInfoStrip() {
    const p = _encProjetoAtual;
    const estado = (p.enc_estado || 'CLOSING').toUpperCase();
    const meta   = ENC_ESTADO_META[estado] || { label: estado, cor: 'slate' };
    const badgeCls = { indigo: 'bg-indigo-100 text-indigo-800', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700' }[meta.cor] || 'bg-slate-100 text-slate-700';
    const semTrat = _encPendencias.filter(p => p.status === 'SEM_TRATAMENTO').length;
    const pendBadge = semTrat > 0
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">${semTrat} pendência${semTrat > 1 ? 's' : ''} sem tratamento</span>`
        : '';

    return `
        <div class="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-5 flex-wrap">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-gray-400 font-semibold">${escapeHtml(p.codigo)} · Encerramento</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeCls}">${meta.label}</span>
                    ${pendBadge}
                </div>
                <h1 class="text-lg font-black text-[#0f1e3d] truncate mt-0.5">${escapeHtml(p.nome || '')}</h1>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// TAB BAR
// -------------------------------------------------------------------------
function _encRenderTabBar() {
    function btn(id, label) {
        return `<button id="encTab_${id}" onclick="mudarAbaEncerramento('${id}')" class="enc-tab-btn px-2 py-1.5 text-xs text-gray-500 border-b-2 border-transparent whitespace-nowrap hover:text-gray-800">${label}</button>`;
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
                <div class="flex">${btn('enc_resumo','Resumo')}</div>
            </div>
            ${sep()}
            ${grp('Verificação', [btn('enc_pendencias','Pendências'), btn('enc_resultados','Resultados')])}
            ${sep()}
            ${grp('Conhecimento', [btn('enc_documentos','Documentos')])}
            ${sep()}
            ${grp('Decisão', [btn('enc_aprovacao','Aprovação')])}
            ${sep()}
            ${grp('Exceção', [btn('enc_reabertura','Reabertura')])}
            ${sep()}
            ${grp('Registro', [btn('enc_historico','Histórico')])}
        </div>`;
}

function mudarAbaEncerramento(aba) {
    _encAbaAtual = aba;
    document.querySelectorAll('.enc-tab-btn').forEach(b => {
        const on = b.id === `encTab_${aba}`;
        b.classList.toggle('text-indigo-700', on);
        b.classList.toggle('border-indigo-600', on);
        b.classList.toggle('font-bold', on);
        b.classList.toggle('text-gray-500', !on);
        b.classList.toggle('border-transparent', !on);
    });
    ['enc_resumo','enc_pendencias','enc_resultados','enc_documentos','enc_aprovacao','enc_reabertura','enc_historico'].forEach(id => {
        const el = document.getElementById(`encBody_${id}`);
        if (el) el.classList.toggle('hidden', id !== aba);
    });
    if (aba === 'enc_resumo')         _encRenderResumo();
    else if (aba === 'enc_pendencias')     _encRenderPendencias();
    else if (aba === 'enc_aprovacao')      _encRenderAprovacao();
    else if (aba === 'enc_reabertura')     _encRenderReabertura();
    else _encRenderStub(aba);
}

// -------------------------------------------------------------------------
// ABA: RESUMO
// -------------------------------------------------------------------------
function _encRenderResumo() {
    const el = document.getElementById('encBody_enc_resumo');
    if (!el || !_encProjetoAtual) return;
    const p      = _encProjetoAtual;
    const estado = (p.enc_estado || 'CLOSING').toUpperCase();
    const encerrado = estado === 'CLOSED';

    const semTrat  = _encPendencias.filter(p => p.status === 'SEM_TRATAMENTO').length;
    const tratados = _encPendencias.filter(p => p.status === 'TRATADO').length;

    const glAceito = ['GO_LIVE_ACCEPTED','GO_LIVE_ACCEPTED_WITH_RESTRICTIONS'].includes(p.golive_estado);

    const checks = [
        { id: 'ENV-01', label: 'Go Live aceito (ou encerramento por cancelamento)', ok: glAceito },
        { id: 'ENV-02', label: 'Toda pendência resolvida, transferida ou cancelada', ok: semTrat === 0 && _encPendencias.length > 0 },
        { id: 'ENV-03', label: 'Financeiro conciliado: realizado final registrado',  ok: false },
        { id: 'ENV-04', label: 'Contratos sem saldo alocado em aberto',              ok: false },
        { id: 'ENV-05', label: 'KRs medidos ou com plano de medição',               ok: false },
        { id: 'ENV-06', label: 'Termo de encerramento e lições aprendidas',         ok: false },
        { id: 'ENV-07', label: 'Entrega à operação registrada',                     ok: false },
        { id: 'ENV-08', label: 'Nenhuma mudança ou Change sem decisão',             ok: false },
    ];

    const checklistHtml = `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                <span class="text-sm font-bold text-gray-800">Checklist de Encerramento</span>
                ${encerrado ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Project encerrado · somente leitura</span>' : ''}
            </div>
            <div class="divide-y divide-gray-50">
                ${checks.map(c => `
                    <div class="flex items-center gap-3 px-4 py-2.5">
                        <div class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${c.ok ? 'bg-green-100' : 'bg-red-50'}">
                            <i class="fa-solid ${c.ok ? 'fa-check text-green-700' : 'fa-times text-red-400'} text-[10px]"></i>
                        </div>
                        <span class="text-xs font-bold text-gray-400 flex-shrink-0">${c.id}</span>
                        <span class="text-xs text-gray-700">${c.label}</span>
                        ${c.ok ? '' : `<button onclick="mudarAbaEncerramento('${c.id === 'ENV-02' ? 'enc_pendencias' : c.id === 'ENV-01' ? 'enc_resumo' : 'enc_documentos'}')" class="ml-auto text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold flex-shrink-0">Resolver →</button>`}
                    </div>`).join('')}
            </div>
        </div>`;

    const kpisHtml = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            ${[
                { lbl: 'Pendências',       val: String(_encPendencias.length), sub: `${semTrat} sem tratamento` },
                { lbl: 'Tratadas',         val: String(tratados),              sub: `de ${_encPendencias.length}` },
                { lbl: 'Estado',           val: (ENC_ESTADO_META[estado] || {}).label || estado, sub: 'Encerramento' },
            ].map(c => `
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
                    <p class="text-base font-black text-gray-800 mt-1">${c.val}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
                </div>`).join('')}
        </div>`;

    let acaoHtml = '';
    if (!encerrado && estado !== 'CLOSURE_REVIEW') {
        acaoHtml = `
            <div class="flex justify-end gap-2">
                <button onclick="mudarAbaEncerramento('enc_pendencias')" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                    Ver pendências (${_encPendencias.length})
                </button>
                <button onclick="mudarAbaEncerramento('enc_aprovacao')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                    <i class="fa-solid fa-paper-plane mr-1"></i>Submeter encerramento
                </button>
            </div>`;
    }

    el.innerHTML = `<div class="space-y-3">${kpisHtml}${checklistHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// ABA: PENDÊNCIAS
// -------------------------------------------------------------------------
function _encRenderPendencias() {
    const el = document.getElementById('encBody_enc_pendencias');
    if (!el || !_encProjetoAtual) return;

    const TRATAMENTO_BTNS = (pend) => {
        const t = pend.tratamento;
        const btnCls = (ativo) => ativo
            ? 'px-2 py-0.5 text-[11px] font-bold bg-indigo-700 text-white rounded-full'
            : 'px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200';
        return `
            <div class="flex gap-1 flex-wrap">
                <button onclick="_encSelecionarTratamento('${pend.id}','RESOLVER')" class="${btnCls(t === 'RESOLVER')}">Resolver</button>
                <button onclick="_encSelecionarTratamento('${pend.id}','TRANSFERIR')" class="${btnCls(t === 'TRANSFERIR')}">Transferir</button>
                <button onclick="_encSelecionarTratamento('${pend.id}','CANCELAR')" class="${btnCls(t === 'CANCELAR')}">Cancelar</button>
            </div>`;
    };

    const rows = _encPendencias.map(pend => `
        <tr>
            <td class="px-3 py-2.5 text-xs align-top">
                <b class="text-gray-800">${TIPO_LABEL[pend.tipo] || pend.tipo}</b>
            </td>
            <td class="px-3 py-2.5 text-xs text-gray-700 align-top max-w-xs">
                ${escapeHtml(pend.descricao || '')}
                ${pend.responsavel_original ? `<br><span class="text-gray-400">${escapeHtml(pend.responsavel_original)}</span>` : ''}
            </td>
            <td class="px-3 py-2.5 align-top">${TRATAMENTO_BTNS(pend)}</td>
            <td class="px-3 py-2.5 align-top">${STATUS_PENDENCIA[pend.status] || ''}</td>
        </tr>`).join('');

    const semTrat = _encPendencias.filter(p => p.status === 'SEM_TRATAMENTO').length;

    el.innerHTML = `
        <div class="space-y-3">
            ${semTrat > 0 ? `
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex gap-2">
                    <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0"></i>
                    <span><b>ENV-02 bloqueia a submissão.</b> ${semTrat} item${semTrat > 1 ? 's' : ''} sem tratamento. Todo item precisa ser resolvido, transferido com aceite de quem recebe, ou cancelado com justificativa.</span>
                </div>` : `
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2">
                    <i class="fa-solid fa-check-circle text-green-600 mt-0.5 flex-shrink-0"></i>
                    <span><b>ENV-02 atendido.</b> Todas as pendências estão tratadas.</span>
                </div>`}
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                    <span class="text-sm font-bold text-gray-800">Pendências consolidadas de todas as etapas</span>
                    <div class="flex gap-2">
                        <button onclick="_encAdicionarPendencia()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
                            <i class="fa-solid fa-plus mr-1"></i>Adicionar
                        </button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo · origem</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Item · responsável</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tratamento</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Situação</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows || `<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-gray-400">Nenhuma pendência registrada. Adicione pendências de restrições de aceite, tarefas, riscos, contratos, etc.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: APROVAÇÃO
// -------------------------------------------------------------------------
function _encRenderAprovacao() {
    const el = document.getElementById('encBody_enc_aprovacao');
    if (!el || !_encProjetoAtual) return;
    const p      = _encProjetoAtual;
    const estado = (p.enc_estado || 'CLOSING').toUpperCase();
    const encerrado = estado === 'CLOSED';

    const semTrat = _encPendencias.filter(p => p.status === 'SEM_TRATAMENTO').length;
    const glAceito = ['GO_LIVE_ACCEPTED','GO_LIVE_ACCEPTED_WITH_RESTRICTIONS'].includes(p.golive_estado);
    const podeSubmeter = semTrat === 0 && glAceito;

    if (encerrado) {
        el.innerHTML = `
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <i class="fa-solid fa-flag-checkered text-slate-400 text-4xl mb-4"></i>
                <h3 class="text-sm font-black text-gray-800 mb-2">Project Encerrado</h3>
                <p class="text-xs text-gray-500">Este project está inteiro somente leitura. Para reabrir, use a aba Reabertura.</p>
                <button onclick="mudarAbaEncerramento('enc_reabertura')" class="mt-4 px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                    Solicitar reabertura
                </button>
            </div>`;
        return;
    }

    el.innerHTML = `
        <div class="space-y-3">
            <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 class="text-sm font-bold text-gray-800">Submeter encerramento</h3>
                ${!glAceito ? `<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2"><i class="fa-solid fa-times-circle text-red-500 mt-0.5"></i><span><b>ENV-01:</b> Go Live ainda não foi aceito.</span></div>` : ''}
                ${semTrat > 0 ? `<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2"><i class="fa-solid fa-times-circle text-red-500 mt-0.5"></i><span><b>ENV-02:</b> ${semTrat} pendência${semTrat > 1 ? 's' : ''} sem tratamento.</span></div>` : ''}
                ${podeSubmeter ? `<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2"><i class="fa-solid fa-check-circle text-green-600 mt-0.5"></i><span>Critérios mínimos de submissão atendidos. O snapshot do encerramento será congelado ao submeter.</span></div>` : ''}
                <div class="flex justify-end gap-2">
                    ${podeSubmeter ? `<button onclick="_encSubmeterEncerramento()" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800"><i class="fa-solid fa-paper-plane mr-1"></i>Submeter encerramento</button>` : ''}
                    ${estado === 'CLOSURE_REVIEW' ? `
                        <button onclick="_encDecidirEncerramento('AJUSTE')" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Solicitar ajuste</button>
                        <button onclick="_encDecidirEncerramento('APROVADO')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800"><i class="fa-solid fa-check mr-1"></i>Aprovar encerramento</button>` : ''}
                </div>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: REABERTURA (CMP-01, RF-06)
// -------------------------------------------------------------------------
function _encRenderReabertura() {
    const el = document.getElementById('encBody_enc_reabertura');
    if (!el || !_encProjetoAtual) return;
    const p = _encProjetoAtual;
    const estado = (p.enc_estado || 'CLOSING').toUpperCase();
    const encerrado = estado === 'CLOSED';

    el.innerHTML = `
        <div class="space-y-3">
            <div class="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex gap-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0"></i>
                <div>
                    <b>A reabertura de um projeto encerrado é permitida apenas em situações excepcionais, com autorização específica.</b>
                    <span class="ml-1">O encerramento anterior é preservado como ciclo 1; o novo fechamento vira ciclo 2.</span>
                </div>
            </div>
            ${encerrado ? `
                <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 class="text-sm font-bold text-gray-800">Pedido de reabertura</h3>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo de reabertura</label>
                        <select id="encReopenTipo" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                            <option value="CORREÇÃO">Correção pós-produção</option>
                            <option value="NOVO_ESCOPO">Novo escopo</option>
                            <option value="OUTRO">Outro</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Justificativa</label>
                        <textarea id="encReopenJustificativa" rows="3" placeholder="Descreva a situação excepcional que motiva a reabertura..."
                            class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5 resize-none"></textarea>
                    </div>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2 items-start">
                        <i class="fa-solid fa-magnifying-glass text-blue-500 mt-0.5 flex-shrink-0"></i>
                        <div>
                            <b>Impact Preview (RAV-02):</b> antes de enviar para aprovação, o sistema calculará a etapa de destino, efeito em orçamento e FY, contratos, prazo e itens publicados no Knowledge.
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Autoridade responsável</label>
                        <input type="text" id="encReopenAutoridade" placeholder="Nome ou cargo da autoridade com alçada para este impacto"
                            class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                    </div>
                    <div class="flex justify-end gap-2">
                        <button onclick="_encGerarImpactPreview()" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                            <i class="fa-solid fa-magnifying-glass mr-1"></i>Gerar análise de impacto
                        </button>
                        <button onclick="_encEnviarReabertura()" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                            Enviar para aprovação
                        </button>
                    </div>
                </div>` : `
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-xs text-gray-400">
                    <i class="fa-solid fa-lock text-3xl mb-3 opacity-30"></i>
                    <p>A aba de reabertura fica disponível somente quando o project está no estado "Encerrado".</p>
                </div>`}
        </div>`;
}

// -------------------------------------------------------------------------
// AÇÕES
// -------------------------------------------------------------------------
async function _encSelecionarTratamento(pendId, tratamento) {
    if (!_encProjetoAtual) return;
    const pend = _encPendencias.find(p => String(p.id) === String(pendId));
    if (!pend) return;

    let justificativa = '';
    let novoResp = '';
    if (tratamento === 'CANCELAR') {
        justificativa = prompt('Justificativa para cancelar (obrigatório):');
        if (!justificativa) return;
    } else if (tratamento === 'TRANSFERIR') {
        novoResp = prompt('Novo responsável (aceite exigido):');
        if (!novoResp) return;
    }

    const novoStatus = tratamento === 'TRANSFERIR' ? 'PENDENTE_ACEITE' : 'TRATADO';
    try {
        await _supabase.from('encerramento_pendencias').update({
            tratamento, tratamento_justificativa: justificativa || null,
            tratamento_novo_resp: novoResp || null, status: novoStatus,
            atualizado_por: currentUser?.email || '', atualizado_em: new Date().toISOString(),
        }).eq('id', pendId);
        await _encCarregarDados();
        mudarAbaEncerramento('enc_pendencias');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _encAdicionarPendencia() {
    if (!_encProjetoAtual) return;
    const tipoOpts = Object.keys(TIPO_LABEL);
    const tipoIdx = parseInt(prompt(`Tipo de pendência:\n${tipoOpts.map((t, i) => `${i + 1}. ${TIPO_LABEL[t]}`).join('\n')}\n\nDigite o número:`), 10) - 1;
    if (isNaN(tipoIdx) || tipoIdx < 0 || tipoIdx >= tipoOpts.length) return;
    const tipo = tipoOpts[tipoIdx];
    const desc = prompt('Descrição:');
    if (!desc) return;
    const resp = prompt('Responsável original:') || '';
    try {
        await _supabase.from('encerramento_pendencias').insert({
            projeto_codigo: _encProjetoAtual.codigo,
            tipo, descricao: desc, responsavel_original: resp,
            status: 'SEM_TRATAMENTO',
        });
        await _encCarregarDados();
        mudarAbaEncerramento('enc_pendencias');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _encSubmeterEncerramento() {
    if (!_encProjetoAtual) return;
    if (!confirm('Submeter encerramento? O snapshot será congelado e enviado ao aprovador.')) return;
    try {
        await _supabase.from('projetos').update({ enc_estado: 'CLOSURE_REVIEW' }).eq('codigo', _encProjetoAtual.codigo);
        _encProjetoAtual = { ..._encProjetoAtual, enc_estado: 'CLOSURE_REVIEW' };
        const idx = projectsData.findIndex(p => p.codigo === _encProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], enc_estado: 'CLOSURE_REVIEW' };
        mudarAbaEncerramento('enc_aprovacao');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _encDecidirEncerramento(tipo) {
    if (!_encProjetoAtual) return;
    if (tipo === 'AJUSTE') {
        const motivo = prompt('Motivo do ajuste solicitado (obrigatório):');
        if (!motivo) return;
        await _supabase.from('projetos').update({ enc_estado: 'CLOSING' }).eq('codigo', _encProjetoAtual.codigo);
        _encProjetoAtual = { ..._encProjetoAtual, enc_estado: 'CLOSING' };
        const idx = projectsData.findIndex(p => p.codigo === _encProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], enc_estado: 'CLOSING' };
        mudarAbaEncerramento('enc_resumo');
    } else {
        if (!confirm('Aprovar o encerramento? O project inteiro ficará somente leitura.')) return;
        try {
            await _supabase.from('projetos').update({
                enc_estado: 'CLOSED',
                etapa_atual: 'CONCLUIDO',
                sub_status: 'ENCERRADO',
            }).eq('codigo', _encProjetoAtual.codigo);
            _encProjetoAtual = { ..._encProjetoAtual, enc_estado: 'CLOSED', etapa_atual: 'CONCLUIDO' };
            const idx = projectsData.findIndex(p => p.codigo === _encProjetoAtual.codigo);
            if (idx >= 0) projectsData[idx] = { ...projectsData[idx], enc_estado: 'CLOSED', etapa_atual: 'CONCLUIDO' };
            mudarAbaEncerramento('enc_aprovacao');
        } catch (err) {
            alert('Erro: ' + (err.message || JSON.stringify(err)));
        }
    }
}

function _encGerarImpactPreview() {
    const justificativa = document.getElementById('encReopenJustificativa')?.value;
    if (!justificativa) { alert('Preencha a justificativa antes de gerar a análise.'); return; }
    alert('Impact Preview (RAV-02):\n\n• Etapa de destino: Execução\n• Efeito no FY: manter alocação atual\n• Contratos: verificar saldo\n• Itens publicados no Knowledge: mantidos\n\n(Geração automática real — Fase 6+)');
}

async function _encEnviarReabertura() {
    if (!_encProjetoAtual) return;
    const justificativa = document.getElementById('encReopenJustificativa')?.value;
    const autoridade    = document.getElementById('encReopenAutoridade')?.value;
    if (!justificativa || !autoridade) { alert('Preencha justificativa e autoridade responsável.'); return; }
    if (!confirm('Enviar pedido de reabertura para aprovação?')) return;
    try {
        await _supabase.from('projetos').update({ enc_estado: 'REOPEN_REQUESTED' }).eq('codigo', _encProjetoAtual.codigo);
        _encProjetoAtual = { ..._encProjetoAtual, enc_estado: 'REOPEN_REQUESTED' };
        const idx = projectsData.findIndex(p => p.codigo === _encProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], enc_estado: 'REOPEN_REQUESTED' };
        mudarAbaEncerramento('enc_reabertura');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

// -------------------------------------------------------------------------
// STUBS
// -------------------------------------------------------------------------
function _encRenderStub(aba) {
    const labels = {
        enc_resultados:  { l: 'Resultados',  i: 'fa-chart-bar' },
        enc_documentos:  { l: 'Documentos',  i: 'fa-file-lines' },
        enc_historico:   { l: 'Histórico',   i: 'fa-clock-rotate-left' },
    };
    const info = labels[aba] || { l: aba, i: 'fa-diagram-project' };
    const el = document.getElementById(`encBody_${aba}`);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid ${info.i} text-3xl mb-3 opacity-40"></i>
            <span class="text-sm font-semibold">${info.l}</span>
            <span class="text-xs mt-1">Em desenvolvimento — Fase 6+</span>
        </div>`;
}
