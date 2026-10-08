// =============================================================================
// administracao/adm-integracoes.js — Fase 1A · A6
// SCR-24 VIEWs: adm_integracoes, adm_auditoria
// =============================================================================

// ─── Dispatcher ──────────────────────────────────────────────────────────────
document.addEventListener('adm:view-activated', ({ detail: { tabId } }) => {
    if (tabId === 'adm_integracoes') _admIntLoad();
    if (tabId === 'adm_auditoria')   _admAudLoad();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _admIntQuem() {
    return (typeof currentUser !== 'undefined' && currentUser?.nome) ? currentUser.nome : 'sistema';
}
function _admIntEhAdmin() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario  !== 'undefined' && ehProprietario);
}

// =============================================================================
// VIEW: adm_integracoes — Fila de E-mail + status
// =============================================================================

let _admIntFilaCache = [];

async function _admIntLoad() {
    admSetState('adm_integracoes', 'loading');

    const [{ data: cfgData }, { data: filaData, error: filaErr }] = await Promise.all([
        _supabase.from('config_email_geral').select('*').eq('id', 1).maybeSingle(),
        _supabase.from('emails_pendentes').select('*').order('created_at', { ascending: false }).limit(500),
    ]);

    _admIntFilaCache = filaErr ? [] : (filaData || []);
    const cfg = cfgData || {};
    _admIntRender(cfg);
}

function _admIntRender(cfg) {
    const el = admGetContentEl('adm_integracoes');
    if (!el) return;

    const total   = _admIntFilaCache.length;
    const enviados = _admIntFilaCache.filter(e => e.enviado).length;
    const falhas  = _admIntFilaCache.filter(e => !e.enviado && e.erro_ultima_tentativa).length;
    const aguard  = total - enviados - falhas;
    const envioAtivo = cfg.envio_ativo !== false;
    const fmtDt = (d) => d ? (typeof formatDateTime === 'function' ? formatDateTime(d) : d) : '-';
    const podeAlt = _admIntEhAdmin();

    // Header actions
    const actEl = document.getElementById('adm-header-actions-adm_integracoes');
    if (actEl && !actEl.dataset.intInit) {
        actEl.dataset.intInit = '1';
        actEl.innerHTML = `
        <button onclick="_admIntLoad()" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
            border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            <i class="fa-solid fa-rotate"></i>Atualizar</button>`;
    }

    el.innerHTML = `
    <!-- Chave geral + KPIs -->
    <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="p-4 border ${envioAtivo ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} rounded-lg">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-semibold ${envioAtivo ? 'text-green-800' : 'text-red-800'}">Chave Geral de Envio</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${envioAtivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${envioAtivo ? 'LIGADA' : 'DESLIGADA'}</span>
            </div>
            <p class="text-xs text-gray-500 mb-2">Desligada, nenhum e-mail é enfileirado nem enviado, independente das linhas de fluxo.</p>
            ${podeAlt ? `<button onclick="admIntToggleChaveGeral(${!envioAtivo})"
                class="px-2.5 py-1 text-xs font-semibold rounded ${envioAtivo ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}">
                <i class="fa-solid ${envioAtivo ? 'fa-toggle-off' : 'fa-toggle-on'} mr-1"></i>
                ${envioAtivo ? 'Desligar Envio' : 'Ligar Envio'}</button>` : ''}
            ${cfg.atualizado_por ? `<div class="text-[10px] text-gray-400 mt-1">Último ajuste: ${escapeHtml(cfg.atualizado_por)} · ${fmtDt(cfg.atualizado_em)}</div>` : ''}
        </div>
        <div class="grid grid-cols-3 gap-2">
            <div class="p-3 border border-gray-200 rounded-lg text-center">
                <div class="text-xl font-bold text-amber-600">${aguard}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">Aguardando</div>
            </div>
            <div class="p-3 border border-gray-200 rounded-lg text-center">
                <div class="text-xl font-bold text-green-600">${enviados}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">Enviados</div>
            </div>
            <div class="p-3 border border-gray-200 rounded-lg text-center">
                <div class="text-xl font-bold text-red-600">${falhas}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">Com Falha</div>
            </div>
        </div>
    </div>

    <!-- Provedor / Status de integração -->
    <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <i class="fa-solid fa-envelope text-gray-400 text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-700">Provedor de E-mail: EmailJS</div>
            <div class="text-[10px] text-gray-400">Envio via fila assíncrona (<code class="font-mono">emails_pendentes</code>).
                Para editar o fluxo ou os templates, acesse
                <button onclick="switchTab('cfg_eventos')" class="text-indigo-600 underline hover:no-underline">Eventos</button>
                ou
                <button onclick="switchTab('cfg_templates')" class="text-indigo-600 underline hover:no-underline">Templates</button>.
            </div>
        </div>
        ${envioAtivo && aguard > 0 && typeof processarFilaEmailPendente === 'function' ? `
        <button onclick="admIntProcessarFila()" class="flex-shrink-0 px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-paper-plane mr-1"></i>Processar Fila (${aguard})</button>` : ''}
    </div>

    <!-- Filtro de status + tabela -->
    <div class="flex items-center gap-2 mb-3">
        <span class="text-xs text-gray-500 font-semibold">Mostrar:</span>
        <div class="flex gap-1">
            ${['todos','aguardando','enviados','falhas'].map(f =>
                `<button onclick="admIntFiltrarStatus('${f}', this)"
                    data-filtro="${f}"
                    class="adm-int-filtro-btn px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors
                        ${f === 'todos' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}">
                    ${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
            ).join('')}
        </div>
        <span class="text-[10px] text-gray-400 ml-auto">Exibindo últimas 500 entradas</span>
    </div>
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-xs">
            <thead><tr class="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2 text-left font-medium">Gerado em</th>
                <th class="px-3 py-2 text-left font-medium">Destinatário</th>
                <th class="px-3 py-2 text-left font-medium">Assunto</th>
                <th class="px-3 py-2 text-left font-medium">Etapa/Evento</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
            </tr></thead>
            <tbody id="adm-int-fila-tbody" class="divide-y divide-gray-100">
                ${_admIntLinhas('todos')}
            </tbody>
        </table>
    </div>`;

    admSetState('adm_integracoes', total ? 'content' : 'empty');
}

function _admIntLinhas(filtro) {
    let lista = _admIntFilaCache;
    if (filtro === 'aguardando') lista = lista.filter(e => !e.enviado && !e.erro_ultima_tentativa);
    if (filtro === 'enviados')   lista = lista.filter(e => e.enviado);
    if (filtro === 'falhas')     lista = lista.filter(e => !e.enviado && e.erro_ultima_tentativa);

    if (!lista.length) return `<tr><td colspan="5" class="py-6 text-center text-gray-400 text-xs italic">Nenhum registro com este filtro.</td></tr>`;

    return lista.slice(0, 200).map(e => {
        const ctx = e.contexto || {};
        const fmtDt = (d) => d ? (typeof formatDateTime === 'function' ? formatDateTime(d) : new Date(d).toLocaleString('pt-BR')) : '-';
        let badge;
        if (e.enviado) {
            badge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Enviado</span>';
        } else if (e.erro_ultima_tentativa) {
            badge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700" title="${escapeHtml(e.erro_ultima_tentativa)}">Falhou (${e.tentativas || 1}x)</span>`;
        } else {
            badge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Aguardando</span>';
        }
        return `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 font-mono text-[10px] text-gray-500 whitespace-nowrap">${fmtDt(e.created_at)}</td>
            <td class="px-3 py-2 max-w-[180px]">
                <div class="truncate font-semibold text-gray-700">${escapeHtml(e.destinatario_nome || '')}</div>
                <div class="truncate text-gray-400">${escapeHtml(e.destinatario_email || '')}</div>
            </td>
            <td class="px-3 py-2 max-w-[220px] truncate text-gray-700">${escapeHtml(e.assunto || '-')}</td>
            <td class="px-3 py-2 text-gray-500">
                <div>${escapeHtml(ctx.etapa || '-')}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(ctx.quando_dispara || '')}</div>
            </td>
            <td class="px-3 py-2">${badge}</td>
        </tr>`;
    }).join('');
}

function admIntFiltrarStatus(filtro, btn) {
    document.querySelectorAll('.adm-int-filtro-btn').forEach(b => {
        const isActive = b.dataset.filtro === filtro;
        b.className = b.className.replace(
            /bg-indigo-600 text-white border-indigo-600|bg-white text-gray-600 border-gray-300/,
            isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
        );
    });
    const tbody = document.getElementById('adm-int-fila-tbody');
    if (tbody) tbody.innerHTML = _admIntLinhas(filtro);
}

async function admIntToggleChaveGeral(ligar) {
    if (!_admIntEhAdmin()) return alert('Sem permissão.');
    if (!confirm(ligar
        ? 'Confirmar: LIGAR o envio de e-mail no sistema inteiro?'
        : 'Confirmar: DESLIGAR o envio de e-mail? Nenhum e-mail novo será enfileirado nem enviado.')) return;
    const { error } = await _supabase.from('config_email_geral').update({
        envio_ativo: ligar, atualizado_por: _admIntQuem(), atualizado_em: new Date().toISOString()
    }).eq('id', 1);
    if (error) return alert('Erro: ' + error.message);
    if (typeof carregarConfigEmailGeral === 'function') await carregarConfigEmailGeral();
    _admIntLoad();
}

async function admIntProcessarFila() {
    if (!_admIntEhAdmin()) return alert('Sem permissão.');
    if (typeof processarFilaEmailPendente === 'function') {
        await processarFilaEmailPendente();
        await _admIntLoad();
    } else {
        alert('Função de envio não disponível.');
    }
}

// =============================================================================
// VIEW: adm_auditoria — audit_events
// =============================================================================

const _ADM_AUD_PAGE = 100;
let _admAudOffset  = 0;
let _admAudTotal   = 0;
let _admAudLoaded  = 0;

const _ADM_AUD_ACOES = ['CRIADO','PROJECT_CRIADO','FASE_ALTERADA','STATUS_ALTERADO','ORCAMENTO_ALTERADO','BLOQUEIO_ALTERADO'];
const _ADM_AUD_BADGE = {
    CRIADO:              'bg-gray-100 text-gray-700',
    PROJECT_CRIADO:      'bg-indigo-100 text-indigo-700',
    FASE_ALTERADA:       'bg-indigo-100 text-indigo-700',
    STATUS_ALTERADO:     'bg-amber-100 text-amber-700',
    ORCAMENTO_ALTERADO:  'bg-emerald-100 text-emerald-700',
    BLOQUEIO_ALTERADO:   'bg-red-100 text-red-700',
};
const _ADM_AUD_LABEL = {
    CRIADO:              'Criado',
    PROJECT_CRIADO:      'Project criado',
    FASE_ALTERADA:       'Fase alterada',
    STATUS_ALTERADO:     'Status alterado',
    ORCAMENTO_ALTERADO:  'Orçamento alterado',
    BLOQUEIO_ALTERADO:   'Bloqueio alterado',
};

async function _admAudLoad() {
    admSetState('adm_auditoria', 'loading');
    _admAudOffset = 0;
    _admAudTotal  = 0;
    _admAudLoaded = 0;
    _admAudRenderShell();
    await _admAudBuscar(false);
}

function _admAudRenderShell() {
    const el = admGetContentEl('adm_auditoria');
    if (!el) return;

    const actEl = document.getElementById('adm-header-actions-adm_auditoria');
    if (actEl && !actEl.dataset.audInit) {
        actEl.dataset.audInit = '1';
        actEl.innerHTML = `
        <button onclick="admAudExportarCSV()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                   border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            <i class="fa-solid fa-download"></i>Exportar CSV</button>`;
    }

    const acoesOpts = `<option value="">Todas as ações</option>` +
        _ADM_AUD_ACOES.map(a => `<option value="${a}">${_ADM_AUD_LABEL[a] || a}</option>`).join('');

    el.innerHTML = `
    <!-- Filtros -->
    <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
        <div class="grid grid-cols-5 gap-2 items-end">
            <div>
                <label class="block text-[10px] font-medium text-gray-500 mb-1">Código/Projeto</label>
                <input id="adm-aud-filtro-codigo" type="text" placeholder="ex.: BC-2025-001"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-[10px] font-medium text-gray-500 mb-1">Ação</label>
                <select id="adm-aud-filtro-acao"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400">
                    ${acoesOpts}
                </select>
            </div>
            <div>
                <label class="block text-[10px] font-medium text-gray-500 mb-1">De</label>
                <input id="adm-aud-filtro-de" type="date"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-[10px] font-medium text-gray-500 mb-1">Até</label>
                <input id="adm-aud-filtro-ate" type="date"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-[10px] font-medium text-gray-500 mb-1">Usuário</label>
                <input id="adm-aud-filtro-usuario" type="text" placeholder="nome do usuário"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <div class="flex gap-2 mt-2">
            <button onclick="admAudFiltrar()"
                class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                <i class="fa-solid fa-magnifying-glass mr-1"></i>Filtrar</button>
            <button onclick="admAudLimparFiltros()"
                class="px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
                Limpar</button>
            <span id="adm-aud-count" class="ml-auto text-[10px] text-gray-400 self-center"></span>
        </div>
    </div>

    <!-- Tabela -->
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-xs">
            <thead><tr class="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2 text-left font-medium whitespace-nowrap">Data / Hora</th>
                <th class="px-3 py-2 text-left font-medium">Projeto</th>
                <th class="px-3 py-2 text-left font-medium">Ação</th>
                <th class="px-3 py-2 text-left font-medium">Campo</th>
                <th class="px-3 py-2 text-left font-medium">Alteração</th>
                <th class="px-3 py-2 text-left font-medium">Usuário</th>
                <th class="px-3 py-2 text-left font-medium">Origem</th>
            </tr></thead>
            <tbody id="adm-aud-tbody" class="divide-y divide-gray-100">
                <tr><td colspan="7" class="py-10 text-center text-gray-400 text-xs">Carregando…</td></tr>
            </tbody>
        </table>
    </div>
    <div id="adm-aud-load-more" class="hidden text-center mt-3">
        <button onclick="admAudCarregarMais()"
            class="px-4 py-1.5 text-xs font-semibold border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            <i class="fa-solid fa-chevron-down mr-1"></i>Carregar mais</button>
    </div>`;
    admSetState('adm_auditoria', 'content');
}

function _admAudLerFiltros() {
    return {
        codigo:  ((document.getElementById('adm-aud-filtro-codigo') || {}).value || '').trim().toUpperCase(),
        acao:    (document.getElementById('adm-aud-filtro-acao') || {}).value || '',
        de:      (document.getElementById('adm-aud-filtro-de') || {}).value || '',
        ate:     (document.getElementById('adm-aud-filtro-ate') || {}).value || '',
        usuario: ((document.getElementById('adm-aud-filtro-usuario') || {}).value || '').trim(),
    };
}

async function _admAudBuscar(acumular) {
    const tbody = document.getElementById('adm-aud-tbody');
    const loadMore = document.getElementById('adm-aud-load-more');
    const countEl = document.getElementById('adm-aud-count');
    if (!tbody) return;

    const f = _admAudLerFiltros();
    let q = _supabase
        .from('audit_events')
        .select('*', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(_admAudOffset, _admAudOffset + _ADM_AUD_PAGE - 1);

    if (f.codigo)  q = q.ilike('entidade_id', `%${f.codigo}%`);
    if (f.acao)    q = q.eq('acao', f.acao);
    if (f.de)      q = q.gte('criado_em', f.de + 'T00:00:00');
    if (f.ate)     q = q.lte('criado_em', f.ate + 'T23:59:59');
    if (f.usuario) q = q.ilike('usuario', `%${f.usuario}%`);

    const { data, error, count } = await q;
    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-500 text-xs font-semibold">Erro ao carregar: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    const eventos = data || [];
    _admAudTotal  = count || 0;
    _admAudLoaded = acumular ? _admAudLoaded + eventos.length : eventos.length;
    _admAudOffset += eventos.length;

    const linhas = eventos.map(ev => {
        const badge = _ADM_AUD_BADGE[ev.acao] || 'bg-gray-100 text-gray-600';
        const label = _ADM_AUD_LABEL[ev.acao] || ev.acao;
        const seta = (ev.valor_anterior || ev.valor_novo)
            ? `<span class="text-gray-400">${escapeHtml(ev.valor_anterior || '—')}</span> <i class="fa-solid fa-arrow-right text-[9px] text-gray-300 mx-0.5"></i> <span class="font-semibold">${escapeHtml(ev.valor_novo || '—')}</span>`
            : '—';
        const fmtDt = (d) => d ? new Date(d).toLocaleString('pt-BR') : '-';
        const origemBadge = ev.origem === 'app'
            ? '<span class="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold text-[9px]">app</span>'
            : '<span class="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold text-[9px]">trigger</span>';
        return `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 font-mono text-[10px] text-gray-500 whitespace-nowrap">${fmtDt(ev.criado_em)}</td>
            <td class="px-3 py-2 font-mono font-semibold text-indigo-700 text-[11px]">${escapeHtml(ev.entidade_id || '-')}</td>
            <td class="px-3 py-2"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${badge}">${label}</span></td>
            <td class="px-3 py-2 text-gray-500">${escapeHtml(ev.campo || '—')}</td>
            <td class="px-3 py-2">${seta}</td>
            <td class="px-3 py-2 text-gray-600">${escapeHtml(ev.usuario || '—')}</td>
            <td class="px-3 py-2">${origemBadge}</td>
        </tr>`;
    }).join('');

    if (acumular) {
        tbody.innerHTML += linhas;
    } else {
        tbody.innerHTML = linhas || `<tr><td colspan="7" class="py-8 text-center text-gray-400 text-xs italic">Nenhum evento encontrado com esses filtros.</td></tr>`;
    }

    if (countEl) countEl.textContent = `${_admAudLoaded} de ${_admAudTotal} evento(s)`;
    if (loadMore) loadMore.classList.toggle('hidden', _admAudLoaded >= _admAudTotal);
}

function admAudFiltrar() {
    _admAudOffset = 0;
    _admAudLoaded = 0;
    _admAudBuscar(false);
}

function admAudCarregarMais() {
    _admAudBuscar(true);
}

function admAudLimparFiltros() {
    ['adm-aud-filtro-codigo','adm-aud-filtro-acao','adm-aud-filtro-de',
     'adm-aud-filtro-ate','adm-aud-filtro-usuario'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    admAudFiltrar();
}

function admAudExportarCSV() {
    const tbody = document.getElementById('adm-aud-tbody');
    if (!tbody) return;
    const rows = [['Data/Hora','Projeto','Ação','Campo','Anterior','Novo','Usuário','Origem']];
    tbody.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 7) return;
        // Coluna 4 (alteração): split em anterior/novo via arrow icon
        const altTexto = tds[4].textContent.replace(/→/g, '|').trim();
        const [ant, nov] = altTexto.split('|').map(s => s.trim());
        rows.push([
            tds[0].textContent.trim(),
            tds[1].textContent.trim(),
            tds[2].textContent.trim(),
            tds[3].textContent.trim(),
            ant || '',
            nov || '',
            tds[5].textContent.trim(),
            tds[6].textContent.trim(),
        ]);
    });
    if (typeof exportarCSV === 'function') {
        exportarCSV(rows[0], rows.slice(1), 'auditoria_compasso');
    } else {
        // Fallback manual
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
        a.download = `auditoria_compasso_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    }
}
