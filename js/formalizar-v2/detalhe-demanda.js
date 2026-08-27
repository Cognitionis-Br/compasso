// =========================================================================
// formalizar-v2/detalhe-demanda.js
// Fase 2 (item 1): modal de Detalhe da Demanda, acessível pelo código na
// lista de Demandas Formalizadas. Mostra todos os campos da criação.
// Enquanto a demanda está "A Planejar", permite editar
// descrição/área/solicitante/pilar estratégico. Depois disso (já "em
// andamento" — Planejado, Orçamento Realizado), permite alimentar um
// campo de Informações Adicionais (opcional).
// =========================================================================

let demandaDetalheAtual = null;

async function abrirDetalheDemanda(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;
    demandaDetalheAtual = p;

    document.getElementById('detDemandaCodigoHidden').value = codigo;
    document.getElementById('detDemandaCodigo').innerText = p.codigo;
    document.getElementById('detDemandaAF').innerText = p.ano_fiscal || '-';
    document.getElementById('detDemandaNome').innerHTML = `${escapeHtml(p.nome) || '-'} ${p.is_adhoc ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 ml-1">Extraordinário</span>' : ''}${p.is_carryover ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-800 ml-1">Carryover</span>' : ''}`;
    document.getElementById('detDemandaData').innerText = p.data_solicitacao || '-';
    document.getElementById('detDemandaStatus').innerText = p.sub_status || 'A PLANEJAR';

    let tipoProjetoTexto = '-';
    if (p.tipo_projeto_id) {
        const { data: tp } = await _supabase.from('tipos_projeto').select('*').eq('id', p.tipo_projeto_id).maybeSingle();
        if (tp) tipoProjetoTexto = `${tp.codigo} - ${tp.descricao}`;
    }
    document.getElementById('detDemandaTipoProjeto').innerText = tipoProjetoTexto;

    const sub = (p.sub_status || 'A PLANEJAR').toUpperCase();
    const aindaAPlanejar = sub === 'A PLANEJAR' || sub === 'A PLANEJAR - EM REVISÃO';

    const wrapperEditavel = document.getElementById('detDemandaEditavelWrapper');
    const wrapperLeitura = document.getElementById('detDemandaDescricaoLeituraWrapper');
    const wrapperInfoAdicional = document.getElementById('detDemandaInfoAdicionalWrapper');

    if (aindaAPlanejar) {
        wrapperEditavel.classList.remove('hidden');
        wrapperLeitura.classList.add('hidden');
        wrapperInfoAdicional.classList.add('hidden');

        // Popula Área
        const areaSelect = document.getElementById('detDemandaAreaEdit');
        areaSelect.innerHTML = areasAtivas().map(a => {
            const nomeUpper = (a.nome || '').toUpperCase();
            return `<option value="${nomeUpper}" ${nomeUpper === p.area ? 'selected' : ''}>${nomeUpper}</option>`;
        }).join('');
        popularPessoaSolicitantePorAreaDetalhe(p.pessoa_solicitante);

        // Popula Pilar (filtrado pelo AF da demanda, só ativos + o que já está selecionado mesmo que tenha sido inativado depois)
        const { data: pilares } = await _supabase.from('pilares_estrategicos').select('*').eq('ano_fiscal', p.ano_fiscal).eq('ativo', true).order('nome');
        const pilarSelect = document.getElementById('detDemandaPilarEdit');
        pilarSelect.innerHTML = '<option value="">-- Nenhum --</option>' + (pilares || []).map(pl => `<option value="${pl.id}" ${pl.id === p.pilar_estrategico_id ? 'selected' : ''}>${escapeHtml(pl.nome)}</option>`).join('');
        await onChangePilarDetalhe(p.iniciativa_estrategica_id);

        document.getElementById('detDemandaDescricaoEdit').value = p.descricao_projeto || '';

        // NOVO (item 1, ajustes solicitados): nome do projeto passa a ser
        // editável enquanto a demanda ainda estiver "A Planejar".
        document.getElementById('detDemandaNomeEdit').value = p.nome || '';

        // NOVO (bug reportado: campos de Benefit Results não apareciam no
        // quadro de alteração da demanda "A Planejar" — só existiam na
        // criação): mesmo quadro da Nova Demanda, agora aqui também.
        document.getElementById('detDemandaObjetivoEdit').value = p.objetivo || '';
        document.getElementById('detDemandaKeyResultsEdit').value = p.key_results || '';
        await popularTiposReturnBenefitDetalhe();
        await carregarBenefitResultsDetalhe(codigo);
    } else {
        wrapperEditavel.classList.add('hidden');
        wrapperLeitura.classList.remove('hidden');
        wrapperInfoAdicional.classList.remove('hidden');
        document.getElementById('detDemandaDescricaoLeitura').innerText = p.descricao_projeto || '(sem descrição)';
        document.getElementById('detDemandaInfoAdicionalInput').value = p.informacoes_adicionais || '';
    }

    document.getElementById('modalDetalheDemanda').classList.remove('hidden');
}

function fecharModalDetalheDemanda() {
    document.getElementById('modalDetalheDemanda').classList.add('hidden');
    demandaDetalheAtual = null;
}

// Variante de popularPessoaSolicitantePorArea() escopada aos IDs do
// modal de detalhe, em vez do formulário de criação.
function popularPessoaSolicitantePorAreaDetalhe(pessoaSelecionadaAtual) {
    const areaSelect = document.getElementById('detDemandaAreaEdit');
    const pessoaSelect = document.getElementById('detDemandaSolicitanteEdit');
    if (!areaSelect || !pessoaSelect) return;

    const areaEscolhida = areaSelect.value;
    const pessoasDaArea = pessoasSolicitantesAtivas().filter(p => (p.area || '').toUpperCase() === areaEscolhida.toUpperCase());
    pessoaSelect.innerHTML = pessoasDaArea.map(p => `<option value="${escapeHtml(p.nome)}" ${p.nome === pessoaSelecionadaAtual ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('');
}

async function onChangePilarDetalhe(iniciativaSelecionadaAtual) {
    const pilarId = document.getElementById('detDemandaPilarEdit').value;
    const iniciativaSelect = document.getElementById('detDemandaIniciativaEdit');
    if (!pilarId) {
        iniciativaSelect.innerHTML = '<option value="">-- Nenhuma --</option>';
        return;
    }
    const { data } = await _supabase.from('iniciativas_estrategicas').select('*').eq('pilar_id', pilarId).eq('ativo', true).order('nome');
    iniciativaSelect.innerHTML = '<option value="">-- Nenhuma --</option>' +
        (data || []).map(i => `<option value="${i.id}" ${i.id === iniciativaSelecionadaAtual ? 'selected' : ''}>${escapeHtml(i.nome)}</option>`).join('');
}

async function salvarEdicaoDemandaFormalizada() {
    if (!demandaDetalheAtual) return;
    const codigo = document.getElementById('detDemandaCodigoHidden').value;

    const descricao = document.getElementById('detDemandaDescricaoEdit').value.trim();
    if (!descricao) return alert('A descrição não pode ficar vazia!');

    const nome = document.getElementById('detDemandaNomeEdit').value.trim();
    if (!nome) return alert('O nome do projeto não pode ficar vazio!');

    const pilarId = document.getElementById('detDemandaPilarEdit').value;
    const iniciativaId = document.getElementById('detDemandaIniciativaEdit').value;

    const payload = {
        nome,
        area: document.getElementById('detDemandaAreaEdit').value,
        pessoa_solicitante: document.getElementById('detDemandaSolicitanteEdit').value,
        pilar_estrategico_id: pilarId ? Number(pilarId) : null,
        iniciativa_estrategica_id: iniciativaId ? Number(iniciativaId) : null,
        descricao_projeto: descricao,
        objetivo: document.getElementById('detDemandaObjetivoEdit').value.trim() || null,
        key_results: document.getElementById('detDemandaKeyResultsEdit').value.trim() || null
    };

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao salvar as alterações: ' + error.message);

    Object.assign(demandaDetalheAtual, payload);
    alert('✅ Alterações salvas com sucesso!');
    fecharModalDetalheDemanda();
    await loadProjects();
    renderF1Formalizadas();
}

// -------------------------------------------------------------------------
// Benefit Results — mesmo conceito do quadro de Nova Demanda (ver
// js/projects/core.js), mas aqui o projeto já existe: adicionar/remover
// grava direto em projeto_benefit_results, sem esperar "Salvar Alterações"
// (mesmo padrão imediato usado em contratos_pagamentos).
// -------------------------------------------------------------------------
let returnBenefitDetalheCache = [];
let benefitResultsDetalheCache = [];

async function popularTiposReturnBenefitDetalhe() {
    const select = document.getElementById('detBenefitTipo');
    if (!select) return;
    const { data } = await _supabase.from('tipos_return_benefit').select('*').eq('ativo', true).order('nome');
    returnBenefitDetalheCache = data || [];
    select.innerHTML = '<option value="">-- Selecione --</option>' +
        returnBenefitDetalheCache.map(rb => `<option value="${rb.id}">${escapeHtml(rb.nome)}</option>`).join('');
    onChangeBenefitTipoDetalhe();
}

function onChangeBenefitTipoDetalhe() {
    const tipoId = document.getElementById('detBenefitTipo').value;
    const metricaWrapper = document.getElementById('detBenefitMetricaWrapper');
    const valorWrapper = document.getElementById('detBenefitValorWrapper');
    if (!metricaWrapper || !valorWrapper) return;

    const tipo = returnBenefitDetalheCache.find(rb => String(rb.id) === tipoId);
    const permiteValor = !!(tipo && tipo.permite_valor);

    metricaWrapper.classList.toggle('hidden', !permiteValor);
    valorWrapper.classList.toggle('hidden', !permiteValor);
    if (!permiteValor) {
        document.querySelectorAll('input[name="detBenefitMetrica"]').forEach(r => r.checked = false);
        document.getElementById('detBenefitValor').value = '';
    }
}

async function carregarBenefitResultsDetalhe(codigo) {
    const { data } = await _supabase.from('projeto_benefit_results').select('*, tipos_return_benefit(nome)').eq('projeto_codigo', codigo).order('id');
    benefitResultsDetalheCache = data || [];
    renderTabelaBenefitResultsDetalhe();
}

function renderTabelaBenefitResultsDetalhe() {
    const tbody = document.getElementById('detBenefitTableBody');
    if (!tbody) return;

    if (benefitResultsDetalheCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-2 text-center text-gray-400 italic">Nenhum Benefit Result adicionado</td></tr>`;
        return;
    }

    tbody.innerHTML = benefitResultsDetalheCache.map(b => `
        <tr class="border-b border-gray-100">
            <td class="p-2">${(b.tipos_return_benefit || {}).nome || '-'}</td>
            <td class="p-2">${b.metrica || '-'}</td>
            <td class="p-2 text-right font-mono">${b.valor !== null ? 'R$ ' + Number(b.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="p-2 text-center"><button type="button" onclick="removerBeneficioDetalhe(${b.id})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function adicionarBeneficioDetalhe() {
    const codigo = document.getElementById('detDemandaCodigoHidden').value;
    const tipoSelect = document.getElementById('detBenefitTipo');
    const tipoId = tipoSelect.value;
    if (!tipoId) {
        return alert('Selecione um Return / Benefit antes de adicionar!');
    }
    const tipo = returnBenefitDetalheCache.find(rb => String(rb.id) === tipoId);
    if (!tipo) return;

    let metrica = null, valor = null;
    if (tipo.permite_valor) {
        const radioMetrica = document.querySelector('input[name="detBenefitMetrica"]:checked');
        if (!radioMetrica) {
            return alert('Selecione se o valor informado é NPV ou ROI!');
        }
        metrica = radioMetrica.value;

        const valorInput = document.getElementById('detBenefitValor');
        valor = parseFloat(valorInput.value);
        if (!valorInput.value || isNaN(valor) || valor < 0) {
            return alert('Informe um valor válido para o Benefit Result!');
        }
        if (valor > 999999999.99) {
            return alert('O valor não pode ultrapassar R$ 999.999.999,99!');
        }
    }

    const { error } = await _supabase.from('projeto_benefit_results').insert([{
        projeto_codigo: codigo,
        tipo_return_benefit_id: Number(tipoId),
        metrica, valor,
        criado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (error) return alert('Erro ao adicionar o Benefit Result: ' + error.message);

    tipoSelect.value = '';
    onChangeBenefitTipoDetalhe();
    await carregarBenefitResultsDetalhe(codigo);
}

async function removerBeneficioDetalhe(id) {
    if (!confirm('Remover este Benefit Result?')) return;
    const codigo = document.getElementById('detDemandaCodigoHidden').value;
    const { error } = await _supabase.from('projeto_benefit_results').delete().eq('id', id);
    if (error) return alert('Erro ao remover: ' + error.message);
    await carregarBenefitResultsDetalhe(codigo);
}

async function salvarInfoAdicionalDemanda() {
    if (!demandaDetalheAtual) return;
    const codigo = document.getElementById('detDemandaCodigoHidden').value;
    const infoAdicional = document.getElementById('detDemandaInfoAdicionalInput').value.trim();

    const { error } = await _supabase.from('projetos').update({ informacoes_adicionais: infoAdicional || null }).eq('codigo', codigo);
    if (error) return alert('Erro ao salvar: ' + error.message);

    demandaDetalheAtual.informacoes_adicionais = infoAdicional || null;
    alert('✅ Informações adicionais salvas com sucesso!');
    fecharModalDetalheDemanda();
}
