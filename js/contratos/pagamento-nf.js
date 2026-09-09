// =========================================================================
// contratos/pagamento-nf.js   (Release 1 — módulo FINANCEIRO)
// Formulário ÚNICO de pagamento de contrato por Nota Fiscal, com rateio
// entre os projetos vinculados ao contrato. Usado em duas telas:
//
//   destino 'OFICIAL'   -> "Registro de Valores Realizados"
//                          grava direto em contratos_pagamentos (+itens)
//   destino 'PENDENCIA'  -> "Pendências de Contratos > Lançar Manual"
//                          grava em contratos_pendencias (+itens) p/ aprovação
//
// Regras (spec + confirmação do usuário):
//   - Σ rateio por projeto = valor total da NF;
//   - rateio de um projeto <= saldo do vínculo (valor_vinculo - valor_realizado);
//   - Σ pagamentos do contrato <= valor total do contrato;
//   - fornecedor NÃO é digitado — vem do contrato (consulta).
//
// Anexo de NF no mesmo padrão das Pendências (bucket contratos-anexos).
// =========================================================================

let _pnfDestino = 'OFICIAL';
let _pnfContainerId = null;
let _pnfContratoId = null;
let _pnfArquivoNF = null;   // File escolhido no formulário (enviado ao salvar)

function _pnfPodeUsar(destino) {
    const tela = destino === 'OFICIAL' ? 'registro_valores_contrato' : 'contratos_pendencias';
    if (typeof ehAdministrador !== 'undefined' && ehAdministrador) return true;
    if (typeof ehProprietario !== 'undefined' && ehProprietario) return true;
    if (destino === 'OFICIAL') return (typeof usuarioPodeIncluirTela === 'function') && (usuarioPodeIncluirTela(tela) || usuarioPodeAlterarTela(tela));
    return (typeof usuarioPodeIncluir === 'function') && usuarioPodeIncluir('contratos_pendencias:importar');
}

function _pnfFornecedorDoContrato(contrato) {
    if (!contrato) return '—';
    const emp = (empresasTerceirizadasCache || []).find(e => e.codigo === contrato.empresa_codigo);
    return emp ? `${emp.codigo} — ${emp.nome}` : contrato.empresa_codigo;
}

async function renderFormPagamentoNF(containerId, destino) {
    _pnfDestino = destino || 'OFICIAL';
    _pnfContainerId = containerId;
    const cont = document.getElementById(containerId);
    if (!cont) return;

    // caches
    await renderEmpresasTerceirizadasView(); // popula empresasTerceirizadasCache + o select da tela de contratos (inofensivo)
    const [{ data: contr }, { data: vinc }] = await Promise.all([
        _supabase.from('contratos_projeto').select('*').order('numero_contrato'),
        _supabase.from('contratos_vinculos_projeto').select('*')
    ]);
    contratosProjetoCache = contr || [];
    contratosVinculosCache = vinc || [];

    const optContratos = ['<option value="">-- Selecione o contrato --</option>']
        .concat(contratosProjetoCache
            .filter(c => (c.status || 'ATIVO') === 'ATIVO')
            .map(c => `<option value="${c.id}" ${c.id === _pnfContratoId ? 'selected' : ''}>${escapeHtml(c.numero_contrato)} · ${escapeHtml(_pnfFornecedorDoContrato(c))}</option>`))
        .join('');

    cont.innerHTML = `
        <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div class="md:col-span-2">
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Contrato *</label>
                    <select id="pnfContrato" onchange="onPnfContratoChange()" class="w-full p-2 border rounded bg-white">${optContratos}</select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Fornecedor</label>
                    <input id="pnfFornecedor" disabled class="w-full p-2 border rounded bg-gray-50" value="">
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Nº da Nota Fiscal</label>
                    <input id="pnfNumeroNF" class="w-full p-2 border rounded">
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Data ${_pnfDestino === 'OFICIAL' ? 'do Pagamento' : 'de Referência'} *</label>
                    <input id="pnfData" type="date" class="w-full p-2 border rounded">
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Valor Total da NF *</label>
                    <input id="pnfValorTotal" type="number" step="0.01" oninput="atualizarResumoRateioPnf()" class="w-full p-2 border rounded">
                </div>
                <div class="md:col-span-3">
                    <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Observações</label>
                    <input id="pnfObs" class="w-full p-2 border rounded">
                </div>
            </div>
        </div>

        <div id="pnfRateioWrapper" class="hidden bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-4">
            <h4 class="font-bold text-gray-800 text-sm mb-1 uppercase tracking-wider">Rateio por Projeto</h4>
            <p class="text-xs text-gray-500 mb-3">Informe quanto da NF pertence a cada projeto vinculado ao contrato. A soma tem de igualar o valor total da NF, e cada valor não pode passar o saldo do vínculo.</p>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead><tr class="bg-gray-50 text-gray-700 font-semibold border-b uppercase text-[10px]">
                        <th class="p-2">Projeto</th><th class="p-2 text-right">Alocado</th><th class="p-2 text-right">Realizado</th><th class="p-2 text-right">Saldo</th><th class="p-2 text-right">Rateio desta NF</th>
                    </tr></thead>
                    <tbody id="pnfRateioBody"></tbody>
                </table>
            </div>
            <div id="pnfResumoRateio" class="text-xs mt-3"></div>
        </div>

        <div id="pnfAnexoWrapper" class="hidden bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-4">
            <div class="flex items-center gap-3 text-xs">
                <span class="font-bold uppercase text-gray-600">Nota Fiscal (PDF/JPG/PNG)</span>
                <button type="button" onclick="document.getElementById('pnfAnexoInput').click()" class="text-indigo-600 hover:text-indigo-800 underline font-bold">+ Escolher arquivo</button>
                <input type="file" id="pnfAnexoInput" accept="application/pdf,image/jpeg,image/png" onchange="onPnfAnexoSelecionado(this)" class="hidden">
                <span id="pnfAnexoNome" class="text-gray-500"></span>
            </div>
            <p class="text-[10px] text-gray-400 mt-1">${_pnfDestino === 'OFICIAL' ? 'Opcional aqui — mas o pagamento fica sem comprovante se não anexar.' : 'Sem NF a pendência é criada, mas não pode ser aprovada sem NF (ou dispensa com justificativa).'}</p>
        </div>

        <button id="pnfBotaoSalvar" onclick="salvarPagamentoNF()" class="hidden bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded text-xs transition">
            <i class="fa-solid fa-floppy-disk"></i> ${_pnfDestino === 'OFICIAL' ? 'Registrar Pagamento' : 'Enviar para Aprovação'}
        </button>

        <div id="pnfHistoricoWrapper" class="${_pnfDestino === 'OFICIAL' ? '' : 'hidden'} bg-white p-5 rounded-lg shadow-sm border border-gray-200 mt-6">
            <h4 class="font-bold text-gray-800 text-sm mb-3 uppercase tracking-wider">Pagamentos já registrados neste contrato</h4>
            <div id="pnfHistoricoBody" class="text-xs text-gray-400">Selecione um contrato.</div>
        </div>
    `;
    _pnfArquivoNF = null;
    if (_pnfContratoId) onPnfContratoChange();
}

function onPnfContratoChange() {
    const sel = document.getElementById('pnfContrato');
    _pnfContratoId = sel && sel.value ? Number(sel.value) : null;
    const contrato = contratosProjetoCache.find(c => c.id === _pnfContratoId);
    document.getElementById('pnfFornecedor').value = _pnfFornecedorDoContrato(contrato);

    const vinculos = contratosVinculosCache.filter(v => v.contrato_id === _pnfContratoId);
    const body = document.getElementById('pnfRateioBody');
    if (!_pnfContratoId || vinculos.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-amber-700 font-bold">${_pnfContratoId ? 'Este contrato não tem projetos vinculados — crie o vínculo em "Vincular Projeto e Contrato".' : 'Selecione um contrato.'}</td></tr>`;
        ['pnfRateioWrapper', 'pnfAnexoWrapper', 'pnfBotaoSalvar'].forEach(id => document.getElementById(id).classList.add('hidden'));
    } else {
        body.innerHTML = vinculos.map(v => {
            const pr = (projectsData || []).find(p => p.codigo === v.projeto_codigo);
            const saldo = Number(v.valor_vinculo || 0) - Number(v.valor_realizado || 0);
            return `
            <tr data-vinc="${v.id}" data-proj="${escapeHtml(v.projeto_codigo)}" data-saldo="${saldo}">
                <td class="p-2 font-mono">${escapeHtml(v.projeto_codigo)}${pr ? ' — ' + escapeHtml(pr.nome) : ''}</td>
                <td class="p-2 text-right font-mono">${formatCurrency(v.valor_vinculo)}</td>
                <td class="p-2 text-right font-mono">${formatCurrency(v.valor_realizado || 0)}</td>
                <td class="p-2 text-right font-mono ${saldo <= 0 ? 'text-red-600' : ''}">${formatCurrency(saldo)}</td>
                <td class="p-2 text-right"><input type="number" step="0.01" class="pnf-rateio w-28 p-1 border rounded text-right" oninput="atualizarResumoRateioPnf()"></td>
            </tr>`;
        }).join('');
        ['pnfRateioWrapper', 'pnfAnexoWrapper', 'pnfBotaoSalvar'].forEach(id => document.getElementById(id).classList.remove('hidden'));
    }
    atualizarResumoRateioPnf();
    if (_pnfDestino === 'OFICIAL') _pnfRenderHistorico();
}

function _pnfLerRateio() {
    return Array.from(document.querySelectorAll('#pnfRateioBody tr[data-vinc]')).map(tr => ({
        vinculo_id: Number(tr.getAttribute('data-vinc')),
        projeto_codigo: tr.getAttribute('data-proj'),
        saldo: Number(tr.getAttribute('data-saldo')),
        valor: Number((tr.querySelector('.pnf-rateio') || {}).value || 0)
    })).filter(r => r.valor > 0 || document.querySelectorAll('#pnfRateioBody .pnf-rateio').length);
}

function atualizarResumoRateioPnf() {
    const el = document.getElementById('pnfResumoRateio');
    if (!el) return;
    const total = Number((document.getElementById('pnfValorTotal') || {}).value || 0);
    const linhas = _pnfLerRateio();
    const soma = linhas.reduce((a, r) => a + r.valor, 0);
    const excede = linhas.filter(r => r.valor > r.saldo + 0.005);
    const diff = Math.round((total - soma) * 100) / 100;
    el.innerHTML =
        `Soma do rateio: <b>${formatCurrency(soma)}</b> · Total da NF: <b>${formatCurrency(total)}</b> · ` +
        (Math.abs(diff) < 0.005
            ? '<span class="text-green-700 font-bold">confere</span>'
            : `<span class="text-red-700 font-bold">diferença de ${formatCurrency(diff)}</span>`) +
        (excede.length ? `<div class="text-red-700 font-bold mt-1">⛔ ${excede.length} projeto(s) com rateio acima do saldo do vínculo.</div>` : '');
}

function onPnfAnexoSelecionado(input) {
    const f = input.files && input.files[0];
    if (!f) { _pnfArquivoNF = null; document.getElementById('pnfAnexoNome').textContent = ''; return; }
    if (f.size > 10 * 1024 * 1024) { input.value = ''; return alert('Arquivo acima de 10 MB.'); }
    _pnfArquivoNF = f;
    document.getElementById('pnfAnexoNome').textContent = f.name;
}

async function _pnfUploadAnexo(tabelaAnexos, colId, idRegistro) {
    if (!_pnfArquivoNF) return;
    const f = _pnfArquivoNF;
    const pastaPrefixo = _pnfDestino === 'OFICIAL' ? 'pagamentos' : 'pendencias';
    const path = `${pastaPrefixo}/${idRegistro}/${(self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : Date.now())}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
    const { error: upErr } = await _supabase.storage.from('contratos-anexos').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (upErr) { alert('⚠️ Registro salvo, mas o anexo da NF falhou: ' + upErr.message); return; }
    await _supabase.from(tabelaAnexos).insert([{
        [colId]: idRegistro, storage_path: path, nome_original: f.name, tipo_mime: f.type || null,
        tamanho_bytes: f.size, classificacao: 'NOTA_FISCAL', enviado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
}

async function salvarPagamentoNF() {
    if (!_pnfPodeUsar(_pnfDestino)) return alert('Você não tem permissão.');
    const contrato = contratosProjetoCache.find(c => c.id === _pnfContratoId);
    if (!contrato) return alert('Selecione o contrato.');
    const total = Number((document.getElementById('pnfValorTotal') || {}).value || 0);
    const data = document.getElementById('pnfData').value || null;
    const numeroNF = document.getElementById('pnfNumeroNF').value.trim() || null;
    const obs = document.getElementById('pnfObs').value.trim() || null;
    if (!(total > 0)) return alert('Informe o valor total da NF.');
    if (!data) return alert('Informe a data.');

    const linhas = _pnfLerRateio().filter(r => r.valor > 0);
    if (linhas.length === 0) return alert('Informe o rateio de pelo menos um projeto.');
    const soma = Math.round(linhas.reduce((a, r) => a + r.valor, 0) * 100) / 100;
    if (Math.abs(soma - total) >= 0.005) return alert(`A soma do rateio (${formatCurrency(soma)}) tem de ser igual ao valor total da NF (${formatCurrency(total)}).`);
    const excede = linhas.find(r => r.valor > r.saldo + 0.005);
    if (excede) return alert(`⛔ O rateio de ${excede.projeto_codigo} (${formatCurrency(excede.valor)}) supera o saldo do vínculo (${formatCurrency(excede.saldo)}).`);

    // Σ pagamentos do contrato <= valor total do contrato
    if (_pnfDestino === 'OFICIAL') {
        const jaRealizado = contratosVinculosCache.filter(v => v.contrato_id === contrato.id)
            .reduce((a, v) => a + Number(v.valor_realizado || 0), 0);
        if (jaRealizado + total > Number(contrato.valor_total || 0) + 0.005) {
            return alert(`⛔ O total de pagamentos deste contrato (${formatCurrency(jaRealizado + total)}) superaria o valor do contrato (${formatCurrency(contrato.valor_total)}).`);
        }
    }

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();

    if (_pnfDestino === 'OFICIAL') {
        const { data: cab, error } = await _supabase.from('contratos_pagamentos').insert([{
            contrato_id: contrato.id, valor_total_nf: total, valor_pago: total,
            data_pagamento: data, numero_nf: numeroNF, observacao: obs,
            registrado_por: quem, registrado_em: agora
        }]).select();
        if (error) return alert('Erro ao registrar o pagamento: ' + error.message);
        const pagId = cab[0].id;

        await _supabase.from('contratos_pagamento_itens').insert(linhas.map(r => ({
            pagamento_id: pagId, vinculo_id: r.vinculo_id, projeto_codigo: r.projeto_codigo, valor: r.valor
        })));

        // atualiza realizado de cada vínculo + contrato + projeto
        for (const r of linhas) {
            const v = contratosVinculosCache.find(x => x.id === r.vinculo_id);
            const novo = Number(v.valor_realizado || 0) + r.valor;
            await _supabase.from('contratos_vinculos_projeto').update({ valor_realizado: novo }).eq('id', v.id);
            v.valor_realizado = novo;
        }
        const novoRealContr = Number(contrato.valor_realizado || 0) + total;
        await _supabase.from('contratos_projeto').update({ valor_realizado: novoRealContr }).eq('id', contrato.id);
        contrato.valor_realizado = novoRealContr;
        for (const proj of [...new Set(linhas.map(r => r.projeto_codigo))]) {
            if (typeof recalcularRealizadoProjeto === 'function') await recalcularRealizadoProjeto(proj);
        }
        await _pnfUploadAnexo('contratos_pagamentos_anexos', 'pagamento_id', pagId);
        if (typeof loadProjects === 'function') await loadProjects();

        alert('✅ Pagamento registrado.');
        renderFormPagamentoNF(_pnfContainerId, 'OFICIAL');

    } else { // PENDENCIA
        const { data: cab, error } = await _supabase.from('contratos_pendencias').insert([{
            tipo: 'PAGAMENTO', origem: 'MANUAL', contrato_id: contrato.id, contrato_ref: contrato.numero_contrato,
            valor: total, data_referencia: data, numero_nf: numeroNF, descricao: obs,
            status: 'PENDENTE', criado_por: quem
        }]).select();
        if (error) return alert('Erro ao criar a pendência: ' + error.message);
        const pendId = cab[0].id;
        await _supabase.from('contratos_pendencias_itens').insert(linhas.map(r => ({
            pendencia_id: pendId, vinculo_id: r.vinculo_id, projeto_codigo: r.projeto_codigo, valor: r.valor
        })));
        if (typeof _logPendencia === 'function') await _logPendencia(pendId, 'CRIADA', { origem: 'MANUAL', itens: linhas.length });
        await _pnfUploadAnexo('contratos_pendencias_anexos', 'pendencia_id', pendId);
        if (_pnfArquivoNF) await _supabase.from('contratos_pendencias').update({ nf_status: 'RECEBIDA' }).eq('id', pendId);

        alert('✅ Pendência criada e enviada para aprovação.');
        if (typeof mudarAbaPendencias === 'function') mudarAbaPendencias('lista');
        if (typeof renderPendenciasContratosView === 'function') await renderPendenciasContratosView();
    }
}

async function _pnfRenderHistorico() {
    const el = document.getElementById('pnfHistoricoBody');
    if (!el || !_pnfContratoId) return;
    const { data: cabs } = await _supabase.from('contratos_pagamentos').select('*').eq('contrato_id', _pnfContratoId).order('registrado_em', { ascending: false });
    const lista = cabs || [];
    if (lista.length === 0) { el.innerHTML = '<span class="text-gray-400">Nenhum pagamento registrado neste contrato.</span>'; return; }
    const { data: itens } = await _supabase.from('contratos_pagamento_itens').select('*').in('pagamento_id', lista.map(c => c.id));
    const porPag = {};
    (itens || []).forEach(i => { (porPag[i.pagamento_id] = porPag[i.pagamento_id] || []).push(i); });
    el.innerHTML = `<table class="w-full text-xs"><thead><tr class="text-[10px] uppercase text-gray-400 border-b"><th class="text-left p-1">Data</th><th class="text-left p-1">NF</th><th class="text-right p-1">Total</th><th class="text-left p-1">Rateio</th><th class="text-left p-1">Por</th></tr></thead><tbody>
        ${lista.map(c => `<tr class="border-b border-gray-100">
            <td class="p-1">${(c.data_pagamento || (c.registrado_em || '').split('T')[0]) || '-'}</td>
            <td class="p-1">${escapeHtml(c.numero_nf || '-')}</td>
            <td class="p-1 text-right font-mono">${formatCurrency(c.valor_total_nf || c.valor_pago)}</td>
            <td class="p-1">${(porPag[c.id] || []).map(i => `${escapeHtml(i.projeto_codigo)}: ${formatCurrency(i.valor)}`).join(' · ') || '-'}</td>
            <td class="p-1 uppercase">${escapeHtml(c.registrado_por || '-')}</td>
        </tr>`).join('')}
    </tbody></table>`;
}

// -------------------------------------------------------------------------
// Ponto de entrada da tela "Registro de Valores Realizados"
// (navigation.js: switchTab -> renderRegistroValoresView).
// -------------------------------------------------------------------------
async function renderRegistroValoresView() {
    const restrito = document.getElementById('regValRestrito');
    const conteudo = document.getElementById('regValConteudo');
    const pode = _pnfPodeUsar('OFICIAL');
    if (restrito) restrito.classList.toggle('hidden', pode);
    if (conteudo) conteudo.classList.toggle('hidden', !pode);
    if (!pode) return;
    await renderFormPagamentoNF('regValConteudo', 'OFICIAL');
}
