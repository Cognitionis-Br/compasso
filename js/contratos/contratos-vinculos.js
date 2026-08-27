// =========================================================================
// contratos/contratos-vinculos.js
// NOVO (a pedido do usuário 25/08/2026 — Fase 3 da padronização de telas):
// "Contratos por Projeto" — vínculo N:N entre Contratos Terceirizados
// (contratos_projeto, já sem projeto obrigatório desde a Fase 2) e
// Projetos. Regras:
// - 1 contrato pode ser ligado a vários projetos, e 1 projeto a vários
//   contratos.
// - O valor do vínculo não pode superar o valor total do contrato menos
//   o que já está vinculado a OUTROS projetos.
// - A soma dos vínculos de um projeto não pode superar o orçamento dele
//   (val_tech||val_req||val_bc||previsto, mesmo critério usado no resto
//   do sistema).
// - Só é editável/excluível enquanto o VÍNCULO ainda não tiver nenhum
//   valor_realizado (Fase 4 — Registro de Valores Realizados passou a
//   controlar o realizado por vínculo, não mais pelo contrato inteiro).
// - Toda inclusão/alteração/exclusão é logada em
//   log_alteracao_vinculo_contrato, exibida no Detalhamento do Projeto
//   (js/projeto-detalhe/projeto-detalhe.js).
// =========================================================================

let contratosVinculosCache = [];

function obterProjetosElegiveisParaVinculoContrato() {
    return (projectsData || []).filter(p => (p.etapa_atual || 'BUSINESS CASE').toUpperCase() !== 'BUSINESS CASE');
}

function obterOrcamentoProjeto(p) {
    return Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
}

async function renderContratosVinculosView() {
    await renderContratosProjetoView(); // garante contratosProjetoCache/empresasTerceirizadasCache atualizados

    const selectProjeto = document.getElementById('vinculoProjetoSelect');
    if (selectProjeto) {
        selectProjeto.innerHTML = '<option value="">-- Selecione --</option>' +
            obterProjetosElegiveisParaVinculoContrato().sort((a, b) => a.codigo.localeCompare(b.codigo)).map(p => `<option value="${p.codigo}">${p.codigo} - ${escapeHtml(p.nome)}</option>`).join('');
    }

    const selectContrato = document.getElementById('vinculoContratoSelect');
    if (selectContrato) {
        const contratosAtivos = contratosProjetoCache.filter(c => (c.status || 'ATIVO') === 'ATIVO');
        selectContrato.innerHTML = '<option value="">-- Selecione --</option>' +
            contratosAtivos.map(c => {
                const empresa = empresasTerceirizadasCache.find(e => e.codigo === c.empresa_codigo);
                return `<option value="${c.id}">${escapeHtml(c.numero_contrato)} — ${escapeHtml(empresa ? empresa.nome : c.empresa_codigo)}</option>`;
            }).join('');
    }

    const { data, error } = await _supabase.from('contratos_vinculos_projeto').select('*').order('id', { ascending: false });
    contratosVinculosCache = error ? [] : (data || []);

    if (typeof atualizarInfoHorasVinculo === 'function') atualizarInfoHorasVinculo(); // selects foram resetados acima

    const tbody = document.getElementById('contratosVinculosTableBody');
    if (!tbody) return;

    if (contratosVinculosCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum vínculo cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = contratosVinculosCache.map(v => {
        const contrato = contratosProjetoCache.find(c => c.id === v.contrato_id);
        const empresa = contrato ? empresasTerceirizadasCache.find(e => e.codigo === contrato.empresa_codigo) : null;
        const projeto = (projectsData || []).find(p => p.codigo === v.projeto_codigo);
        const editavel = Number(v.valor_realizado || 0) === 0;
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-red-700">${v.projeto_codigo}${projeto ? ' - ' + escapeHtml(projeto.nome) : ''}</td>
                <td class="p-3 text-xs">${escapeHtml(contrato ? contrato.numero_contrato : '-')}</td>
                <td class="p-3 text-xs">${escapeHtml(empresa ? empresa.nome : (contrato ? contrato.empresa_codigo : '-'))}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(v.valor_vinculo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-center">
                    ${editavel
                        ? `<button onclick="excluirVinculoContrato(${v.id})" class="text-red-600 hover:text-red-800 font-bold text-xs"><i class="fa-solid fa-trash-can"></i> Excluir</button>`
                        : `<span class="text-gray-400 text-[10px] font-bold" title="Vínculo já com valor realizado — travado">🔒 Travado</span>`}
                </td>
            </tr>
        `;
    }).join('');
}

// Soma dos vínculos já existentes de um contrato, opcionalmente
// excluindo um vínculo específico (usado ao recalcular limites antes de
// salvar/editar).
function somaVinculosDoContrato(contratoId, excluirVinculoId) {
    return contratosVinculosCache
        .filter(v => v.contrato_id === contratoId && v.id !== excluirVinculoId)
        .reduce((acc, v) => acc + Number(v.valor_vinculo), 0);
}

// Soma dos vínculos já existentes de um projeto, opcionalmente excluindo
// um vínculo específico.
function somaVinculosDoProjeto(projetoCodigo, excluirVinculoId) {
    return contratosVinculosCache
        .filter(v => v.projeto_codigo === projetoCodigo && v.id !== excluirVinculoId)
        .reduce((acc, v) => acc + Number(v.valor_vinculo), 0);
}

// NOVO (a pedido do usuário 26/08/2026): horas equivalentes já vinculadas
// de um projeto/contrato — cada vínculo só guarda o VALOR (R$), então a
// conversão pra horas usa o valor_hora do contrato daquele vínculo
// (horas = valor_vinculo / valor_hora). Um projeto pode ter vínculos em
// contratos com valor_hora diferentes, por isso soma-se cada um convertido
// individualmente; um contrato tem um único valor_hora, então dá pra
// converter a soma direto.
function somaHorasVinculadasDoProjeto(projetoCodigo, excluirVinculoId) {
    return contratosVinculosCache
        .filter(v => v.projeto_codigo === projetoCodigo && v.id !== excluirVinculoId)
        .reduce((acc, v) => {
            const c = contratosProjetoCache.find(x => x.id === v.contrato_id);
            const valorHora = c ? Number(c.valor_hora) : 0;
            return acc + (valorHora > 0 ? Number(v.valor_vinculo) / valorHora : 0);
        }, 0);
}

function somaHorasVinculadasDoContrato(contratoId, excluirVinculoId) {
    const c = contratosProjetoCache.find(x => x.id === contratoId);
    const valorHora = c ? Number(c.valor_hora) : 0;
    if (valorHora <= 0) return 0;
    return somaVinculosDoContrato(contratoId, excluirVinculoId) / valorHora;
}

// NOVO: painel informativo de horas (projeto e contrato) na tela de Novo
// Vínculo — não bloqueia nada, é só apoio pra decidir o valor do vínculo.
function atualizarInfoHorasVinculo() {
    const projetoCodigo = document.getElementById('vinculoProjetoSelect').value;
    const contratoId = Number(document.getElementById('vinculoContratoSelect').value) || null;
    const painel = document.getElementById('vinculoInfoHoras');
    if (!painel) return;

    if (!projetoCodigo && !contratoId) {
        painel.classList.add('hidden');
        return;
    }
    painel.classList.remove('hidden');

    const fmtH = (h) => `${Number(h || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
    const fmtR = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // AJUSTADO (a pedido do usuário 26/08/2026): o vínculo é feito por
    // VALOR (R$), não por horas — o painel precisa trazer o valor em
    // destaque (é o que o campo pede). Horas continuam exibidas, mas só
    // como referência secundária de apoio.
    if (projetoCodigo) {
        const projeto = (projectsData || []).find(p => p.codigo === projetoCodigo);
        const totalValor = projeto ? obterOrcamentoProjeto(projeto) : 0;
        const valorVinculado = somaVinculosDoProjeto(projetoCodigo, null);
        document.getElementById('vinculoProjetoValorTotal').innerText = fmtR(totalValor);
        document.getElementById('vinculoProjetoValorVinculado').innerText = fmtR(valorVinculado);
        document.getElementById('vinculoProjetoValorSaldo').innerText = fmtR(totalValor - valorVinculado);

        const totalHoras = projeto ? horasAtuaisDoProjeto(projeto) : 0;
        const horasVinculadas = somaHorasVinculadasDoProjeto(projetoCodigo, null);
        document.getElementById('vinculoProjetoHorasTotal').innerText = fmtH(totalHoras);
        document.getElementById('vinculoProjetoHorasVinculado').innerText = fmtH(horasVinculadas);
        document.getElementById('vinculoProjetoHorasSaldo').innerText = fmtH(totalHoras - horasVinculadas);
    } else {
        ['vinculoProjetoValorTotal', 'vinculoProjetoValorVinculado', 'vinculoProjetoValorSaldo'].forEach(id => document.getElementById(id).innerText = '-');
        ['vinculoProjetoHorasTotal', 'vinculoProjetoHorasVinculado', 'vinculoProjetoHorasSaldo'].forEach(id => document.getElementById(id).innerText = '-');
    }

    if (contratoId) {
        const contrato = contratosProjetoCache.find(c => c.id === contratoId);
        const totalValor = contrato ? Number(contrato.valor_total) || 0 : 0;
        const valorVinculado = somaVinculosDoContrato(contratoId, null);
        document.getElementById('vinculoContratoValorTotal').innerText = fmtR(totalValor);
        document.getElementById('vinculoContratoValorVinculado').innerText = fmtR(valorVinculado);
        document.getElementById('vinculoContratoValorSaldo').innerText = fmtR(totalValor - valorVinculado);

        const totalHoras = contrato ? Number(contrato.quantidade_horas) || 0 : 0;
        const horasVinculadas = somaHorasVinculadasDoContrato(contratoId, null);
        document.getElementById('vinculoContratoHorasTotal').innerText = fmtH(totalHoras);
        document.getElementById('vinculoContratoHorasVinculado').innerText = fmtH(horasVinculadas);
        document.getElementById('vinculoContratoHorasSaldo').innerText = fmtH(totalHoras - horasVinculadas);
    } else {
        ['vinculoContratoValorTotal', 'vinculoContratoValorVinculado', 'vinculoContratoValorSaldo'].forEach(id => document.getElementById(id).innerText = '-');
        ['vinculoContratoHorasTotal', 'vinculoContratoHorasVinculado', 'vinculoContratoHorasSaldo'].forEach(id => document.getElementById(id).innerText = '-');
    }
}

async function logAlteracaoVinculoContrato(contratoId, projetoCodigo, acao, valorAnterior, valorNovo) {
    const { error } = await _supabase.from('log_alteracao_vinculo_contrato').insert([{
        contrato_id: contratoId,
        projeto_codigo: projetoCodigo,
        acao,
        valor_anterior: valorAnterior,
        valor_novo: valorNovo,
        alterado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (error) console.error('Erro ao logar alteração de vínculo de contrato:', error.message);
}

async function salvarVinculoContrato() {
    const projetoCodigo = document.getElementById('vinculoProjetoSelect').value;
    const contratoId = Number(document.getElementById('vinculoContratoSelect').value);
    const valorVinculo = Number(document.getElementById('vinculoValorInput').value);

    if (!projetoCodigo || !contratoId || !valorVinculo || valorVinculo <= 0) {
        return alert('Selecione o Projeto, o Contrato e informe um Valor do Vínculo válido!');
    }

    if (contratosVinculosCache.some(v => v.contrato_id === contratoId && v.projeto_codigo === projetoCodigo)) {
        return alert('⛔ Este contrato já está vinculado a este projeto — edite o vínculo existente em vez de criar outro.');
    }

    const contrato = contratosProjetoCache.find(c => c.id === contratoId);
    if (!contrato) return alert('Contrato não encontrado.');

    // Regra: valor do vínculo não pode superar o valor total do contrato
    // menos o que já está vinculado a outros projetos.
    const saldoContrato = Number(contrato.valor_total) - somaVinculosDoContrato(contratoId, null);
    if (valorVinculo > saldoContrato) {
        return alert(`⛔ O valor do vínculo (R$ ${valorVinculo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) supera o saldo disponível deste contrato (R$ ${saldoContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, já considerando outros vínculos).`);
    }

    // Regra: soma dos vínculos do projeto não pode superar o orçamento dele.
    const projeto = (projectsData || []).find(p => p.codigo === projetoCodigo);
    const orcamentoProjeto = projeto ? obterOrcamentoProjeto(projeto) : 0;
    const totalVinculadoProjeto = somaVinculosDoProjeto(projetoCodigo, null) + valorVinculo;
    if (orcamentoProjeto > 0 && totalVinculadoProjeto > orcamentoProjeto) {
        return alert(`⛔ A soma dos vínculos deste projeto (R$ ${totalVinculadoProjeto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) superaria o orçamento dele (R$ ${orcamentoProjeto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
    }

    const { error } = await _supabase.from('contratos_vinculos_projeto').insert([{
        contrato_id: contratoId,
        projeto_codigo: projetoCodigo,
        valor_vinculo: valorVinculo,
        criado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (error) return alert('Erro ao salvar o vínculo: ' + error.message);

    await logAlteracaoVinculoContrato(contratoId, projetoCodigo, 'CRIADO', null, valorVinculo);

    alert('✅ Vínculo criado com sucesso!');
    document.getElementById('vinculoProjetoSelect').value = '';
    document.getElementById('vinculoContratoSelect').value = '';
    document.getElementById('vinculoValorInput').value = '';
    await renderContratosVinculosView();
}

async function excluirVinculoContrato(id) {
    const v = contratosVinculosCache.find(x => x.id === id);
    if (!v) return;

    if (Number(v.valor_realizado || 0) > 0) {
        return alert('⛔ Este vínculo já tem valor realizado — não pode mais ser excluído.');
    }

    const contrato = contratosProjetoCache.find(c => c.id === v.contrato_id);
    if (!confirm(`Confirma excluir o vínculo entre o projeto ${v.projeto_codigo} e o contrato ${contrato ? contrato.numero_contrato : v.contrato_id}?`)) return;

    const { error } = await _supabase.from('contratos_vinculos_projeto').delete().eq('id', id);
    if (error) return alert('Erro ao excluir o vínculo: ' + error.message);

    await logAlteracaoVinculoContrato(v.contrato_id, v.projeto_codigo, 'EXCLUIDO', v.valor_vinculo, null);

    alert('✅ Vínculo excluído.');
    await renderContratosVinculosView();
}
