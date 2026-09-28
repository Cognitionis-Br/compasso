// =========================================================================
// governanca/auditoria.js
// Compasso V9 — Auditoria / Compliance (M16, 2026-09-28).
// Lê `audit_events` (populado por triggers em business_cases/projects e,
// futuramente, por chamadas diretas do cliente). Fornece filtros, timeline
// tabular, paginação (100 por página) e exportação CSV.
// =========================================================================

const AUDIT_PAGE_SIZE = 100;
let _auditOffset = 0;
let _auditFiltros = { codigo: '', acao: '', de: '', ate: '', usuario: '' };
let _auditTotalCarregado = 0;

const AUDIT_ACOES = ['CRIADO', 'PROJECT_CRIADO', 'FASE_ALTERADA', 'STATUS_ALTERADO',
    'ORCAMENTO_ALTERADO', 'BLOQUEIO_ALTERADO'];

const AUDIT_BADGE = {
    CRIADO:              'bg-gray-100 text-gray-700',
    PROJECT_CRIADO:      'bg-indigo-100 text-indigo-700',
    FASE_ALTERADA:       'bg-indigo-100 text-indigo-700',
    STATUS_ALTERADO:     'bg-amber-100 text-amber-700',
    ORCAMENTO_ALTERADO:  'bg-emerald-100 text-emerald-700',
    BLOQUEIO_ALTERADO:   'bg-danger-100 text-danger-700',
};

const AUDIT_LABEL = {
    CRIADO:              'Criado',
    PROJECT_CRIADO:      'Project criado',
    FASE_ALTERADA:       'Fase alterada',
    STATUS_ALTERADO:     'Status alterado',
    ORCAMENTO_ALTERADO:  'Orçamento alterado',
    BLOQUEIO_ALTERADO:   'Bloqueio alterado',
};

async function renderAuditoriaView() {
    _auditOffset = 0;
    _auditTotalCarregado = 0;
    _auditLerFiltros();
    await _auditCarregarPagina(false);
}

function _auditLerFiltros() {
    _auditFiltros = {
        codigo:  ((document.getElementById('auditFiltroCodigo') || {}).value || '').trim().toUpperCase(),
        acao:    (document.getElementById('auditFiltroAcao') || {}).value || '',
        de:      (document.getElementById('auditFiltroDe') || {}).value || '',
        ate:     (document.getElementById('auditFiltroAte') || {}).value || '',
        usuario: ((document.getElementById('auditFiltroUsuario') || {}).value || '').trim(),
    };
}

async function _auditCarregarPagina(acumular) {
    const tbody = document.getElementById('auditTableBody');
    const loadMore = document.getElementById('auditLoadMore');
    const countEl = document.getElementById('auditCount');
    if (!tbody) return;

    if (!acumular) tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-400 text-xs">Carregando...</td></tr>';

    let q = _supabase
        .from('audit_events')
        .select('*', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(_auditOffset, _auditOffset + AUDIT_PAGE_SIZE - 1);

    if (_auditFiltros.codigo) q = q.ilike('entidade_id', `%${_auditFiltros.codigo}%`);
    if (_auditFiltros.acao)   q = q.eq('acao', _auditFiltros.acao);
    if (_auditFiltros.de)     q = q.gte('criado_em', _auditFiltros.de + 'T00:00:00');
    if (_auditFiltros.ate)    q = q.lte('criado_em', _auditFiltros.ate + 'T23:59:59');
    if (_auditFiltros.usuario) q = q.ilike('usuario', `%${_auditFiltros.usuario}%`);

    const { data, error, count } = await q;

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-danger-600 text-xs font-bold">Erro ao carregar: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    const eventos = data || [];
    _auditTotalCarregado = acumular ? _auditTotalCarregado + eventos.length : eventos.length;
    _auditOffset += eventos.length;

    const linhas = eventos.map(ev => {
        const badge = AUDIT_BADGE[ev.acao] || 'bg-gray-100 text-gray-600';
        const label = AUDIT_LABEL[ev.acao] || ev.acao;
        const seta = (ev.valor_anterior || ev.valor_novo)
            ? `<span class="text-gray-400">${escapeHtml(ev.valor_anterior || '—')}</span> → <span class="font-bold">${escapeHtml(ev.valor_novo || '—')}</span>`
            : '—';
        return `
            <tr class="border-t border-gray-100 hover:bg-gray-50">
                <td class="p-2 text-[11px] text-gray-500 tabular-nums whitespace-nowrap">${new Date(ev.criado_em).toLocaleString('pt-BR')}</td>
                <td class="p-2 font-mono text-xs font-bold text-indigo-700">${escapeHtml(ev.entidade_id)}</td>
                <td class="p-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badge}">${label}</span></td>
                <td class="p-2 text-xs text-gray-500">${escapeHtml(ev.campo || '—')}</td>
                <td class="p-2 text-xs">${seta}</td>
                <td class="p-2 text-xs text-gray-600">${escapeHtml(ev.usuario || '—')}</td>
                <td class="p-2 text-[10px] text-gray-400">${ev.origem === 'app' ? '<span class="bg-blue-50 text-blue-600 px-1 rounded font-bold">app</span>' : '<span class="bg-gray-100 text-gray-500 px-1 rounded">trigger</span>'}</td>
            </tr>`;
    }).join('');

    if (acumular) {
        tbody.innerHTML += linhas;
    } else {
        tbody.innerHTML = linhas || '<tr><td colspan="7" class="p-4 text-center text-gray-400 text-xs italic">Nenhum evento encontrado com esses filtros.</td></tr>';
    }

    const total = count || 0;
    if (countEl) countEl.textContent = `${_auditTotalCarregado} de ${total} evento(s)`;
    if (loadMore) {
        loadMore.classList.toggle('hidden', _auditTotalCarregado >= total);
    }
}

async function auditCarregarMais() {
    _auditLerFiltros();
    await _auditCarregarPagina(true);
}

function auditFiltrar() {
    _auditOffset = 0;
    _auditTotalCarregado = 0;
    _auditLerFiltros();
    _auditCarregarPagina(false);
}

function auditLimparFiltros() {
    ['auditFiltroCodigo', 'auditFiltroAcao', 'auditFiltroDe', 'auditFiltroAte', 'auditFiltroUsuario'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    auditFiltrar();
}

function auditExportarCSV() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    const rows = [['Data/Hora', 'Projeto', 'Ação', 'Campo', 'Anterior', 'Novo', 'Usuário', 'Origem']];
    tbody.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 7) return;
        rows.push([
            tds[0].textContent.trim(),
            tds[1].textContent.trim(),
            tds[2].textContent.trim(),
            tds[3].textContent.trim(),
            // valores anterior/novo: strip seta
            tds[4].textContent.replace('→', '→').trim(),
            '',
            tds[5].textContent.trim(),
            tds[6].textContent.trim(),
        ]);
    });

    if (typeof exportarCSV === 'function') {
        exportarCSV(rows[0], rows.slice(1).map(r => r.slice(0, rows[0].length)), 'auditoria_compasso');
    }
}
