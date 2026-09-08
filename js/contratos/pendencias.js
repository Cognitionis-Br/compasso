// =========================================================================
// contratos/pendencias.js   (Release 1 — módulo FINANCEIRO)
// Pendências de Contratos e Terceiros — área de staging (§3 da spec
// spec-contratos-terceiros.md). Toda entrada (lançamento MANUAL ou upload
// de planilha Excel — UPLOAD_EXCEL; e-mail fica pra Fase C) cai em
// contratos_pendencias como PENDENTE e só vai para a base oficial
// (contratos_pagamentos / contratos_propostas) depois de APROVADA aqui.
//
// Tabelas: contratos_pendencias, contratos_pendencias_anexos,
// contratos_propostas, log_contratos_pendencias (ver
// sql/2026-09-08_contratos_pendencias.sql). Anexos no bucket privado
// 'contratos-anexos' (sql/2026-09-08_storage_contratos_anexos.sql).
//
// RBAC: contratos_pendencias:{consultar|importar|aprovar}.
// =========================================================================

let pendenciasContratosCache = [];
let pendVinculosCache = [];      // contratos_vinculos_projeto (p/ resolver PAGAMENTO)
let pendenciaAtual = null;       // pendência aberta no modal de detalhe
let pendImportErros = [];        // relatório do último upload de planilha

const PEND_BUCKET = 'contratos-anexos';
const PEND_NF_ATRASO_DIAS_UTEIS = 5;   // §6 — escalonamento visual na Fase A

// -------------------------------------------------------------------------
// Permissões
// -------------------------------------------------------------------------
function _pendPodeVer() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('contratos_pendencias:consultar'));
}
function _pendPodeImportar() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioPodeIncluir === 'function' && usuarioPodeIncluir('contratos_pendencias:importar'));
}
function _pendPodeAprovar() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('contratos_pendencias:aprovar'));
}

// -------------------------------------------------------------------------
// Utilidades
// -------------------------------------------------------------------------
function _pendUuid() {
    return (self.crypto && self.crypto.randomUUID) ? self.crypto.randomUUID()
        : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function _pendDiasUteisDesde(iso) {
    if (!iso) return 0;
    const ini = new Date(String(iso).split('T')[0] + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let dias = 0;
    const d = new Date(ini);
    while (d < hoje) {
        d.setDate(d.getDate() + 1);
        const wd = d.getDay();
        if (wd !== 0 && wd !== 6) dias++;   // v1: só exclui fim de semana (sem feriados)
    }
    return dias;
}
function _pendEmAtrasoNf(p) {
    return p.status === 'PENDENTE' && p.nf_status === 'NAO_RECEBIDA' &&
           _pendDiasUteisDesde(p.criado_em) > PEND_NF_ATRASO_DIAS_UTEIS;
}

async function _logPendencia(pendenciaId, acao, detalhe) {
    await _supabase.from('log_contratos_pendencias').insert([{
        pendencia_id: pendenciaId,
        acao,
        por: currentUser ? currentUser.nome : 'desconhecido',
        detalhe: detalhe || null
    }]);
}

async function _signedUrlAnexo(path) {
    const { data } = await _supabase.storage.from(PEND_BUCKET).createSignedUrl(path, 300);
    return data ? data.signedUrl : null;
}

// contrato pelo número (texto cru vindo da planilha/e-mail)
function _pendResolverContrato(txt) {
    if (!txt) return null;
    const alvo = String(txt).trim().toUpperCase();
    const c = (contratosProjetoCache || []).find(x => String(x.numero_contrato || '').trim().toUpperCase() === alvo);
    return c || null;
}
// vínculo (contrato x projeto) — só resolve automático quando é único
function _pendResolverVinculo(contratoId, projetoCodigo) {
    if (!contratoId || !projetoCodigo) return null;
    const vs = (pendVinculosCache || []).filter(v => v.contrato_id === contratoId && v.projeto_codigo === projetoCodigo);
    return vs.length === 1 ? vs[0] : null;
}
function saldoDisponivelVinculo(v) {
    return Number(v.valor_vinculo || 0) - Number(v.valor_realizado || 0);
}
function _pendSomaPropostasContrato(contratoId, exclProstaId) {
    // usa cache local carregado no render (propostasContratoCache)
    return (window._pendPropostasCache || [])
        .filter(pr => pr.contrato_id === contratoId && pr.id !== exclProstaId)
        .reduce((acc, pr) => acc + Number(pr.valor || 0), 0);
}

// -------------------------------------------------------------------------
// Abas
// -------------------------------------------------------------------------
function mudarAbaPendencias(aba) {
    ['lista', 'importar'].forEach(a => {
        const btn = document.getElementById(`pendContratosBtn-${a}`);
        const painel = document.getElementById(`pendContratosPainel-${a}`);
        if (btn) btn.className = `pend-contratos-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
}

// -------------------------------------------------------------------------
// Render principal
// -------------------------------------------------------------------------
async function renderPendenciasContratosView() {
    const restrito = document.getElementById('pendContratosRestrito');
    const conteudo = document.getElementById('pendContratosConteudo');
    const podeVer = _pendPodeVer();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    // botão de importar / lançar manual só p/ quem tem o verbo
    const btnImportar = document.getElementById('pendContratosBtn-importar');
    if (btnImportar) btnImportar.classList.toggle('hidden', !_pendPodeImportar());

    const [{ data: pend }, { data: vinc }, { data: contr }, { data: emp }, { data: prop }] = await Promise.all([
        _supabase.from('contratos_pendencias').select('*').order('criado_em', { ascending: false }),
        _supabase.from('contratos_vinculos_projeto').select('*'),
        _supabase.from('contratos_projeto').select('*'),
        _supabase.from('empresas_terceirizadas').select('*'),
        _supabase.from('contratos_propostas').select('id, contrato_id, valor')
    ]);
    pendenciasContratosCache = pend || [];
    pendVinculosCache = vinc || [];
    contratosProjetoCache = contr || contratosProjetoCache || [];
    empresasTerceirizadasCache = emp || empresasTerceirizadasCache || [];
    window._pendPropostasCache = prop || [];

    _pendPopularFiltros();
    _pendPopularSelectsManual();
    _pendRenderTabela();
}

function _pendPopularFiltros() {
    const selContrato = document.getElementById('pendFiltroContrato');
    if (selContrato) {
        selContrato.innerHTML = '<option value="">Todos os contratos</option>' +
            (contratosProjetoCache || []).map(c => `<option value="${c.id}">${escapeHtml(c.numero_contrato)}</option>`).join('');
    }
}

function _pendFiltrarLista() {
    const fOrigem = (document.getElementById('pendFiltroOrigem') || {}).value || '';
    const fStatus = (document.getElementById('pendFiltroStatus') || {}).value || 'ABERTAS';
    const fNf = (document.getElementById('pendFiltroNf') || {}).value || '';
    const fContrato = (document.getElementById('pendFiltroContrato') || {}).value || '';
    const fProjeto = ((document.getElementById('pendFiltroProjeto') || {}).value || '').trim().toUpperCase();
    const fDe = (document.getElementById('pendFiltroDataDe') || {}).value || '';
    const fAte = (document.getElementById('pendFiltroDataAte') || {}).value || '';

    return pendenciasContratosCache.filter(p => {
        if (fOrigem && p.origem !== fOrigem) return false;
        if (fStatus === 'ABERTAS' && !(p.status === 'PENDENTE' || p.status === 'ERRO_LEITURA')) return false;
        if (fStatus !== 'ABERTAS' && fStatus !== 'TODAS' && p.status !== fStatus) return false;
        if (fNf && p.nf_status !== fNf) return false;
        if (fContrato && String(p.contrato_id || '') !== fContrato) return false;
        if (fProjeto && !((p.projeto_codigo || p.projeto_ref || '').toUpperCase().includes(fProjeto))) return false;
        const d = (p.data_referencia || p.criado_em || '').split('T')[0];
        if (fDe && d < fDe) return false;
        if (fAte && d > fAte) return false;
        return true;
    });
}

function aplicarFiltrosPendencias() { _pendRenderTabela(); }

function _pendBadgeStatus(s) {
    return {
        PENDENTE: 'bg-amber-100 text-amber-800',
        ERRO_LEITURA: 'bg-red-100 text-red-800',
        APROVADA: 'bg-green-100 text-green-800',
        REJEITADA: 'bg-gray-200 text-gray-600'
    }[s] || 'bg-gray-100 text-gray-700';
}
function _pendBadgeNf(s) {
    return {
        RECEBIDA: 'bg-green-100 text-green-800',
        NAO_RECEBIDA: 'bg-amber-100 text-amber-800',
        DISPENSADA: 'bg-blue-100 text-blue-800'
    }[s] || 'bg-gray-100 text-gray-700';
}

function _pendRenderTabela() {
    const tbody = document.getElementById('pendContratosTableBody');
    if (!tbody) return;
    const lista = _pendFiltrarLista();

    // resumo
    const resumo = document.getElementById('pendContratosResumo');
    if (resumo) {
        const abertas = pendenciasContratosCache.filter(p => p.status === 'PENDENTE' || p.status === 'ERRO_LEITURA').length;
        const emAtraso = pendenciasContratosCache.filter(_pendEmAtrasoNf).length;
        resumo.innerHTML = `${abertas} pendência(s) em aberto` +
            (emAtraso > 0 ? ` · <span class="text-red-700 font-bold">${emAtraso} com NF pendente há mais de ${PEND_NF_ATRASO_DIAS_UTEIS} dias úteis</span>` : '');
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">Nenhuma pendência para os filtros atuais</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const contrato = (contratosProjetoCache || []).find(c => c.id === p.contrato_id);
        const atraso = _pendEmAtrasoNf(p);
        return `
        <tr class="${atraso ? 'bg-red-50' : ''}">
            <td class="p-2 text-[10px] text-gray-500 whitespace-nowrap">${(p.criado_em || '').replace('T', ' ').split('.')[0]}</td>
            <td class="p-2 font-bold text-xs">${p.tipo}</td>
            <td class="p-2 text-[10px] uppercase text-gray-500">${p.origem}</td>
            <td class="p-2 text-xs">${escapeHtml(contrato ? contrato.numero_contrato : (p.contrato_ref || '—'))}</td>
            <td class="p-2 text-xs">${escapeHtml(p.projeto_codigo || p.projeto_ref || '—')}</td>
            <td class="p-2 text-xs">${escapeHtml(p.fornecedor || '—')}</td>
            <td class="p-2 text-right font-mono text-xs">${p.valor != null ? formatCurrency(p.valor) : '—'}</td>
            <td class="p-2 text-center"><span class="${_pendBadgeNf(p.nf_status)} font-bold px-2 py-0.5 rounded text-[9px]">${p.nf_status}${atraso ? ' ⚠' : ''}</span></td>
            <td class="p-2 text-center">
                <span class="${_pendBadgeStatus(p.status)} font-bold px-2 py-0.5 rounded text-[9px]">${p.status}</span>
                <button onclick="abrirDetalhePendencia(${p.id})" class="ml-2 text-indigo-600 hover:text-indigo-800 font-bold text-[10px] uppercase">Detalhar</button>
            </td>
        </tr>`;
    }).join('');
}

// -------------------------------------------------------------------------
// Modal de detalhe / correção / anexos / decisão
// -------------------------------------------------------------------------
async function abrirDetalhePendencia(id) {
    const p = pendenciasContratosCache.find(x => x.id === id);
    if (!p) return;
    pendenciaAtual = p;

    const { data: anexos } = await _supabase.from('contratos_pendencias_anexos').select('*').eq('pendencia_id', id).order('enviado_em');
    const listaAnexos = anexos || [];

    const podeAprovar = _pendPodeAprovar();
    const editavel = podeAprovar && p.status === 'PENDENTE';
    const optContratos = ['<option value="">— não resolvido —</option>']
        .concat((contratosProjetoCache || []).map(c => `<option value="${c.id}" ${c.id === p.contrato_id ? 'selected' : ''}>${escapeHtml(c.numero_contrato)}</option>`))
        .join('');
    const optProjetos = ['<option value="">— não resolvido —</option>']
        .concat((projectsData || []).map(pr => `<option value="${escapeHtml(pr.codigo)}" ${pr.codigo === p.projeto_codigo ? 'selected' : ''}>${escapeHtml(pr.codigo)} — ${escapeHtml(pr.nome)}</option>`))
        .join('');

    // vínculos (Contratos por Projeto) do contrato resolvido — o pagamento
    // é registrado contra um vínculo (projeto + contrato + valor alocado).
    const vinculosDoContrato = (pendVinculosCache || []).filter(v => v.contrato_id === p.contrato_id);
    const optVinculos = ['<option value="">— nenhum —</option>'].concat(vinculosDoContrato.map(v => {
        const pr = (projectsData || []).find(x => x.codigo === v.projeto_codigo);
        const saldo = Number(v.valor_vinculo || 0) - Number(v.valor_realizado || 0);
        return `<option value="${v.id}" ${v.id === p.vinculo_id ? 'selected' : ''}>${escapeHtml(v.projeto_codigo)}${pr ? ' — ' + escapeHtml(pr.nome) : ''} · alocado ${formatCurrency(v.valor_vinculo)} · saldo ${formatCurrency(saldo)}</option>`;
    })).join('');

    const anexosHtml = listaAnexos.length === 0
        ? '<div class="text-xs text-gray-400 italic">Nenhum anexo.</div>'
        : listaAnexos.map(a => `
            <div class="flex items-center justify-between text-xs border-b border-gray-100 py-1">
                <div>
                    <button onclick="abrirAnexoPendencia('${escapeJsAttr(a.storage_path)}')" class="text-indigo-600 hover:underline font-bold">${escapeHtml(a.nome_original || a.storage_path)}</button>
                    <span class="ml-2 ${a.classificacao === 'NOTA_FISCAL' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} px-1.5 py-0.5 rounded text-[9px] font-bold">${a.classificacao}</span>
                </div>
                ${editavel ? `<button onclick="removerAnexoPendencia(${a.id})" class="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase">Remover</button>` : ''}
            </div>`).join('');

    const errosHtml = (p.erros_leitura && p.erros_leitura.length)
        ? `<div class="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 mb-3"><b>Erros de leitura:</b><ul class="list-disc ml-4">${p.erros_leitura.map(e => `<li>${escapeHtml(e.campo || '')}: ${escapeHtml(e.motivo || '')}</li>`).join('')}</ul></div>`
        : '';

    document.getElementById('pendModalTitulo').innerText = `Pendência #${p.id} — ${p.tipo} (${p.origem})`;
    document.getElementById('pendModalCorpo').innerHTML = `
        ${errosHtml}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Tipo</label>
                <select id="pendEdTipo" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded bg-white">
                    <option value="PAGAMENTO" ${p.tipo === 'PAGAMENTO' ? 'selected' : ''}>PAGAMENTO</option>
                    <option value="PROPOSTA" ${p.tipo === 'PROPOSTA' ? 'selected' : ''}>PROPOSTA</option>
                </select></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Referência (§4.3)</label>
                <input id="pendEdReferencia" value="${escapeHtml(p.referencia || '')}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Contrato ${p.contrato_ref ? `<span class="text-gray-400">(cru: ${escapeHtml(p.contrato_ref)})</span>` : ''}</label>
                <select id="pendEdContrato" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded bg-white">${optContratos}</select></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Projeto ${p.projeto_ref ? `<span class="text-gray-400">(cru: ${escapeHtml(p.projeto_ref)})</span>` : ''}</label>
                <select id="pendEdProjeto" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded bg-white">${optProjetos}</select></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Fornecedor / Terceiro</label>
                <input id="pendEdFornecedor" value="${escapeHtml(p.fornecedor || '')}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Valor</label>
                <input id="pendEdValor" type="number" step="0.01" value="${p.valor != null ? p.valor : ''}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Data de Referência</label>
                <input id="pendEdData" type="date" value="${p.data_referencia || ''}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
            <div class="md:col-span-2"><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Vínculo — Contratos por Projeto <span class="text-gray-400">(obrigatório para PAGAMENTO)</span></label>
                <select id="pendEdVinculo" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded bg-white">${optVinculos}</select>
                ${vinculosDoContrato.length === 0 ? '<span class="text-[10px] text-amber-700">Nenhum vínculo para este contrato — crie em Contratos e Terceiros → Contratos por Projeto.</span>' : ''}</div>
            <div class="md:col-span-2"><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Descrição / Observações</label>
                <input id="pendEdDescricao" value="${escapeHtml(p.descricao || '')}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
        </div>

        <div class="mt-4">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold uppercase text-gray-500">Anexos — status NF: <span class="${_pendBadgeNf(p.nf_status)} px-1.5 py-0.5 rounded font-bold">${p.nf_status}</span></span>
                ${editavel ? `<span class="flex items-center gap-1.5 text-[10px] font-bold">
                    <select id="pendAnexoClasse" class="text-[10px] border rounded p-0.5 bg-white"><option value="NOTA_FISCAL">Nota Fiscal</option><option value="COMPROVANTE">Comprovante</option><option value="OUTRO">Outro</option></select>
                    <button type="button" onclick="document.getElementById('pendAnexoInput').click()" class="text-indigo-600 hover:text-indigo-800 underline">+ Anexar arquivo</button>
                    <input type="file" id="pendAnexoInput" accept="application/pdf,image/jpeg,image/png" onchange="onAnexoPendenciaSelecionado(this)" class="hidden">
                </span>` : ''}
            </div>
            <div id="pendModalAnexos" class="border rounded p-2 bg-gray-50">${anexosHtml}</div>
        </div>

        ${p.justificativa_dispensa_nf ? `<div class="mt-2 text-[11px] text-blue-700 bg-blue-50 rounded p-2"><b>Dispensa de NF:</b> ${escapeHtml(p.justificativa_dispensa_nf)}</div>` : ''}
        ${p.status !== 'PENDENTE' ? `<div class="mt-3 text-[11px] text-gray-600">Decidido por <b class="uppercase">${escapeHtml(p.decidido_por || '-')}</b> em ${(p.decidido_em || '').replace('T', ' ').split('.')[0]}${p.motivo_decisao ? ` — ${escapeHtml(p.motivo_decisao)}` : ''}${p.promovido_para_id ? ` → ${escapeHtml(p.promovido_para_tabela)} #${p.promovido_para_id}` : ''}</div>` : ''}
    `;

    const rodape = document.getElementById('pendModalRodape');
    rodape.innerHTML = editavel ? `
        <button onclick="salvarCorrecaoPendencia()" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold">Salvar Correção</button>
        <button onclick="abrirModalDispensaNf(${p.id})" class="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-bold">Dispensar NF…</button>
        <button onclick="rejeitarPendencia(${p.id})" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-bold">Rejeitar…</button>
        <button onclick="aprovarPendencia(${p.id})" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold">Aprovar</button>
    ` : `<button onclick="fecharModalPendencia()" class="px-3 py-1.5 bg-gray-200 rounded text-xs font-bold">Fechar</button>`;

    document.getElementById('modalPendenciaContrato').classList.remove('hidden');
}

function fecharModalPendencia() {
    document.getElementById('modalPendenciaContrato').classList.add('hidden');
    pendenciaAtual = null;
}

async function abrirAnexoPendencia(path) {
    const url = await _signedUrlAnexo(path);
    if (url) window.open(url, '_blank');
    else alert('Não foi possível gerar o link do anexo.');
}

function _pendLerEdicao() {
    const selVinc = document.getElementById('pendEdVinculo');
    return {
        tipo: document.getElementById('pendEdTipo').value,
        referencia: document.getElementById('pendEdReferencia').value.trim() || null,
        contrato_id: document.getElementById('pendEdContrato').value ? Number(document.getElementById('pendEdContrato').value) : null,
        projeto_codigo: document.getElementById('pendEdProjeto').value || null,
        vinculo_id: (selVinc && selVinc.value) ? Number(selVinc.value) : null,
        fornecedor: document.getElementById('pendEdFornecedor').value.trim() || null,
        valor: document.getElementById('pendEdValor').value ? Number(document.getElementById('pendEdValor').value) : null,
        data_referencia: document.getElementById('pendEdData').value || null,
        descricao: document.getElementById('pendEdDescricao').value.trim() || null
    };
}

async function salvarCorrecaoPendencia() {
    if (!pendenciaAtual || !_pendPodeAprovar()) return;
    const antes = { ...pendenciaAtual };
    const ed = _pendLerEdicao();
    // se o aprovador não escolheu vínculo, tenta resolver automático (par único)
    if (!ed.vinculo_id) {
        const v = _pendResolverVinculo(ed.contrato_id, ed.projeto_codigo);
        ed.vinculo_id = v ? v.id : null;
    }

    const { error } = await _supabase.from('contratos_pendencias').update(ed).eq('id', pendenciaAtual.id);
    if (error) return alert('Erro ao salvar correção: ' + error.message);
    await _logPendencia(pendenciaAtual.id, 'CORRIGIDA', {
        antes: { tipo: antes.tipo, contrato_id: antes.contrato_id, projeto_codigo: antes.projeto_codigo, valor: antes.valor, data_referencia: antes.data_referencia, fornecedor: antes.fornecedor, descricao: antes.descricao },
        depois: ed
    });
    Object.assign(pendenciaAtual, ed);
    await renderPendenciasContratosView();
    abrirDetalhePendencia(pendenciaAtual.id);
}

async function onAnexoPendenciaSelecionado(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!pendenciaAtual) { input.value = ''; return alert('Abra a pendência (Detalhar) antes de anexar.'); }
    if (f.size > 10 * 1024 * 1024) { input.value = ''; return alert('Arquivo acima de 10 MB.'); }
    const classe = (document.getElementById('pendAnexoClasse') || {}).value || 'OUTRO';
    const path = `pendencias/${pendenciaAtual.id}/${_pendUuid()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;

    const { error: upErr } = await _supabase.storage.from(PEND_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (upErr) {
        input.value = '';
        console.error('upload anexo:', upErr);
        const msg = /not found|does not exist/i.test(upErr.message || '')
            ? `Bucket "${PEND_BUCKET}" não encontrado — rode sql/2026-09-08_storage_contratos_anexos.sql no Supabase.`
            : /row-level security|not authorized|permission|violates/i.test(upErr.message || '')
              ? `Permissão negada no Storage — verifique as policies do bucket "${PEND_BUCKET}" (sql/2026-09-08_storage_contratos_anexos.sql).`
              : ('Erro ao enviar o arquivo: ' + (upErr.message || upErr));
        return alert('⛔ ' + msg);
    }

    const { error: insErr } = await _supabase.from('contratos_pendencias_anexos').insert([{
        pendencia_id: pendenciaAtual.id, storage_path: path, nome_original: f.name,
        tipo_mime: f.type || null, tamanho_bytes: f.size, classificacao: classe,
        enviado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (insErr) return alert('Arquivo enviado, mas houve erro ao registrar: ' + insErr.message);

    if (classe === 'NOTA_FISCAL' && pendenciaAtual.nf_status !== 'RECEBIDA') {
        await _supabase.from('contratos_pendencias').update({ nf_status: 'RECEBIDA', justificativa_dispensa_nf: null }).eq('id', pendenciaAtual.id);
        pendenciaAtual.nf_status = 'RECEBIDA';
    }
    await _logPendencia(pendenciaAtual.id, 'ANEXO_ADD', { nome: f.name, classificacao: classe });
    input.value = '';
    await renderPendenciasContratosView();
    abrirDetalhePendencia(pendenciaAtual.id);
}

async function removerAnexoPendencia(anexoId) {
    if (!pendenciaAtual || !confirm('Remover este anexo?')) return;
    const { data: a } = await _supabase.from('contratos_pendencias_anexos').select('*').eq('id', anexoId).maybeSingle();
    if (a) await _supabase.storage.from(PEND_BUCKET).remove([a.storage_path]);
    await _supabase.from('contratos_pendencias_anexos').delete().eq('id', anexoId);

    const { data: restantes } = await _supabase.from('contratos_pendencias_anexos').select('classificacao').eq('pendencia_id', pendenciaAtual.id);
    const temNf = (restantes || []).some(x => x.classificacao === 'NOTA_FISCAL');
    if (!temNf && pendenciaAtual.nf_status === 'RECEBIDA') {
        await _supabase.from('contratos_pendencias').update({ nf_status: 'NAO_RECEBIDA' }).eq('id', pendenciaAtual.id);
        pendenciaAtual.nf_status = 'NAO_RECEBIDA';
    }
    await _logPendencia(pendenciaAtual.id, 'ANEXO_REMOVIDO', { anexo_id: anexoId });
    await renderPendenciasContratosView();
    abrirDetalhePendencia(pendenciaAtual.id);
}

// dispensa de NF (§6) — justificativa obrigatória
function abrirModalDispensaNf(id) {
    document.getElementById('pendDispensaId').value = id;
    document.getElementById('pendDispensaJustificativa').value = '';
    document.getElementById('modalDispensaNf').classList.remove('hidden');
}
function fecharModalDispensaNf() { document.getElementById('modalDispensaNf').classList.add('hidden'); }
async function confirmarDispensaNf() {
    const id = Number(document.getElementById('pendDispensaId').value);
    const just = document.getElementById('pendDispensaJustificativa').value.trim();
    if (just.length < 5) return alert('Descreva a justificativa da dispensa de NF.');
    const { error } = await _supabase.from('contratos_pendencias').update({ nf_status: 'DISPENSADA', justificativa_dispensa_nf: just }).eq('id', id);
    if (error) return alert('Erro ao registrar a dispensa: ' + error.message);
    await _logPendencia(id, 'NF_DISPENSADA', { justificativa: just });
    fecharModalDispensaNf();
    if (pendenciaAtual && pendenciaAtual.id === id) pendenciaAtual.nf_status = 'DISPENSADA';
    await renderPendenciasContratosView();
    if (pendenciaAtual && pendenciaAtual.id === id) abrirDetalhePendencia(id);
}

// -------------------------------------------------------------------------
// Aprovação / rejeição — única porta para a base oficial (§7)
// -------------------------------------------------------------------------
async function aprovarPendencia(id) {
    if (!_pendPodeAprovar()) return alert('Você não tem permissão para aprovar pendências.');
    const p = pendenciasContratosCache.find(x => x.id === id);
    if (!p || p.status !== 'PENDENTE') return;

    // aplica correções não salvas se o modal estiver aberto nesta pendência
    if (pendenciaAtual && pendenciaAtual.id === id && document.getElementById('pendEdTipo')) {
        await salvarCorrecaoPendencia();
    }
    const atual = pendenciasContratosCache.find(x => x.id === id);

    if (!atual.contrato_id) return alert('Resolva o CONTRATO antes de aprovar.');
    if (!atual.projeto_codigo) return alert('Resolva o PROJETO antes de aprovar.');
    if (!(Number(atual.valor) > 0)) return alert('Valor inválido.');
    if (atual.nf_status !== 'RECEBIDA' && atual.nf_status !== 'DISPENSADA') {
        return alert('⛔ Não é possível aprovar sem Nota Fiscal. Anexe a NF ou registre uma dispensa com justificativa.');
    }

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();

    if (atual.tipo === 'PAGAMENTO') {
        let vinc = atual.vinculo_id ? pendVinculosCache.find(v => v.id === atual.vinculo_id) : _pendResolverVinculo(atual.contrato_id, atual.projeto_codigo);
        if (!vinc) {
            const doContrato = (pendVinculosCache || []).filter(v => v.contrato_id === atual.contrato_id);
            return alert(doContrato.length === 0
                ? '⛔ Este contrato não tem nenhum vínculo com projeto. Crie o vínculo em Contratos e Terceiros → "Contratos por Projeto" (aloque um valor), depois volte e aprove.'
                : '⛔ Escolha o Vínculo (Contratos por Projeto) no campo do modal antes de aprovar — este contrato tem mais de um vínculo.');
        }
        const saldo = saldoDisponivelVinculo(vinc);
        if (Number(atual.valor) > saldo) {
            return alert(`⛔ O valor (${formatCurrency(atual.valor)}) supera o saldo do vínculo (${formatCurrency(saldo)}).`);
        }
        const { data: pag, error } = await _supabase.from('contratos_pagamentos').insert([{
            contrato_id: atual.contrato_id, vinculo_id: vinc.id, valor_pago: Number(atual.valor),
            registrado_por: quem, registrado_em: agora,
            observacao: (atual.descricao || '') + ' [via pendência #' + id + ']'
        }]).select();
        if (error) return alert('Erro ao gravar o pagamento: ' + error.message);
        const pagId = pag && pag[0] ? pag[0].id : null;

        const novoRealVinc = Number(vinc.valor_realizado || 0) + Number(atual.valor);
        await _supabase.from('contratos_vinculos_projeto').update({ valor_realizado: novoRealVinc }).eq('id', vinc.id);
        const contrato = contratosProjetoCache.find(c => c.id === atual.contrato_id);
        if (contrato) {
            await _supabase.from('contratos_projeto').update({ valor_realizado: Number(contrato.valor_realizado || 0) + Number(atual.valor) }).eq('id', contrato.id);
        }
        if (typeof recalcularRealizadoProjeto === 'function') await recalcularRealizadoProjeto(atual.projeto_codigo);

        await _supabase.from('contratos_pendencias').update({
            status: 'APROVADA', vinculo_id: vinc.id, decidido_por: quem, decidido_em: agora,
            promovido_para_tabela: 'contratos_pagamentos', promovido_para_id: pagId
        }).eq('id', id);
        await _logPendencia(id, 'APROVADA', { promovido_para: 'contratos_pagamentos', id: pagId, valor: Number(atual.valor) });

    } else { // PROPOSTA
        const contrato = contratosProjetoCache.find(c => c.id === atual.contrato_id);
        const teto = contrato ? Number(contrato.valor_total || 0) : 0;
        const jaProp = _pendSomaPropostasContrato(atual.contrato_id, null);
        if (teto > 0 && jaProp + Number(atual.valor) > teto) {
            return alert(`⛔ A soma das propostas deste contrato (${formatCurrency(jaProp + Number(atual.valor))}) superaria o valor total do contrato (${formatCurrency(teto)}).`);
        }
        const vinc = atual.vinculo_id ? pendVinculosCache.find(v => v.id === atual.vinculo_id) : _pendResolverVinculo(atual.contrato_id, atual.projeto_codigo);
        const { data: prop, error } = await _supabase.from('contratos_propostas').insert([{
            contrato_id: atual.contrato_id, vinculo_id: vinc ? vinc.id : null, projeto_codigo: atual.projeto_codigo,
            fornecedor: atual.fornecedor, valor: Number(atual.valor), data_referencia: atual.data_referencia,
            descricao: atual.descricao, origem_pendencia_id: id, criado_por: quem, criado_em: agora
        }]).select();
        if (error) return alert('Erro ao gravar a proposta: ' + error.message);
        const propId = prop && prop[0] ? prop[0].id : null;

        await _supabase.from('contratos_pendencias').update({
            status: 'APROVADA', decidido_por: quem, decidido_em: agora,
            promovido_para_tabela: 'contratos_propostas', promovido_para_id: propId
        }).eq('id', id);
        await _logPendencia(id, 'APROVADA', { promovido_para: 'contratos_propostas', id: propId, valor: Number(atual.valor) });
    }

    alert('✅ Pendência aprovada e registrada na base oficial.');
    fecharModalPendencia();
    await renderPendenciasContratosView();
}

async function rejeitarPendencia(id) {
    if (!_pendPodeAprovar()) return alert('Você não tem permissão.');
    const motivo = prompt('Motivo da rejeição (obrigatório):', '');
    if (motivo === null) return;
    if (!motivo.trim()) return alert('O motivo é obrigatório.');
    const { error } = await _supabase.from('contratos_pendencias').update({
        status: 'REJEITADA', motivo_decisao: motivo.trim(),
        decidido_por: currentUser ? currentUser.nome : 'desconhecido', decidido_em: new Date().toISOString()
    }).eq('id', id);
    if (error) return alert('Erro ao rejeitar: ' + error.message);
    await _logPendencia(id, 'REJEITADA', { motivo: motivo.trim() });
    fecharModalPendencia();
    await renderPendenciasContratosView();
}

// -------------------------------------------------------------------------
// Canal 2 — Upload de planilha Excel (§5) + lançamento manual
// -------------------------------------------------------------------------
function _pendNumero(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
}
function _pendDataValida(iso) {
    // iso = 'AAAA-MM-DD' — confere se é uma data-calendário real (rejeita
    // 31/02, 32/01, etc.) antes de mandar pro banco (senão o INSERT em
    // lote da planilha inteira falha por causa de uma linha).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) ? iso : null;
}
function _pendData(v) {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return v.toISOString().split('T')[0];
    const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return _pendDataValida(`${m[3]}-${m[2]}-${m[1]}`);
    const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? _pendDataValida(iso[0]) : null;
}

async function processarPlanilhaContratos(input) {
    if (!_pendPodeImportar()) return alert('Você não tem permissão para importar.');
    const f = input.files && input.files[0];
    if (!f) return;
    if (typeof XLSX === 'undefined') return alert('Biblioteca de leitura de planilha não carregada (XLSX).');

    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    const lote = _pendUuid();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    pendImportErros = [];
    const paraInserir = [];

    linhas.forEach((row, i) => {
        const nLinha = i + 2; // +1 header, +1 base-1
        const tipoRaw = String(row['Tipo de Lançamento'] || row['Tipo de Lancamento'] || '').trim().toUpperCase();
        const tipo = tipoRaw.startsWith('PROP') ? 'PROPOSTA' : tipoRaw.startsWith('PAG') ? 'PAGAMENTO' : null;
        const contratoRef = String(row['Contrato'] || '').trim();
        const projetoRef = String(row['Projeto'] || '').trim();
        const fornecedor = String(row['Fornecedor/Terceiro'] || row['Fornecedor'] || '').trim();
        const valor = _pendNumero(row['Valor']);
        const data = _pendData(row['Data de Referência'] || row['Data de Referencia']);
        const obs = String(row['Observações'] || row['Observacoes'] || '').trim();

        const erros = [];
        if (!tipo) erros.push({ campo: 'Tipo de Lançamento', motivo: 'deve ser "Proposta" ou "Pagamento"' });
        if (!contratoRef) erros.push({ campo: 'Contrato', motivo: 'obrigatório' });
        if (!projetoRef) erros.push({ campo: 'Projeto', motivo: 'obrigatório' });
        if (!fornecedor) erros.push({ campo: 'Fornecedor/Terceiro', motivo: 'obrigatório' });
        if (!(valor > 0)) erros.push({ campo: 'Valor', motivo: 'numérico positivo obrigatório' });
        if (!data) erros.push({ campo: 'Data de Referência', motivo: 'data inválida (use dd/mm/aaaa)' });

        if (erros.length) { pendImportErros.push({ linha: nLinha, erros }); return; }

        const contrato = _pendResolverContrato(contratoRef);
        const projeto = (projectsData || []).find(pr =>
            String(pr.codigo || '').toUpperCase() === projetoRef.toUpperCase() ||
            String(pr.nome || '').toUpperCase() === projetoRef.toUpperCase());
        const errosLeitura = [];
        if (!contrato) errosLeitura.push({ campo: 'Contrato', motivo: `"${contratoRef}" não localizado no cadastro` });
        if (!projeto) errosLeitura.push({ campo: 'Projeto', motivo: `"${projetoRef}" não localizado no cadastro` });

        const vinc = (contrato && projeto) ? _pendResolverVinculo(contrato.id, projeto.codigo) : null;

        paraInserir.push({
            tipo, origem: 'UPLOAD_EXCEL', lote_importacao: lote,
            contrato_ref: contratoRef, contrato_id: contrato ? contrato.id : null,
            projeto_ref: projetoRef, projeto_codigo: projeto ? projeto.codigo : null,
            vinculo_id: vinc ? vinc.id : null,
            fornecedor, valor, data_referencia: data, descricao: obs || null,
            status: errosLeitura.length ? 'ERRO_LEITURA' : 'PENDENTE',
            erros_leitura: errosLeitura.length ? errosLeitura : null,
            criado_por: quem
        });
    });

    if (paraInserir.length) {
        const { data: inseridas, error } = await _supabase.from('contratos_pendencias').insert(paraInserir).select('id');
        if (error) return alert('Erro ao gravar as pendências: ' + error.message);
        for (const r of (inseridas || [])) await _logPendencia(r.id, 'IMPORTADA', { lote });
    }

    _pendRenderRelatorioImport(paraInserir.length, linhas.length);
    input.value = '';
    await renderPendenciasContratosView();
}

function _pendRenderRelatorioImport(okCount, totalLinhas) {
    const el = document.getElementById('pendImportRelatorio');
    if (!el) return;
    const errosHtml = pendImportErros.length === 0
        ? '<div class="text-xs text-green-700 font-bold">Nenhuma linha inválida.</div>'
        : `<table class="w-full text-xs mt-1"><thead><tr class="text-[10px] uppercase text-gray-400 border-b"><th class="text-left p-1">Linha</th><th class="text-left p-1">Campo</th><th class="text-left p-1">Motivo</th></tr></thead><tbody>
            ${pendImportErros.flatMap(e => e.erros.map(x => `<tr class="border-b border-gray-100"><td class="p-1">${e.linha}</td><td class="p-1 font-bold">${escapeHtml(x.campo)}</td><td class="p-1 text-red-700">${escapeHtml(x.motivo)}</td></tr>`)).join('')}
        </tbody></table>`;
    el.innerHTML = `<div class="text-xs font-bold mb-1">${okCount} pendência(s) criada(s) de ${totalLinhas} linha(s). ${pendImportErros.length} linha(s) com erro.</div>${errosHtml}`;
    el.classList.remove('hidden');
}

async function criarPendenciaManual() {
    if (!_pendPodeImportar()) return alert('Você não tem permissão.');
    const tipo = document.getElementById('pendManualTipo').value;
    const contratoId = document.getElementById('pendManualContrato').value ? Number(document.getElementById('pendManualContrato').value) : null;
    const projetoCodigo = document.getElementById('pendManualProjeto').value || null;
    const fornecedor = document.getElementById('pendManualFornecedor').value.trim();
    const valor = _pendNumero(document.getElementById('pendManualValor').value);
    const data = document.getElementById('pendManualData').value || null;
    const obs = document.getElementById('pendManualObs').value.trim();

    if (!contratoId || !projetoCodigo || !fornecedor || !(valor > 0) || !data) {
        return alert('Preencha contrato, projeto, fornecedor, valor (positivo) e data.');
    }
    const vinc = _pendResolverVinculo(contratoId, projetoCodigo);
    const { data: nova, error } = await _supabase.from('contratos_pendencias').insert([{
        tipo, origem: 'MANUAL', contrato_id: contratoId, projeto_codigo: projetoCodigo,
        vinculo_id: vinc ? vinc.id : null, fornecedor, valor, data_referencia: data,
        descricao: obs || null, status: 'PENDENTE', criado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]).select();
    if (error) return alert('Erro ao criar pendência: ' + error.message);
    if (nova && nova[0]) await _logPendencia(nova[0].id, 'CRIADA', { origem: 'MANUAL' });

    ['pendManualFornecedor', 'pendManualValor', 'pendManualData', 'pendManualObs'].forEach(k => document.getElementById(k).value = '');
    alert('✅ Pendência criada. Anexe a Nota Fiscal e submeta à aprovação.');
    mudarAbaPendencias('lista');
    await renderPendenciasContratosView();
}

function _pendPopularSelectsManual() {
    const selC = document.getElementById('pendManualContrato');
    if (selC) selC.innerHTML = '<option value="">-- Contrato --</option>' +
        (contratosProjetoCache || []).map(c => `<option value="${c.id}">${escapeHtml(c.numero_contrato)}</option>`).join('');
    const selP = document.getElementById('pendManualProjeto');
    if (selP) selP.innerHTML = '<option value="">-- Projeto --</option>' +
        (projectsData || []).map(pr => `<option value="${escapeHtml(pr.codigo)}">${escapeHtml(pr.codigo)} — ${escapeHtml(pr.nome)}</option>`).join('');
}
