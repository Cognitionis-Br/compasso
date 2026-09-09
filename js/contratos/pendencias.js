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
    if (aba === 'importar' && typeof renderFormPagamentoNF === 'function') {
        renderFormPagamentoNF('pendManualForm', 'PENDENCIA');
    }
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

    const { data: itensPend } = await _supabase.from('contratos_pendencias_itens').select('*').eq('pendencia_id', id);
    const listaItens = itensPend || [];
    const itensHtml = listaItens.length === 0 ? '' : `
        <div class="mt-3">
            <span class="text-[10px] font-bold uppercase text-gray-500">Rateio por projeto (total NF: ${formatCurrency(p.valor)})</span>
            <table class="w-full text-xs mt-1 border rounded">
                <tbody>${listaItens.map(i => `<tr class="border-b border-gray-100"><td class="p-1.5 font-mono">${escapeHtml(i.projeto_codigo || i.projeto_ref || '—')}</td><td class="p-1.5 text-right font-mono">${formatCurrency(i.valor)}</td></tr>`).join('')}</tbody>
            </table>
        </div>`;

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
            ${p.origem === 'EMAIL' ? `<div><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Referência <span class="text-gray-400">(identificação da instância no e-mail)</span></label>
                <input id="pendEdReferencia" value="${escapeHtml(p.referencia || '')}" disabled class="w-full p-1.5 border rounded bg-gray-50"></div>` : '<input type="hidden" id="pendEdReferencia" value="' + escapeHtml(p.referencia || '') + '">'}
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
            ${listaItens.length > 0 ? '' : `<div class="md:col-span-2"><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Vínculo (projeto + contrato) <span class="text-gray-400">(pagamento de 1 projeto só)</span></label>
                <select id="pendEdVinculo" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded bg-white">${optVinculos}</select>
                ${vinculosDoContrato.length === 0 ? '<span class="text-[10px] text-amber-700">Nenhum vínculo para este contrato — crie em Vincular Projeto e Contrato.</span>' : ''}</div>`}
            <div class="md:col-span-2"><label class="block text-[10px] font-bold uppercase text-gray-500 mb-0.5">Descrição / Observações</label>
                <input id="pendEdDescricao" value="${escapeHtml(p.descricao || '')}" ${editavel ? '' : 'disabled'} class="w-full p-1.5 border rounded"></div>
        </div>
        ${itensHtml}

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
    if (!(Number(atual.valor) > 0)) return alert('Valor total inválido.');
    if (atual.nf_status !== 'RECEBIDA' && atual.nf_status !== 'DISPENSADA') {
        return alert('⛔ Não é possível aprovar sem Nota Fiscal. Anexe a NF ou registre uma dispensa com justificativa.');
    }

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();

    if (atual.tipo === 'PAGAMENTO') {
        // itens de rateio; se não houver (pendência legada de 1 projeto),
        // trata como 1 item usando vinculo_id resolvido.
        let { data: itens } = await _supabase.from('contratos_pendencias_itens').select('*').eq('pendencia_id', id);
        itens = itens || [];
        if (itens.length === 0) {
            const v = atual.vinculo_id ? pendVinculosCache.find(x => x.id === atual.vinculo_id) : _pendResolverVinculo(atual.contrato_id, atual.projeto_codigo);
            if (!v) {
                const doContrato = (pendVinculosCache || []).filter(x => x.contrato_id === atual.contrato_id);
                return alert(doContrato.length === 0
                    ? '⛔ Este contrato não tem vínculo com projeto. Crie em "Vincular Projeto e Contrato" e volte.'
                    : '⛔ Pendência sem rateio e o contrato tem mais de um vínculo — corrija o rateio antes de aprovar.');
            }
            itens = [{ vinculo_id: v.id, projeto_codigo: v.projeto_codigo, valor: Number(atual.valor) }];
        }
        // resolve os vínculos
        const linhas = itens.map(i => ({
            ...i,
            vinc: pendVinculosCache.find(v => v.id === i.vinculo_id)
        }));
        if (linhas.some(l => !l.vinc)) return alert('⛔ Há item de rateio sem vínculo válido. Recrie o vínculo e corrija a pendência.');

        const somaItens = Math.round(linhas.reduce((a, l) => a + Number(l.valor), 0) * 100) / 100;
        if (Math.abs(somaItens - Number(atual.valor)) >= 0.005) {
            return alert(`⛔ A soma do rateio (${formatCurrency(somaItens)}) não bate com o valor total da NF (${formatCurrency(atual.valor)}).`);
        }
        const excede = linhas.find(l => Number(l.valor) > saldoDisponivelVinculo(l.vinc) + 0.005);
        if (excede) return alert(`⛔ Rateio de ${excede.projeto_codigo} (${formatCurrency(excede.valor)}) supera o saldo do vínculo (${formatCurrency(saldoDisponivelVinculo(excede.vinc))}).`);
        const contrato = contratosProjetoCache.find(c => c.id === atual.contrato_id);
        if (contrato) {
            const jaReal = (pendVinculosCache || []).filter(v => v.contrato_id === contrato.id).reduce((a, v) => a + Number(v.valor_realizado || 0), 0);
            if (jaReal + Number(atual.valor) > Number(contrato.valor_total || 0) + 0.005) {
                return alert(`⛔ Total de pagamentos deste contrato (${formatCurrency(jaReal + Number(atual.valor))}) superaria o valor do contrato (${formatCurrency(contrato.valor_total)}).`);
            }
        }

        const { data: pag, error } = await _supabase.from('contratos_pagamentos').insert([{
            contrato_id: atual.contrato_id, valor_total_nf: Number(atual.valor), valor_pago: Number(atual.valor),
            data_pagamento: atual.data_referencia || null, numero_nf: atual.numero_nf || null,
            registrado_por: quem, registrado_em: agora,
            observacao: (atual.descricao || '') + ' [via pendência #' + id + ']'
        }]).select();
        if (error) return alert('Erro ao gravar o pagamento: ' + error.message);
        const pagId = pag[0].id;

        await _supabase.from('contratos_pagamento_itens').insert(linhas.map(l => ({
            pagamento_id: pagId, vinculo_id: l.vinc.id, projeto_codigo: l.vinc.projeto_codigo, valor: Number(l.valor)
        })));

        for (const l of linhas) {
            const novo = Number(l.vinc.valor_realizado || 0) + Number(l.valor);
            await _supabase.from('contratos_vinculos_projeto').update({ valor_realizado: novo }).eq('id', l.vinc.id);
            l.vinc.valor_realizado = novo;
        }
        if (contrato) {
            const novoRealContr = Number(contrato.valor_realizado || 0) + Number(atual.valor);
            await _supabase.from('contratos_projeto').update({ valor_realizado: novoRealContr }).eq('id', contrato.id);
            contrato.valor_realizado = novoRealContr;
        }
        for (const proj of [...new Set(linhas.map(l => l.vinc.projeto_codigo))]) {
            if (typeof recalcularRealizadoProjeto === 'function') await recalcularRealizadoProjeto(proj);
        }

        await _supabase.from('contratos_pendencias').update({
            status: 'APROVADA', decidido_por: quem, decidido_em: agora,
            promovido_para_tabela: 'contratos_pagamentos', promovido_para_id: pagId
        }).eq('id', id);
        await _logPendencia(id, 'APROVADA', { promovido_para: 'contratos_pagamentos', id: pagId, valor: Number(atual.valor), itens: linhas.length });

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

    if (typeof loadProjects === 'function') await loadProjects();   // atualiza projetos.realizado em memória (Dashboard/Consultas/Detalhamento)
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

// Colunas: Tipo de Lançamento | Contrato | Projeto | Valor |
//          Data de Referência | Nº da NF | Observações
// PAGAMENTO: linhas com o MESMO (Contrato + Nº da NF) viram 1 pendência
//   (cabeçalho) com N itens de rateio; sem Nº da NF, cada linha é 1
//   pendência de 1 projeto. O fornecedor NÃO é informado — vem do contrato.
// PROPOSTA: 1 linha = 1 pendência (sem rateio).
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

    // 1) valida linha a linha e monta as "linhas boas"
    const boas = [];
    linhas.forEach((row, i) => {
        const nLinha = i + 2;
        const tipoRaw = String(row['Tipo de Lançamento'] || row['Tipo de Lancamento'] || '').trim().toUpperCase();
        const tipo = tipoRaw.startsWith('PROP') ? 'PROPOSTA' : tipoRaw.startsWith('PAG') ? 'PAGAMENTO' : null;
        const contratoRef = String(row['Contrato'] || '').trim();
        const projetoRef = String(row['Projeto'] || '').trim();
        const valor = _pendNumero(row['Valor']);
        const data = _pendData(row['Data de Referência'] || row['Data de Referencia']);
        const numeroNF = String(row['Nº da NF'] || row['No da NF'] || row['Numero da NF'] || row['Número da NF'] || '').trim();
        const obs = String(row['Observações'] || row['Observacoes'] || '').trim();

        const erros = [];
        if (!tipo) erros.push({ campo: 'Tipo de Lançamento', motivo: 'deve ser "Proposta" ou "Pagamento"' });
        if (!contratoRef) erros.push({ campo: 'Contrato', motivo: 'obrigatório' });
        if (!projetoRef) erros.push({ campo: 'Projeto', motivo: 'obrigatório' });
        if (!(valor > 0)) erros.push({ campo: 'Valor', motivo: 'numérico positivo obrigatório' });
        if (!data) erros.push({ campo: 'Data de Referência', motivo: 'data inválida (use dd/mm/aaaa)' });
        if (erros.length) { pendImportErros.push({ linha: nLinha, erros }); return; }

        const contrato = _pendResolverContrato(contratoRef);
        const projeto = (projectsData || []).find(pr =>
            String(pr.codigo || '').toUpperCase() === projetoRef.toUpperCase() ||
            String(pr.nome || '').toUpperCase() === projetoRef.toUpperCase());
        boas.push({ nLinha, tipo, contratoRef, contrato, projetoRef, projeto, valor, data, numeroNF, obs });
    });

    // 2) agrupa PAGAMENTO por (contratoRef + Nº NF); PROPOSTA fica solto
    const grupos = new Map();
    boas.forEach(b => {
        const chave = b.tipo === 'PAGAMENTO' && b.numeroNF
            ? `PAG|${b.contratoRef.toUpperCase()}|${b.numeroNF.toUpperCase()}`
            : `${b.tipo}|${b.nLinha}`;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(b);
    });

    // 3) cria uma pendência (+itens) por grupo
    let criadas = 0;
    for (const [, rows] of grupos) {
        const first = rows[0];
        const contrato = first.contrato;
        const errosLeitura = [];
        if (!contrato) errosLeitura.push({ campo: 'Contrato', motivo: `"${first.contratoRef}" não localizado no cadastro` });
        rows.filter(r => !r.projeto).forEach(r => errosLeitura.push({ campo: 'Projeto', motivo: `linha ${r.nLinha}: "${r.projetoRef}" não localizado` }));

        const total = Math.round(rows.reduce((a, r) => a + r.valor, 0) * 100) / 100;

        const { data: cab, error } = await _supabase.from('contratos_pendencias').insert([{
            tipo: first.tipo, origem: 'UPLOAD_EXCEL', lote_importacao: lote,
            contrato_ref: first.contratoRef, contrato_id: contrato ? contrato.id : null,
            projeto_ref: rows.length === 1 ? first.projetoRef : null,
            projeto_codigo: (rows.length === 1 && first.projeto) ? first.projeto.codigo : null,
            numero_nf: first.numeroNF || null,
            valor: total, data_referencia: first.data, descricao: first.obs || null,
            status: errosLeitura.length ? 'ERRO_LEITURA' : 'PENDENTE',
            erros_leitura: errosLeitura.length ? errosLeitura : null,
            criado_por: quem
        }]).select();
        if (error) { pendImportErros.push({ linha: first.nLinha, erros: [{ campo: '-', motivo: 'erro ao gravar: ' + error.message }] }); continue; }
        const pendId = cab[0].id;
        criadas++;
        await _logPendencia(pendId, 'IMPORTADA', { lote, itens: rows.length });

        if (first.tipo === 'PAGAMENTO') {
            const itens = rows.map(r => {
                const vinc = (contrato && r.projeto) ? _pendResolverVinculo(contrato.id, r.projeto.codigo) : null;
                return { pendencia_id: pendId, vinculo_id: vinc ? vinc.id : null, projeto_ref: r.projetoRef, projeto_codigo: r.projeto ? r.projeto.codigo : null, valor: r.valor };
            });
            await _supabase.from('contratos_pendencias_itens').insert(itens);
        }
    }

    _pendRenderRelatorioImport(criadas, linhas.length);
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

// Lançamento manual de PAGAMENTO agora usa o formulário compartilhado
// (js/contratos/pagamento-nf.js -> renderFormPagamentoNF('pendManualForm',
// 'PENDENCIA')). Lançamento manual de PROPOSTA fica fora do escopo por ora
// (chega por Excel/e-mail; se precisar, entra depois).
