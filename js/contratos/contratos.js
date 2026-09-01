// =========================================================================
// contratos/contratos.js
// Item 6 (primeiro documento de melhorias): Empresas Terceirizadas +
// Contratos por Projeto. Só projetos já ALÉM do Business Case podem
// receber contrato (regra pedida explicitamente).
//
// PENDENTE PRA PRÓXIMA SESSÃO (combinado com o usuário): tela de
// Registro de Valores Realizados (por projeto ou por proposta, travando
// no valor total do contrato) e o Relatório de Projetos (orçamento
// previsto/pós-requerimentos/pós-technical + lista de propostas).
// =========================================================================

let empresasTerceirizadasCache = [];
let contratosProjetoCache = [];

// NOVO (a pedido do usuário 25/08/2026 — padronização/segregação de
// atividades): 2 abas, mesmo padrão V2 de Usuários/Funções/Responsáveis.
function mudarAbaEmpresas(aba) {
    ['criar', 'cadastradas'].forEach(a => {
        const btn = document.getElementById(`empresasBtn-${a}`);
        const painel = document.getElementById(`empresasPainel-${a}`);
        if (btn) btn.className = `empresas-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('empresas_terceirizadas', 'empresasBtn');
}

function mudarAbaContratos(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`contratosBtn-${a}`);
        const painel = document.getElementById(`contratosPainel-${a}`);
        if (btn) btn.className = `contratos-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('contratos_projeto', 'contratosBtn');
}

// -------------------------------------------------------------------------
// Empresas Terceirizadas
// -------------------------------------------------------------------------
async function renderEmpresasTerceirizadasView() {
    const { data, error } = await _supabase.from('empresas_terceirizadas').select('*').order('codigo');
    empresasTerceirizadasCache = error ? [] : (data || []);

    const tbody = document.getElementById('empresasTerceirizadasTableBody');
    if (tbody) {
        tbody.innerHTML = empresasTerceirizadasCache.length === 0
            ? `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhuma empresa cadastrada ainda</td></tr>`
            : empresasTerceirizadasCache.map(e => `
                <tr class="${!e.ativo ? 'opacity-50' : ''}">
                    <td class="p-3 font-mono font-bold">${escapeHtml(e.codigo)}</td>
                    <td class="p-3 font-semibold">${escapeHtml(e.nome)}</td>
                    <td class="p-3 text-center">${e.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
                    <td class="p-3 text-center">${botaoSePodeAtivarInativar('empresas_terceirizadas', `<button onclick="alternarAtivoEmpresa('${escapeJsAttr(e.codigo)}')" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i></button>`)}</td>
                </tr>
            `).join('');
    }

    // Popula o select de empresa (só ativas) na tela de Contratos.
    const selectEmpresa = document.getElementById('contratoEmpresaSelect');
    if (selectEmpresa) {
        selectEmpresa.innerHTML = '<option value="">-- Selecione --</option>' +
            empresasTerceirizadasCache.filter(e => e.ativo).map(e => `<option value="${escapeHtml(e.codigo)}">${escapeHtml(e.codigo)} - ${escapeHtml(e.nome)}</option>`).join('');
    }
}

async function salvarEmpresaTerceirizada() {
    if (!usuarioPodeIncluirTela('empresas_terceirizadas')) return alert('Você não tem permissão para incluir empresas terceirizadas.');
    const codigo = document.getElementById('empresaCodigoInput').value.trim().toUpperCase();
    const nome = document.getElementById('empresaNomeInput').value.trim();

    if (!codigo || !nome) return alert('Preencha o código e o nome da empresa!');
    if (codigo.length > 12) return alert('O código precisa ter no máximo 12 caracteres!');
    if (nome.length > 80) return alert('O nome precisa ter no máximo 80 caracteres!');
    if (empresasTerceirizadasCache.some(e => e.codigo === codigo)) {
        return alert(`⛔ Já existe uma empresa com o código "${codigo}".`);
    }

    const { error } = await _supabase.from('empresas_terceirizadas').insert([{
        codigo, nome, criado_por: currentUser ? currentUser.nome : 'desconhecido', criado_em: new Date().toISOString()
    }]);
    if (error) return alert('Erro ao cadastrar: ' + error.message);

    alert('✅ Empresa cadastrada com sucesso!');
    document.getElementById('empresaCodigoInput').value = '';
    document.getElementById('empresaNomeInput').value = '';
    await renderEmpresasTerceirizadasView();
}

async function alternarAtivoEmpresa(codigo) {
    const e = empresasTerceirizadasCache.find(x => x.codigo === codigo);
    if (!e) return;
    if (e.ativo && !usuarioPodeDeletarTela('empresas_terceirizadas')) return alert('Você não tem permissão para inativar empresas terceirizadas.');
    if (!e.ativo && !usuarioPodeAlterarTela('empresas_terceirizadas')) return alert('Você não tem permissão para reativar empresas terceirizadas.');
    if (!confirm(`Confirma ${e.ativo ? 'inativar' : 'reativar'} a empresa "${e.nome}"?`)) return;

    const { error } = await _supabase.from('empresas_terceirizadas').update({ ativo: !e.ativo }).eq('codigo', codigo);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderEmpresasTerceirizadasView();
}

// -------------------------------------------------------------------------
// Contratos Terceirizados (renomeada de "Contratos por Projeto" em
// 25/08/2026 — o vínculo com projeto(s) virou uma função própria numa
// fase futura, "Contratos por Projeto"; aqui só o cadastro do contrato
// em si, com status Ativo/Inativo).
// -------------------------------------------------------------------------
async function renderContratosProjetoView() {
    await renderEmpresasTerceirizadasView(); // garante o select de empresa populado

    const { data, error } = await _supabase.from('contratos_projeto').select('*').order('id', { ascending: false });
    contratosProjetoCache = error ? [] : (data || []);

    const tbody = document.getElementById('contratosProjetoTableBody');
    if (!tbody) return;

    if (contratosProjetoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum contrato cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = contratosProjetoCache.map(c => {
        const empresa = empresasTerceirizadasCache.find(e => e.codigo === c.empresa_codigo);
        const ativo = (c.status || 'ATIVO') === 'ATIVO';
        return `
            <tr class="${ativo ? '' : 'opacity-50'}">
                <td class="p-3 text-xs">${escapeHtml(empresa ? empresa.nome : c.empresa_codigo)}</td>
                <td class="p-3 text-xs">${escapeHtml(c.numero_contrato)}</td>
                <td class="p-3 text-xs">${c.data_inicio}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(c.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(c.valor_realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-center">${ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
                <td class="p-3 text-center">${botaoSePodeAtivarInativar('contratos_projeto', `<button onclick="alternarStatusContrato(${c.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i></button>`)}</td>
            </tr>
        `;
    }).join('');
}

async function alternarStatusContrato(id) {
    if (!usuarioPodeAlterarTela('contratos_projeto') && !usuarioPodeDeletarTela('contratos_projeto')) return alert('Você não tem permissão para alterar o status de contratos.');
    const c = contratosProjetoCache.find(x => x.id === id);
    if (!c) return;
    const novoStatus = (c.status || 'ATIVO') === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    if (!confirm(`Confirma ${novoStatus === 'INATIVO' ? 'inativar' : 'reativar'} o contrato "${c.numero_contrato}"?`)) return;

    const { error } = await _supabase.from('contratos_projeto').update({ status: novoStatus }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderContratosProjetoView();
}

async function salvarContratoProjeto() {
    if (!usuarioPodeIncluirTela('contratos_projeto')) return alert('Você não tem permissão para incluir contratos.');
    const empresaCodigo = document.getElementById('contratoEmpresaSelect').value;
    const numeroContrato = document.getElementById('contratoNumeroInput').value.trim();
    const dataInicio = document.getElementById('contratoDataInicioInput').value;
    const dataEncerramento = document.getElementById('contratoDataEncerramentoInput').value;
    const qtdHoras = document.getElementById('contratoQtdHorasInput').value;
    const valorHora = document.getElementById('contratoValorHoraInput').value;
    const valorTotal = document.getElementById('contratoValorTotalInput').value;
    const observacao = document.getElementById('contratoObservacaoInput').value.trim();

    // Campos obrigatórios: empresa, número, data início, valor total.
    // Qtde horas, valor hora, data encerramento e observação são opcionais.
    // NOVO (a pedido do usuário 25/08/2026): o contrato não pede mais o
    // projeto aqui — o vínculo contrato×projeto virou uma função própria
    // numa fase futura ("Contratos por Projeto").
    if (!empresaCodigo || !numeroContrato || !dataInicio || !valorTotal) {
        return alert('Preencha Empresa, Número do Contrato, Data de Início e Valor Total (os demais campos são opcionais)!');
    }

    const { error } = await _supabase.from('contratos_projeto').insert([{
        empresa_codigo: empresaCodigo,
        numero_contrato: numeroContrato,
        data_inicio: dataInicio,
        quantidade_horas: qtdHoras ? Number(qtdHoras) : null,
        valor_hora: valorHora ? Number(valorHora) : null,
        valor_total: Number(valorTotal),
        data_encerramento: dataEncerramento || null,
        observacao: observacao || null,
        criado_por: currentUser ? currentUser.nome : 'desconhecido',
        criado_em: new Date().toISOString()
    }]);
    if (error) return alert('Erro ao salvar o contrato: ' + error.message);

    alert('✅ Contrato salvo com sucesso!');
    ['contratoEmpresaSelect', 'contratoNumeroInput', 'contratoDataInicioInput', 'contratoDataEncerramentoInput', 'contratoQtdHorasInput', 'contratoValorHoraInput', 'contratoValorTotalInput', 'contratoObservacaoInput'].forEach(id => {
        document.getElementById(id).value = '';
    });
    await renderContratosProjetoView();
}

// -------------------------------------------------------------------------
// Registro de Valores Realizados — por Projeto ou por Proposta, sempre
// travando no valor total do contrato (item 6, parte pendente).
// -------------------------------------------------------------------------
let regValVinculoAtual = null;

async function renderRegistroValoresView() {
    await renderContratosVinculosView(); // garante contratosVinculosCache/contratosProjetoCache/empresasTerceirizadasCache atualizados

    const ordem = document.querySelector('input[name="regValOrdem"]:checked').value;
    const lista = [...contratosVinculosCache];

    // AJUSTADO (Fase 4 — múltiplos contratos por projeto): a fonte agora é
    // o VÍNCULO (contratos_vinculos_projeto), não mais o contrato direto —
    // um projeto pode ter mais de um contrato vinculado, e o mesmo contrato
    // pode servir mais de um projeto. Cada vínculo tem seu próprio saldo.
    if (ordem === 'projeto') {
        lista.sort((a, b) => (a.projeto_codigo || '').localeCompare(b.projeto_codigo || ''));
    } else {
        lista.sort((a, b) => {
            const ca = contratosProjetoCache.find(c => c.id === a.contrato_id);
            const cb = contratosProjetoCache.find(c => c.id === b.contrato_id);
            return (ca ? ca.numero_contrato : '').localeCompare(cb ? cb.numero_contrato : '');
        });
    }

    const select = document.getElementById('regValContratoSelect');
    select.innerHTML = '<option value="">-- Selecione --</option>' + lista.map(v => {
        const c = contratosProjetoCache.find(x => x.id === v.contrato_id);
        const empresa = c ? empresasTerceirizadasCache.find(e => e.codigo === c.empresa_codigo) : null;
        const numeroContrato = escapeHtml(c ? c.numero_contrato : '?');
        const empresaLabel = escapeHtml(empresa ? empresa.nome : (c ? c.empresa_codigo : '?'));
        const rotulo = ordem === 'projeto'
            ? `${v.projeto_codigo} — ${numeroContrato} (${empresaLabel})`
            : `${numeroContrato} — ${v.projeto_codigo} (${empresaLabel})`;
        return `<option value="${v.id}">${rotulo}</option>`;
    }).join('');

    document.getElementById('regValDadosWrapper').classList.add('hidden');
    document.getElementById('regValVisaoContratoWrapper').classList.add('hidden');
    regValVinculoAtual = null;
}

async function onSelecionarContratoRegistro() {
    const id = document.getElementById('regValContratoSelect').value;
    const wrapper = document.getElementById('regValDadosWrapper');
    if (!id) {
        wrapper.classList.add('hidden');
        document.getElementById('regValVisaoContratoWrapper').classList.add('hidden');
        regValVinculoAtual = null;
        return;
    }

    const v = contratosVinculosCache.find(x => x.id === Number(id));
    if (!v) return;
    regValVinculoAtual = v;

    const c = contratosProjetoCache.find(x => x.id === v.contrato_id);
    const projeto = (projectsData || []).find(p => p.codigo === v.projeto_codigo);
    const empresa = c ? empresasTerceirizadasCache.find(e => e.codigo === c.empresa_codigo) : null;
    const saldo = Number(v.valor_vinculo) - Number(v.valor_realizado || 0);

    document.getElementById('regValProjetoInfo').innerText = `${v.projeto_codigo}${projeto ? ' - ' + projeto.nome : ''}`;
    document.getElementById('regValEmpresaInfo').innerText = (c ? `${c.numero_contrato} — ` : '') + (empresa ? `${empresa.codigo} - ${empresa.nome}` : (c ? c.empresa_codigo : '?'));
    document.getElementById('regValTotalInfo').innerText = `R$ ${Number(v.valor_vinculo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('regValRealizadoInfo').innerText = `R$ ${Number(v.valor_realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('regValSaldoInfo').innerText = `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('regValValorInput').value = '';
    document.getElementById('regValObservacaoInput').value = '';

    wrapper.classList.remove('hidden');
    await renderHistoricoPagamentos(v.id);
    renderVisaoContratoRegistro(v.contrato_id);
}

// NOVO (a pedido do usuário 26/08/2026): visão do contrato inteiro — valor
// total do contrato +, pra cada projeto vinculado a ele, quanto foi
// alocado (valor_vinculo) e quanto já foi realizado (valor_realizado do
// próprio vínculo, mantido em dia desde a Fase 4) + saldo, com totais.
function renderVisaoContratoRegistro(contratoId) {
    const wrapper = document.getElementById('regValVisaoContratoWrapper');
    const tbody = document.getElementById('regValVisaoContratoTableBody');
    if (!wrapper || !tbody) return;

    const contrato = contratosProjetoCache.find(c => c.id === contratoId);
    document.getElementById('regValContratoTotalGeralInfo').innerText = contrato ? `R$ ${Number(contrato.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';

    const vinculosDoContrato = contratosVinculosCache.filter(v => v.contrato_id === contratoId);
    let totalVinculado = 0, totalRealizado = 0;

    tbody.innerHTML = vinculosDoContrato.map(v => {
        const projeto = (projectsData || []).find(p => p.codigo === v.projeto_codigo);
        const vinculado = Number(v.valor_vinculo);
        const realizado = Number(v.valor_realizado || 0);
        totalVinculado += vinculado;
        totalRealizado += realizado;
        return `
            <tr class="${v.id === (regValVinculoAtual && regValVinculoAtual.id) ? 'bg-indigo-50 font-bold' : ''}">
                <td class="p-3 font-mono">${v.projeto_codigo}${projeto ? ' - ' + projeto.nome : ''}</td>
                <td class="p-3 text-right font-mono">R$ ${vinculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${(vinculado - realizado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('') + `
        <tr class="bg-gray-100 font-bold border-t-2 border-gray-300">
            <td class="p-3">TOTAL</td>
            <td class="p-3 text-right font-mono">R$ ${totalVinculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-3 text-right font-mono">R$ ${totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-3 text-right font-mono">R$ ${(totalVinculado - totalRealizado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    wrapper.classList.remove('hidden');
}

async function renderHistoricoPagamentos(vinculoId) {
    const { data, error } = await _supabase.from('contratos_pagamentos').select('*').eq('vinculo_id', vinculoId).order('registrado_em', { ascending: false });
    const historico = error ? [] : (data || []);

    const tbody = document.getElementById('regValHistoricoTableBody');
    if (!tbody) return;

    tbody.innerHTML = historico.length === 0
        ? `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum pagamento registrado ainda pra este vínculo</td></tr>`
        : historico.map(h => `
            <tr>
                <td class="p-3 text-xs">${h.registrado_em ? new Date(h.registrado_em).toLocaleString('pt-BR') : '-'}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(h.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-xs uppercase">${escapeHtml(h.registrado_por)}</td>
                <td class="p-3 text-xs text-gray-500">${escapeHtml(h.observacao) || '-'}</td>
            </tr>
        `).join('');
}

async function registrarValorRealizado() {
    if (!usuarioPodeIncluirTela('registro_valores_contrato') && !usuarioPodeAlterarTela('registro_valores_contrato')) return alert('Você não tem permissão para registrar valores realizados.');
    if (!regValVinculoAtual) return alert('Selecione um vínculo (projeto + contrato) primeiro!');

    const valorPago = Number(document.getElementById('regValValorInput').value);
    const observacao = document.getElementById('regValObservacaoInput').value.trim();

    if (!valorPago || valorPago <= 0) return alert('Informe um valor pago válido!');

    const saldo = Number(regValVinculoAtual.valor_vinculo) - Number(regValVinculoAtual.valor_realizado || 0);
    if (valorPago > saldo) {
        return alert(`⛔ O valor informado (R$ ${valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) supera o saldo disponível deste vínculo (R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
    }

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();
    const contratoId = regValVinculoAtual.contrato_id;

    const { error: errorPagamento } = await _supabase.from('contratos_pagamentos').insert([{
        contrato_id: contratoId, vinculo_id: regValVinculoAtual.id, valor_pago: valorPago, registrado_por: quem, registrado_em: agora, observacao: observacao || null
    }]);
    if (errorPagamento) return alert('Erro ao registrar o pagamento: ' + errorPagamento.message);

    const novoRealizadoVinculo = Number(regValVinculoAtual.valor_realizado || 0) + valorPago;
    const { error: errorVinculo } = await _supabase.from('contratos_vinculos_projeto').update({ valor_realizado: novoRealizadoVinculo }).eq('id', regValVinculoAtual.id);
    if (errorVinculo) return alert('Pagamento registrado, mas houve erro ao atualizar o total realizado do vínculo: ' + errorVinculo.message);

    // Mantém o agregado do contrato como um todo em sincronia (usado pela
    // tela Contratos Terceirizados e pelo Relatório de Projetos).
    const contrato = contratosProjetoCache.find(c => c.id === contratoId);
    if (contrato) {
        const novoRealizadoContrato = Number(contrato.valor_realizado || 0) + valorPago;
        const { error: errorContrato } = await _supabase.from('contratos_projeto').update({ valor_realizado: novoRealizadoContrato }).eq('id', contratoId);
        if (errorContrato) console.error('Erro ao atualizar o total realizado do contrato:', errorContrato.message);
        else contrato.valor_realizado = novoRealizadoContrato;
    }

    regValVinculoAtual.valor_realizado = novoRealizadoVinculo;
    await recalcularRealizadoProjeto(regValVinculoAtual.projeto_codigo);

    alert('✅ Pagamento registrado com sucesso!');
    await onSelecionarContratoRegistro();
}

// -------------------------------------------------------------------------
// Reconciliação com projetos.realizado (a pedido do usuário 26/08/2026):
// os valores registrados aqui (por vínculo/projeto) precisam compor o
// valor realizado de cada projeto — é o campo que o Dashboard, Consultas
// etc. de fato leem (projetos.realizado), não contratos_vinculos_projeto
// diretamente. Soma o valor gasto legado (projeto_etapas.valor_gasto_
// execucao — G17/Execution) com a soma de todos os vínculos do projeto,
// pra não perder nem sobrescrever nenhuma das duas origens.
// -------------------------------------------------------------------------
async function recalcularRealizadoProjeto(projetoCodigo) {
    const { data: etapasData } = await _supabase.from('projeto_etapas').select('valor_gasto_execucao').eq('projeto_codigo', projetoCodigo);
    const realizadoLegado = (etapasData || []).reduce((acc, e) => acc + (Number(e.valor_gasto_execucao) || 0), 0);

    const { data: vinculosData } = await _supabase.from('contratos_vinculos_projeto').select('valor_realizado').eq('projeto_codigo', projetoCodigo);
    const realizadoNovo = (vinculosData || []).reduce((acc, v) => acc + (Number(v.valor_realizado) || 0), 0);

    const totalRealizado = realizadoLegado + realizadoNovo;

    const { error } = await _supabase.from('projetos').update({ realizado: totalRealizado }).eq('codigo', projetoCodigo);
    if (error) {
        console.error('Erro ao recalcular o valor realizado do projeto:', error.message);
        return;
    }

    const proj = (projectsData || []).find(p => p.codigo === projetoCodigo);
    if (proj) proj.realizado = totalRealizado;
}

// -------------------------------------------------------------------------
// Relatório de Projetos — orçamento em cada fase + propostas do projeto.
// -------------------------------------------------------------------------
// NOVO: lista simples (Código, Nome, Fase Atual, Status, Valor Orçado,
// Valor Realizado), clicável — abre o zoom individual com cabeçalho
// completo do projeto + Propostas + Pagamentos de cada proposta.
async function renderRelatorioProjetosContratosView() {
    const tbody = document.getElementById('relatorioProjetosContratosTableBody');
    if (!tbody) return;

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const lista = filtrarProjetosPorArea([...(projectsData || [])], 'relatorio_projetos_contratos').sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const valorOrcado = Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
        const valorRealizado = Number(p.realizado) || 0;
        return `
            <tr class="cursor-pointer hover:bg-gray-50" onclick="abrirZoomRelatorioProjeto('${escapeJsAttr(p.codigo)}')">
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3">${p.etapa_atual || 'BUSINESS CASE'}</td>
                <td class="p-3">${p.sub_status || '-'}</td>
                <td class="p-3 text-right font-mono">R$ ${valorOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${valorRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------------------
// Zoom individual — cabeçalho completo do projeto (mesmo padrão do
// Detalhamento do Projeto) + Contratos Vinculados (Fase 7: lê pelo
// vínculo N:N — contratos_vinculos_projeto — em vez do antigo
// contratos_projeto.projeto_codigo direto, que deixou de ser preenchido
// desde a Fase 2) + Pagamentos de cada vínculo (contratos_pagamentos).
// -------------------------------------------------------------------------
async function abrirZoomRelatorioProjeto(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    const conteudo = document.getElementById('zoomRelatorioConteudo');
    conteudo.innerHTML = `<div class="p-8 text-center text-gray-400 font-bold">Carregando...</div>`;
    document.getElementById('modalZoomRelatorioProjeto').classList.remove('hidden');

    // Lookups de Tipo de Projeto, Pilar e Iniciativa Estratégica — mesmo
    // padrão usado no Detalhamento do Projeto.
    let tipoProjetoTexto = '-', pilarTexto = '-', iniciativaTexto = '-';
    if (p.tipo_projeto_id) {
        const { data: tp } = await _supabase.from('tipos_projeto').select('*').eq('id', p.tipo_projeto_id).maybeSingle();
        if (tp) tipoProjetoTexto = `${tp.codigo} - ${tp.descricao}`;
    }
    if (p.pilar_estrategico_id) {
        const { data: pilar } = await _supabase.from('pilares_estrategicos').select('*').eq('id', p.pilar_estrategico_id).maybeSingle();
        if (pilar) pilarTexto = pilar.nome;
    }
    if (p.iniciativa_estrategica_id) {
        const { data: ini } = await _supabase.from('iniciativas_estrategicas').select('*').eq('id', p.iniciativa_estrategica_id).maybeSingle();
        if (ini) iniciativaTexto = ini.nome;
    }

    // NOVO (Key Results / Benefit Results): mesmo padrão do Detalhamento do
    // Projeto — exibidos logo após a linha de Pilar/Iniciativa Estratégica.
    const { data: beneficiosData } = await _supabase.from('projeto_benefit_results').select('*, tipos_return_benefit(nome)').eq('projeto_codigo', codigo);
    const beneficiosDoProjeto = beneficiosData || [];

    // Empresas (pra exibir nome, não só código) + contratos vinculados ao
    // projeto via o vínculo N:N (Fase 3/4) — contratos_projeto deixou de
    // ter projeto_codigo obrigatório desde a Fase 2, então a fonte agora
    // é contratos_vinculos_projeto, não mais o contrato direto.
    const { data: empresasData } = await _supabase.from('empresas_terceirizadas').select('*');
    const empresas = empresasData || [];
    const { data: vinculosData } = await _supabase.from('contratos_vinculos_projeto').select('*').eq('projeto_codigo', codigo);
    const vinculos = vinculosData || [];

    let contratosPorId = {};
    if (vinculos.length > 0) {
        const { data: contratosData } = await _supabase.from('contratos_projeto').select('*').in('id', vinculos.map(v => v.contrato_id));
        (contratosData || []).forEach(c => { contratosPorId[c.id] = c; });
    }

    // Pagamentos de TODOS os vínculos do projeto, de uma vez.
    let pagamentosPorVinculo = {};
    if (vinculos.length > 0) {
        const { data: pagamentosData } = await _supabase.from('contratos_pagamentos').select('*').in('vinculo_id', vinculos.map(v => v.id));
        (pagamentosData || []).forEach(pg => {
            if (!pagamentosPorVinculo[pg.vinculo_id]) pagamentosPorVinculo[pg.vinculo_id] = [];
            pagamentosPorVinculo[pg.vinculo_id].push(pg);
        });
    }

    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    conteudo.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-4 mb-4 space-y-1">
            <div class="font-mono font-bold text-red-700 text-lg">${p.codigo}</div>
            <div class="text-lg font-bold text-gray-800">${escapeHtml(p.nome)}</div>
            <div class="text-xs text-gray-500">Área Solicitante: <b>${p.area || '-'}</b> · Porte: <b>${p.tamanho || '-'}</b> (${horasAtuaisDoProjeto(p)}h) · Qualificação: <b>${(p.tipo_qualificacao || '-').toUpperCase()}</b> · Ano Fiscal: <b>${p.ano_fiscal || '-'}</b></div>
            <div class="text-xs text-gray-500">Solicitante: <b>${escapeHtml(p.pessoa_solicitante) || '-'}</b> · Formalizado em: <b>${p.data_solicitacao || '-'}</b></div>
            <div class="text-xs text-gray-500">Tipo de Projeto: <b>${escapeHtml(tipoProjetoTexto)}</b></div>
            <div class="text-xs text-gray-500">Pilar Estratégico: <b>${escapeHtml(pilarTexto)}</b> · Iniciativa Estratégica: <b>${escapeHtml(iniciativaTexto)}</b></div>
            <div class="text-xs text-gray-500 mt-1">Objetivo: <b>${escapeHtml(p.objetivo) || '-'}</b></div>
            <div class="text-xs text-gray-500 mt-1">Key Results: <b>${escapeHtml(p.key_results) || '-'}</b></div>
            <div class="text-xs text-gray-600 mt-2 bg-white rounded p-2">
                <b class="text-gray-500 uppercase text-[10px] block mb-1">Benefit Results</b>
                ${beneficiosDoProjeto.length === 0
                    ? '<div class="italic text-gray-400">Nenhum Benefit Result cadastrado</div>'
                    : beneficiosDoProjeto.map(b => `
                        <div>${escapeHtml((b.tipos_return_benefit || {}).nome) || '-'}${b.metrica ? ` — <b>${escapeHtml(b.metrica)}</b>: R$ ${Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</div>
                    `).join('')}
            </div>
            ${p.descricao_projeto ? `<div class="text-xs text-gray-600 mt-2 bg-white rounded p-2"><b class="text-gray-500 uppercase text-[10px] block">Descrição do Projeto</b>${escapeHtml(p.descricao_projeto)}</div>` : ''}
        </div>

        <h4 class="font-bold text-gray-800 text-sm mb-2 uppercase tracking-wider border-b pb-1">Contratos Vinculados</h4>
        ${vinculos.length === 0
            ? `<p class="text-xs text-gray-400 italic mb-4">Nenhum contrato vinculado a este projeto.</p>`
            : vinculos.map(v => {
                const c = contratosPorId[v.contrato_id];
                const empresa = c ? empresas.find(e => e.codigo === c.empresa_codigo) : null;
                const pagamentos = pagamentosPorVinculo[v.id] || [];
                return `
                    <div class="border border-gray-200 rounded-lg mb-3 overflow-hidden">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead><tr class="bg-gray-50 text-gray-600 font-semibold uppercase">
                                <th class="p-2">Contrato</th><th class="p-2">Empresa</th>
                                <th class="p-2 text-right">Valor Alocado a Este Projeto</th><th class="p-2">Vigência do Contrato</th>
                                <th class="p-2 text-right">Realizado Neste Projeto</th>
                            </tr></thead>
                            <tbody>
                                <tr class="border-t">
                                    <td class="p-2 font-mono font-bold">${escapeHtml(c ? c.numero_contrato : '-')}</td>
                                    <td class="p-2">${escapeHtml(empresa ? empresa.nome : (c ? c.empresa_codigo : '-'))}</td>
                                    <td class="p-2 text-right font-mono">${fmt(v.valor_vinculo)}</td>
                                    <td class="p-2">${c ? (c.data_inicio || '-') + (c.data_encerramento ? ' a ' + c.data_encerramento : '') : '-'}</td>
                                    <td class="p-2 text-right font-mono">${fmt(v.valor_realizado)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="bg-gray-50 px-3 py-2 border-t">
                            <p class="text-[10px] font-bold uppercase text-gray-500 mb-1">Pagamentos deste Vínculo</p>
                            ${pagamentos.length === 0
                                ? `<p class="text-[11px] text-gray-400 italic">Nenhum pagamento registrado ainda.</p>`
                                : `<table class="w-full text-left text-[11px]">
                                    <thead><tr class="text-gray-500 uppercase text-[9px]"><th class="py-1">Data</th><th class="py-1 text-right">Valor Pago</th><th class="py-1">Quem Autorizou</th></tr></thead>
                                    <tbody>
                                        ${pagamentos.map(pg => `
                                            <tr class="border-t border-gray-200">
                                                <td class="py-1">${pg.registrado_em ? new Date(pg.registrado_em).toLocaleString('pt-BR') : '-'}</td>
                                                <td class="py-1 text-right font-mono">${fmt(pg.valor_pago)}</td>
                                                <td class="py-1 uppercase">${escapeHtml(pg.registrado_por) || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>`}
                        </div>
                    </div>
                `;
            }).join('')
        }
    `;
}

function fecharModalZoomRelatorioProjeto() {
    document.getElementById('modalZoomRelatorioProjeto').classList.add('hidden');
}
