// =========================================================================
// approvals/orcamento-af.js
// Aprovação do Orçamento do Ano Fiscal (SCR-02 · Pacote FY).
//
// D-02: FY aprova o valor integral ou devolve com motivo. Não existe
//       "Ajustado" — o valor aceito pelo Owner é imutável neste fluxo.
// D-05: Status no FY / Situação / Provisioning são colunas independentes
//       (gravadas em pacote_fy_itens via Fase 1 SQL).
// D-07: Extraordinários têm seção e totais próprios.
// D-10: Baseline V1 = valor gravado em business_cases.val_aprovado_fy
//       no momento do fechamento do FY.
// =========================================================================

async function renderAprovOrcamentoAFView() {
    const afAberto = await obterAFAbertoParaDemandas();
    const infoAF = getInfoAnoFiscal();
    const afStr = afAberto || infoAF.proximoAFStr;

    const elAfLabel = document.getElementById('afLabelDisplay');
    if (elAfLabel) elAfLabel.innerText = afAberto ? afStr : `${afStr} (nenhum AF aberto no momento)`;

    // Regulares: BUSINESS CASE + APROVADO, excluindo adhoc e carryover
    const projsRegulares = projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        p.sub_status === 'APROVADO' &&
        p.is_adhoc !== true &&
        p.is_carryover !== true
    );

    // Extraordinários: adhoc aprovados ainda em BUSINESS CASE
    const projsExtra = projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        p.sub_status === 'APROVADO' &&
        p.is_adhoc === true
    );

    const soma = (arr) => arr.reduce((acc, p) => acc + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const valorRegular = soma(projsRegulares);
    const valorExtra   = soma(projsExtra);
    const valorTotal   = valorRegular + valorExtra;

    const valorCapex = projsRegulares
        .filter(p => (p.tipo_orcamento||'').toUpperCase() === 'CAPEX')
        .reduce((acc, p) => acc + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const valorOpex = valorRegular - valorCapex;

    const elValTotal = document.getElementById('afValTotalDisplay');
    if (elValTotal) elValTotal.innerText = formatCurrency(valorTotal);
    const elValCapex = document.getElementById('afValCapexDisplay');
    if (elValCapex) elValCapex.innerText = formatCurrency(valorCapex);
    const elValOpex = document.getElementById('afValOpexDisplay');
    if (elValOpex) elValOpex.innerText = formatCurrency(valorOpex);

    // Buscar status_fy dos itens persistidos (se o pacote já foi fechado antes)
    let fyItemMap = {};
    try {
        const { data: fyItems } = await _supabase
            .from('pacote_fy_itens')
            .select('business_case_codigo, status_fy, situacao, provisioning, motivo_devolucao')
            .in('business_case_codigo', [...projsRegulares, ...projsExtra].map(p => p.codigo));
        (fyItems || []).forEach(i => { fyItemMap[i.business_case_codigo] = i; });
    } catch(_) {}

    // Helper: badges das colunas D-05
    const badgeStatusFy = (item) => {
        if (!item) return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">Em análise</span>';
        const s = (item.status_fy || 'INCLUIDO').toUpperCase();
        if (s === 'APROVADO')   return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Aprovado</span>';
        if (s === 'DEVOLVIDO')  return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">Devolvido</span>';
        if (s === 'REJEITADO')  return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">Rejeitado</span>';
        if (s === 'POSTERGADO') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">Postergado</span>';
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">Em análise</span>';
    };
    const badgeSituacao = (item) => {
        if (!item || !item.situacao) return '<span class="text-xs text-gray-400">—</span>';
        const s = (item.situacao || '').toUpperCase();
        if (s === 'ATIVO')        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Atual</span>';
        if (s === 'DESATUALIZADO') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">Desatualizado</span>';
        return '<span class="text-xs text-gray-500">' + escapeHtml(item.situacao) + '</span>';
    };
    const badgeProvisioning = (item) => {
        if (!item) return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Não provisionado</span>';
        if (item.provisioning === true || item.provisioning === 'true')
            return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Provisionado</span>';
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Não provisionado</span>';
    };

    // Linha de tabela regular (com D-05)
    const rowRegular = (p) => {
        const item = fyItemMap[p.codigo];
        const qualif = (p.tipo_qualificacao || 'REG').toUpperCase();
        const badgeQ = qualif === 'GROW' ? 'bg-purple-100 text-purple-800' : qualif === 'RUN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
        const valor = Number(p.val_bc)||Number(p.previsto)||0;
        return `
            <tr class="hover:bg-gray-50">
                <td class="p-3 font-mono font-bold text-green-800 text-xs">${escapeHtml(p.codigo)}</td>
                <td class="p-3 font-semibold text-xs">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs"><span class="text-[10px] px-2 py-0.5 rounded font-bold ${badgeQ}">${qualif}</span></td>
                <td class="p-3 text-xs text-right font-mono font-bold text-emerald-700">${formatCurrency(valor)}</td>
                <td class="p-3 text-xs">${badgeStatusFy(item)}</td>
                <td class="p-3 text-xs">${badgeSituacao(item)}</td>
                <td class="p-3 text-xs">${badgeProvisioning(item)}</td>
                <td class="p-3 text-xs text-right">
                    <button onclick="devolverBCDoFY('${escapeHtml(p.codigo)}')"
                        class="text-xs font-bold text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 mr-1">
                        Devolver
                    </button>
                </td>
            </tr>`;
    };

    const tbody = document.getElementById('afOrcamentoTableBody');
    if (tbody) {
        if (projsRegulares.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold text-xs">Nenhum BC com status APROVADO para o Pacote ${afStr}</td></tr>`;
        } else {
            tbody.innerHTML = projsRegulares.map(rowRegular).join('');
        }
    }

    // D-07: Extraordinários
    const tbodyExtra = document.getElementById('afExtraTableBody');
    if (tbodyExtra) {
        if (projsExtra.length === 0) {
            tbodyExtra.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-400 font-bold text-xs">Nenhum extraordinário aprovado no momento.</td></tr>`;
        } else {
            tbodyExtra.innerHTML = projsExtra.map(p => {
                const item = fyItemMap[p.codigo];
                const valor = Number(p.val_bc)||Number(p.previsto)||0;
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3 font-mono font-bold text-xs text-indigo-800">${escapeHtml(p.codigo)}</td>
                        <td class="p-3 text-xs font-semibold">${escapeHtml(p.nome)}</td>
                        <td class="p-3 text-xs text-right font-mono font-bold text-emerald-700">${formatCurrency(valor)}</td>
                        <td class="p-3 text-xs">${badgeStatusFy(item)}</td>
                    </tr>`;
            }).join('');
        }
    }

    // Totais D-07
    const elTotRegular = document.getElementById('afTotRegular');
    const elTotExtra   = document.getElementById('afTotExtra');
    const elTotFY      = document.getElementById('afTotFY');
    if (elTotRegular) elTotRegular.innerText = formatCurrency(valorRegular);
    if (elTotExtra)   elTotExtra.innerText   = formatCurrency(valorExtra);
    if (elTotFY)      elTotFY.innerText      = formatCurrency(valorTotal);
}

// -------------------------------------------------------------------------
// AÇÃO: Devolver BC ao Owner (D-02)
// -------------------------------------------------------------------------
async function devolverBCDoFY(codigo) {
    if (!usuarioPodeAlterarTela('aprov_orcamento_af'))
        return alert('Você não tem permissão para devolver um BC do Pacote FY.');

    const motivo = prompt(`Devolver BC ${codigo} para reavaliação.\n\nInforme o motivo (obrigatório):`);
    if (!motivo || !motivo.trim()) return;

    const hoje = new Date().toISOString().split('T')[0];

    // Atualiza o BC para DEVOLVIDO_FY com motivo
    const { error } = await _supabase.from('projetos').update({
        sub_status: 'DEVOLVIDO_FY',
        motivo_devolucao_fy: motivo.trim(),
        dt_devolucao_fy: hoje,
    }).eq('codigo', codigo);

    if (error) {
        console.error('Erro ao devolver BC:', error.message);
        return alert('Erro ao devolver BC: ' + error.message);
    }

    // Atualiza o item do pacote FY se já existe linha
    await _supabase.from('pacote_fy_itens').update({
        status_fy: 'DEVOLVIDO',
        motivo_devolucao: motivo.trim(),
    }).eq('business_case_codigo', codigo);

    // Atualiza cache local
    const prj = projectsData.find(p => p.codigo === codigo);
    if (prj) {
        prj.sub_status = 'DEVOLVIDO_FY';
        prj.motivo_devolucao_fy = motivo.trim();
        prj.dt_devolucao_fy = hoje;
    }

    await renderAprovOrcamentoAFView();
    alert(`BC ${codigo} devolvido para reavaliação.\nMotivo registrado.`);
}

// -------------------------------------------------------------------------
// FECHAR ORÇAMENTO AF (batch)
// -------------------------------------------------------------------------
async function executarAprovacaoGlobalOrcamentoAF() {
    if (!usuarioPodeAlterarTela('aprov_orcamento_af'))
        return alert('Você não tem permissão para fechar o Orçamento do Ano Fiscal.');

    const afStr = await obterAFAbertoParaDemandas();
    if (!afStr) {
        return alert('⛔ Nenhum Ano Fiscal está aberto para recebimento de demandas no momento — não há o que fechar.');
    }

    const projetosDoAno = projectsData.filter(p => p.ano_fiscal === afStr || !p.ano_fiscal);
    const pendentes = projetosDoAno.filter(p =>
        (!p.etapa_atual || p.etapa_atual === 'BUSINESS CASE') &&
        p.is_adhoc !== true &&
        p.is_carryover !== true &&
        ['A PLANEJAR', 'PLANEJADO', 'ORÇAMENTO REALIZADO'].includes(p.sub_status)
    );

    if (pendentes.length > 0) {
        alert(`⚠️ O orçamento não pode ser fechado!\n\nAinda existem projetos registrados na fase de Business Case que não foram totalmente avaliados.`);
        return;
    }

    const projsAprovados = projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        p.sub_status === 'APROVADO' &&
        p.is_adhoc !== true &&
        p.is_carryover !== true
    );

    if (projsAprovados.length === 0) {
        return alert("Não há projetos qualificados com status 'APROVADO' para fechamento do orçamento!");
    }

    const valorTotalAF = projsAprovados.reduce((acc, p) => acc + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const dtAprovacaoHoje = new Date().toISOString().split('T')[0];

    const mensagemConfirmacao = `CONFIRMAÇÃO DE APROVAÇÃO DO ORÇAMENTO AF:\n\n` +
        `• Projetos Qualificados: ${projsAprovados.length}\n` +
        `• Valor Total do Orçamento Homologado: ${formatCurrency(valorTotalAF)}\n\n` +
        `Ao confirmar, o orçamento será oficialmente FECHADO e novas demandas comuns serão bloqueadas. Deseja prosseguir?`;

    if (!confirm(mensagemConfirmacao)) return;

    // Persiste Pacote FY (V4 — registro histórico)
    const { data: pacoteFyRow, error: errorPacoteFy } = await _supabase.from('pacotes_fy').insert([{
        ano_fiscal: afStr,
        status: 'FECHADO',
        valor_total: valorTotalAF,
        qtd_projetos: projsAprovados.length,
        fechado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]).select('id').single();
    if (errorPacoteFy) {
        console.error('Erro ao registrar Pacote FY:', errorPacoteFy.message);
    } else if (pacoteFyRow) {
        const itensPacote = projsAprovados.map(p => ({
            pacote_fy_id: pacoteFyRow.id,
            business_case_codigo: p.codigo,
            valor_incluido: Number(p.val_bc)||Number(p.previsto)||0,
            status_fy: 'APROVADO',
            situacao: 'ATIVO',
            provisioning: false,
        }));
        const { error: errorItensPacote } = await _supabase.from('pacote_fy_itens').insert(itensPacote);
        if (errorItensPacote) console.error('Erro ao registrar itens do Pacote FY:', errorItensPacote.message);
    }

    for (const prj of projsAprovados) {
        const diasSlaReq = obterSlaPorNomeEtapa('GERAR REQUERIMENTOS', prj.tamanho);
        const dt_limite_req = somarDiasUteis(dtAprovacaoHoje, diasSlaReq);
        const valorAprovado = Number(prj.val_bc)||Number(prj.previsto)||0;

        const payloadUpdate = {
            etapa_atual: 'REQUIREMENTS',
            sub_status: 'A PLANEJAR',
            data_solicitacao_req: dtAprovacaoHoje,
            dt_limite_req: dt_limite_req,
            val_aprovado_fy: valorAprovado,  // D-10: baseline V1
        };

        let { error } = await _supabase.from('projetos').update(payloadUpdate).eq('codigo', prj.codigo);
        if (error) {
            await _supabase.from('projetos').update({
                etapa_atual: 'REQUIREMENTS', sub_status: 'A PLANEJAR'
            }).eq('codigo', prj.codigo);
        }

        prj.etapa_atual = 'REQUIREMENTS';
        prj.sub_status = 'A PLANEJAR';
        prj.data_solicitacao_req = dtAprovacaoHoje;
        prj.dt_limite_req = dt_limite_req;
        prj.val_aprovado_fy = valorAprovado;

        await dispararEmailFluxo('BUSINESS CASE', 'APROVAR ORÇAMENTO ANO FISCAL', 'Após aprovar orçamento Fiscal Year', prj, {});
    }

    alert(`✅ Orçamento do Ano Fiscal APROVADO e FECHADO com sucesso!\n\n${projsAprovados.length} projetos promovidos para a fase de REQUERIMENTOS.`);

    // Log formal do fechamento
    const { error: errorLogFechamento } = await _supabase.from('fiscal_years').upsert({
        codigo: afStr,
        orcamento_fechado: true,
        recebimento_demandas_aberto: false,
        fechado_por: currentUser ? currentUser.nome : 'desconhecido',
        fechado_em: new Date().toISOString(),
        valor_total_fechado: valorTotalAF,
        qtd_projetos_fechado: projsAprovados.length,
        status: 'OPEN'
    }, { onConflict: 'codigo' });
    if (errorLogFechamento) console.error('Erro ao logar fechamento do AF:', errorLogFechamento.message);

    await loadProjects();
    switchTab('req_planejamento');
}
