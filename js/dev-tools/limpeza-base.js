// =========================================================================
// dev-tools/limpeza-base.js
// Item 20 (relatório de melhorias): ferramenta de limpeza física da base
// — DIFERENTE do reset (que só volta projetos pra Fase 1, sem apagar).
// Esta apaga de verdade:
// - Todo Ano Fiscal diferente de AF2027 (config + projetos daquele AF)
// - Toda demanda Extraordinária ou Carryover, mesmo as do próprio AF2027
// Depois: reabre o AF2027 pra demandas normais, e reajusta o contador de
// código de projeto pra bater com o que sobrar (evita gerar códigos com
// gap ou colidindo com o que ainda existe).
//
// Também traz a lista de projetos cadastrados (atualizada sempre que a
// aba abre, e depois de qualquer limpeza) com exclusão física seletiva,
// item por item.
// =========================================================================

let devToolsProjetosSelecionados = new Set();

async function limparBaseSomenteAF2027() {
    if (!ehAdministrador) {
        return alert('⛔ Esta ferramenta é restrita a usuários com a função ADMINISTRADOR.');
    }

    const AF_MANTIDO = 'AF2027';

    const projetosParaApagar = (projectsData || []).filter(p =>
        p.ano_fiscal !== AF_MANTIDO || p.is_adhoc === true || p.is_carryover === true
    );
    const projetosQueFicam = (projectsData || []).filter(p =>
        p.ano_fiscal === AF_MANTIDO && p.is_adhoc !== true && p.is_carryover !== true
    );

    const confirmacao = confirm(
        `⚠️ LIMPEZA FÍSICA DE BASE\n\n` +
        `Isso vai APAGAR PERMANENTEMENTE ${projetosParaApagar.length} projeto(s):\n` +
        `- Todos que não forem do ${AF_MANTIDO}\n` +
        `- Todos os marcados como Extraordinário ou Carryover (mesmo os do ${AF_MANTIDO})\n\n` +
        `Vão RESTAR ${projetosQueFicam.length} projeto(s) — só demandas normais do ${AF_MANTIDO}.\n\n` +
        `Também vai:\n` +
        `- Apagar a configuração de todo Ano Fiscal diferente de ${AF_MANTIDO}, deixando o ${AF_MANTIDO} reaberto pra demandas normais\n` +
        `- Zerar a numeração de projetos de TODOS os Anos Fiscais (não só o mantido)\n` +
        `- Limpar inteira a fila de e-mails pendentes de envio\n\n` +
        `Esta ação NÃO PODE ser desfeita. Deseja continuar?`
    );
    if (!confirmacao) return;

    const codigosParaApagar = projetosParaApagar.map(p => p.codigo);

    if (codigosParaApagar.length > 0) {
        const { error: errorEtapas } = await _supabase.from('projeto_etapas').delete().in('projeto_codigo', codigosParaApagar);
        if (errorEtapas) console.error('Erro ao limpar projeto_etapas:', errorEtapas.message);

        const { error: errorAdhoc } = await _supabase.from('adhoc_aprovacoes').delete().in('projeto_adhoc_codigo', codigosParaApagar);
        if (errorAdhoc) console.error('Erro ao limpar adhoc_aprovacoes:', errorAdhoc.message);

        // NOVOS (a pedido do usuário 24/08/2026): logs dedicados de
        // Porte por Horas (cessão parcial) e de Retomar Projetos em
        // Hold — mesma exigência de limpar antes de apagar o projeto.
        const { error: errorLogHoras } = await _supabase.from('log_alteracoes_horas').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogHoras) console.error('Erro ao limpar log_alteracoes_horas:', errorLogHoras.message);

        const { error: errorLogHold } = await _supabase.from('log_retomada_hold').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogHold) console.error('Erro ao limpar log_retomada_hold:', errorLogHold.message);

        // NOVO (a pedido do usuário 25/08/2026): log de Ratificação/
        // Retificação do planejamento de UAT/Go-Live — mesma exigência de
        // limpar antes de apagar o projeto.
        const { error: errorLogRatif } = await _supabase.from('log_ratificacao_planejamento').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogRatif) console.error('Erro ao limpar log_ratificacao_planejamento:', errorLogRatif.message);

        // NOVOS (a pedido do usuário 25/08/2026): Ocorrências de Erro e
        // Termo de Aceite do Go-Live — mesma exigência de limpar antes de
        // apagar o projeto.
        const { error: errorGoliveOcorrencias } = await _supabase.from('golive_ocorrencias').delete().in('projeto_codigo', codigosParaApagar);
        if (errorGoliveOcorrencias) console.error('Erro ao limpar golive_ocorrencias:', errorGoliveOcorrencias.message);

        const { error: errorGoliveTermo } = await _supabase.from('golive_termo_aceite').delete().in('projeto_codigo', codigosParaApagar);
        if (errorGoliveTermo) console.error('Erro ao limpar golive_termo_aceite:', errorGoliveTermo.message);

        // NOVOS (a pedido do usuário 25/08/2026 — Fase 3): vínculos de
        // Contrato por Projeto e o log de alterações deles. NOVO (Fase 4):
        // contratos_pagamentos agora referencia vinculo_id sem cascade —
        // precisa apagar os pagamentos do vínculo antes do vínculo em si,
        // senão o delete abaixo falha por violação de chave estrangeira.
        const { data: vinculosParaApagar1 } = await _supabase.from('contratos_vinculos_projeto').select('id').in('projeto_codigo', codigosParaApagar);
        const idsVinculosParaApagar1 = (vinculosParaApagar1 || []).map(v => v.id);
        if (idsVinculosParaApagar1.length > 0) {
            const { error: errorPagamentosVinculo1 } = await _supabase.from('contratos_pagamentos').delete().in('vinculo_id', idsVinculosParaApagar1);
            if (errorPagamentosVinculo1) console.error('Erro ao limpar contratos_pagamentos (por vínculo):', errorPagamentosVinculo1.message);
        }

        const { error: errorVinculosContrato } = await _supabase.from('contratos_vinculos_projeto').delete().in('projeto_codigo', codigosParaApagar);
        if (errorVinculosContrato) console.error('Erro ao limpar contratos_vinculos_projeto:', errorVinculosContrato.message);

        const { error: errorLogVinculos } = await _supabase.from('log_alteracao_vinculo_contrato').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogVinculos) console.error('Erro ao limpar log_alteracao_vinculo_contrato:', errorLogVinculos.message);

        // NOVO (Objetivo/Key Results/Benefit Results): projeto_benefit_results
        // referencia projeto_codigo sem ON DELETE CASCADE — precisa limpar
        // antes de apagar o projeto, senão o delete abaixo falha por
        // violação de chave estrangeira. tipos_return_benefit (a Tabela 1,
        // catálogo) NÃO é tocado aqui, mesmo padrão de tipos_projeto/
        // pilares_estrategicos/iniciativas_estrategicas — catálogos não
        // fazem parte desta limpeza, só dados por projeto.
        const { error: errorBeneficios } = await _supabase.from('projeto_benefit_results').delete().in('projeto_codigo', codigosParaApagar);
        if (errorBeneficios) console.error('Erro ao limpar projeto_benefit_results:', errorBeneficios.message);

        const { error: errorProjetos } = await _supabase.from('projetos').delete().in('codigo', codigosParaApagar);
        if (errorProjetos) {
            alert('❌ Erro ao apagar os projetos: ' + errorProjetos.message);
            return;
        }
    }

    // Apaga a configuração de todo AF diferente do mantido.
    const { error: errorAFs } = await _supabase.from('anos_fiscais_config').delete().neq('ano_fiscal', AF_MANTIDO);
    if (errorAFs) console.error('Erro ao limpar anos_fiscais_config:', errorAFs.message);

    // Garante o AF2027 aberto pra demandas normais.
    const { error: errorReabrir } = await _supabase.from('anos_fiscais_config').upsert({
        ano_fiscal: AF_MANTIDO,
        orcamento_fechado: false,
        recebimento_demandas_aberto: true
    }, { onConflict: 'ano_fiscal' });
    if (errorReabrir) console.error('Erro ao reabrir o AF mantido:', errorReabrir.message);

    // NOVO (a pedido do usuário): zera a numeração de projetos de TODOS
    // os Anos Fiscais — não só reajusta o contador do AF mantido pra
    // bater com o que sobra, apaga TODOS os contadores cadastrados,
    // qualquer que seja o AF. Se ainda restarem projetos no AF mantido
    // com números já usados, o próximo código gerado pode colidir —
    // por isso o aviso de confirmação menciona isso explicitamente.
    const { error: errorContadores } = await _supabase.from('contadores_codigo_projeto').delete().neq('ano_fiscal', '');
    if (errorContadores) console.error('Erro ao zerar os contadores de código:', errorContadores.message);

    // NOVO (a pedido do usuário): limpa inteira a fila de e-mails
    // pendentes de envio — sem filtro de Ano Fiscal, apaga tudo.
    const { error: errorFilaEmail } = await _supabase.from('emails_pendentes').delete().neq('id', 0);
    if (errorFilaEmail) console.error('Erro ao limpar a fila de e-mails:', errorFilaEmail.message);

    alert(`✅ Limpeza concluída — ${codigosParaApagar.length} projeto(s) apagado(s) fisicamente. Restaram ${projetosQueFicam.length} projeto(s) do ${AF_MANTIDO}. Numeração de projetos zerada em todos os Anos Fiscais. Fila de e-mails limpa.${projetosQueFicam.length > 0 ? `\n\n⚠️ Atenção: como ainda restaram projetos no ${AF_MANTIDO}, o próximo código gerado pode colidir com um já existente — confira antes de formalizar novas demandas.` : ''}`);

    await loadProjects();
    await renderListaProjetosDevTools();
}

// NOVO (a pedido do usuário 25/08/2026): limpeza nuclear — apaga TUDO,
// inclusive a configuração de Ano Fiscal (e os totais congelados nela:
// valor_total_fechado/qtd_projetos_fechado), sem reabrir nada no final.
// Diferente de limparBaseSomenteAF2027, que preserva o AF2027 aberto —
// aqui não sobra nenhum Ano Fiscal configurado, é preciso reabrir do zero
// em Fiscal Year → Abertura Fiscal Year depois.
async function limparBaseCompletamente() {
    if (!ehAdministrador) {
        return alert('⛔ Esta ferramenta é restrita a usuários com a função ADMINISTRADOR.');
    }

    const codigosParaApagar = (projectsData || []).map(p => p.codigo);

    const confirmacao = confirm(
        `☠️ LIMPEZA TOTAL — APAGA TUDO\n\n` +
        `Isso vai APAGAR PERMANENTEMENTE TODOS os ${codigosParaApagar.length} projeto(s) cadastrados, de QUALQUER Ano Fiscal.\n\n` +
        `Também vai:\n` +
        `- Apagar TODA a configuração de Ano Fiscal (anos_fiscais_config) — inclusive os totais já fechados (valor e quantidade). Não sobra nenhum AF configurado.\n` +
        `- Zerar a numeração de projetos de TODOS os Anos Fiscais\n` +
        `- Limpar inteira a fila de e-mails pendentes de envio\n\n` +
        `Esta ação NÃO PODE ser desfeita, e é mais destrutiva que "Limpar Base — Manter Só AF2027". Deseja continuar?`
    );
    if (!confirmacao) return;

    if (codigosParaApagar.length > 0) {
        const { error: errorEtapas } = await _supabase.from('projeto_etapas').delete().in('projeto_codigo', codigosParaApagar);
        if (errorEtapas) console.error('Erro ao limpar projeto_etapas:', errorEtapas.message);

        const { error: errorAdhoc } = await _supabase.from('adhoc_aprovacoes').delete().in('projeto_adhoc_codigo', codigosParaApagar);
        if (errorAdhoc) console.error('Erro ao limpar adhoc_aprovacoes:', errorAdhoc.message);

        const { error: errorLogHoras } = await _supabase.from('log_alteracoes_horas').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogHoras) console.error('Erro ao limpar log_alteracoes_horas:', errorLogHoras.message);

        const { error: errorLogHold } = await _supabase.from('log_retomada_hold').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogHold) console.error('Erro ao limpar log_retomada_hold:', errorLogHold.message);

        // NOVO (a pedido do usuário 25/08/2026): log de Ratificação/
        // Retificação do planejamento de UAT/Go-Live — mesma exigência de
        // limpar antes de apagar o projeto.
        const { error: errorLogRatif } = await _supabase.from('log_ratificacao_planejamento').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogRatif) console.error('Erro ao limpar log_ratificacao_planejamento:', errorLogRatif.message);

        // NOVOS (a pedido do usuário 25/08/2026): Ocorrências de Erro e
        // Termo de Aceite do Go-Live — mesma exigência de limpar antes de
        // apagar o projeto.
        const { error: errorGoliveOcorrencias } = await _supabase.from('golive_ocorrencias').delete().in('projeto_codigo', codigosParaApagar);
        if (errorGoliveOcorrencias) console.error('Erro ao limpar golive_ocorrencias:', errorGoliveOcorrencias.message);

        const { error: errorGoliveTermo } = await _supabase.from('golive_termo_aceite').delete().in('projeto_codigo', codigosParaApagar);
        if (errorGoliveTermo) console.error('Erro ao limpar golive_termo_aceite:', errorGoliveTermo.message);

        // NOVOS (a pedido do usuário 25/08/2026 — Fase 3): vínculos de
        // Contrato por Projeto e o log de alterações deles. NOVO (Fase 4):
        // apaga os pagamentos do vínculo antes do vínculo em si.
        const { data: vinculosParaApagar2 } = await _supabase.from('contratos_vinculos_projeto').select('id').in('projeto_codigo', codigosParaApagar);
        const idsVinculosParaApagar2 = (vinculosParaApagar2 || []).map(v => v.id);
        if (idsVinculosParaApagar2.length > 0) {
            const { error: errorPagamentosVinculo2 } = await _supabase.from('contratos_pagamentos').delete().in('vinculo_id', idsVinculosParaApagar2);
            if (errorPagamentosVinculo2) console.error('Erro ao limpar contratos_pagamentos (por vínculo):', errorPagamentosVinculo2.message);
        }

        const { error: errorVinculosContrato } = await _supabase.from('contratos_vinculos_projeto').delete().in('projeto_codigo', codigosParaApagar);
        if (errorVinculosContrato) console.error('Erro ao limpar contratos_vinculos_projeto:', errorVinculosContrato.message);

        const { error: errorLogVinculos } = await _supabase.from('log_alteracao_vinculo_contrato').delete().in('projeto_codigo', codigosParaApagar);
        if (errorLogVinculos) console.error('Erro ao limpar log_alteracao_vinculo_contrato:', errorLogVinculos.message);

        const { error: errorBeneficios } = await _supabase.from('projeto_benefit_results').delete().in('projeto_codigo', codigosParaApagar);
        if (errorBeneficios) console.error('Erro ao limpar projeto_benefit_results:', errorBeneficios.message);

        const { error: errorProjetos } = await _supabase.from('projetos').delete().in('codigo', codigosParaApagar);
        if (errorProjetos) {
            alert('❌ Erro ao apagar os projetos: ' + errorProjetos.message);
            return;
        }
    }

    // Diferente de limparBaseSomenteAF2027: apaga TODAS as linhas de
    // configuração, não reabre nenhum AF — é isso que "zera os totais"
    // (valor_total_fechado/qtd_projetos_fechado somem junto com a linha).
    const { error: errorAFs } = await _supabase.from('anos_fiscais_config').delete().neq('ano_fiscal', '');
    if (errorAFs) console.error('Erro ao limpar anos_fiscais_config:', errorAFs.message);

    const { error: errorContadores } = await _supabase.from('contadores_codigo_projeto').delete().neq('ano_fiscal', '');
    if (errorContadores) console.error('Erro ao zerar os contadores de código:', errorContadores.message);

    const { error: errorFilaEmail } = await _supabase.from('emails_pendentes').delete().neq('id', 0);
    if (errorFilaEmail) console.error('Erro ao limpar a fila de e-mails:', errorFilaEmail.message);

    alert(`✅ Limpeza total concluída — ${codigosParaApagar.length} projeto(s) apagado(s) fisicamente. Nenhum Ano Fiscal restou configurado. Numeração de projetos zerada. Fila de e-mails limpa.\n\n⚠️ Vá em Fiscal Year → Abertura Fiscal Year pra reabrir um Ano Fiscal antes de formalizar novas demandas.`);

    await loadProjects();
    await renderListaProjetosDevTools();
}

// -------------------------------------------------------------------------
// Lista pós-limpeza — sempre reflete o que está no banco agora, com
// exclusão física seletiva de qualquer projeto, um a um ou em lote.
// -------------------------------------------------------------------------
async function renderListaProjetosDevTools() {
    const tbody = document.getElementById('devToolsProjetosTableBody');
    if (!tbody) return;

    devToolsProjetosSelecionados.clear();

    const lista = [...(projectsData || [])].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const marcacoes = [];
        if (p.is_adhoc) marcacoes.push('<span class="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">Extraordinário</span>');
        if (p.is_carryover) marcacoes.push('<span class="bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">Carryover</span>');
        if (p.is_subprojeto) marcacoes.push('<span class="bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">Subprojeto</span>');

        return `
            <tr>
                <td class="p-3"><input type="checkbox" onchange="toggleSelecaoProjetoDevTools('${escapeJsAttr(p.codigo)}', this.checked)"></td>
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 font-mono">${p.ano_fiscal || '-'}</td>
                <td class="p-3">${p.etapa_atual || '-'}</td>
                <td class="p-3 space-x-1">${marcacoes.join(' ') || '-'}</td>
            </tr>
        `;
    }).join('');
}

function toggleSelecaoProjetoDevTools(codigo, marcado) {
    if (marcado) devToolsProjetosSelecionados.add(codigo);
    else devToolsProjetosSelecionados.delete(codigo);
}

async function excluirFisicamenteSelecionados() {
    if (!ehAdministrador) {
        return alert('⛔ Esta ferramenta é restrita a usuários com a função ADMINISTRADOR.');
    }
    if (devToolsProjetosSelecionados.size === 0) {
        return alert('Selecione pelo menos um projeto pra excluir!');
    }

    const codigos = [...devToolsProjetosSelecionados];
    if (!confirm(`⚠️ Isso vai apagar PERMANENTEMENTE ${codigos.length} projeto(s) selecionado(s):\n\n${codigos.join(', ')}\n\nEsta ação não pode ser desfeita. Confirma?`)) return;

    const { error: errorEtapas } = await _supabase.from('projeto_etapas').delete().in('projeto_codigo', codigos);
    if (errorEtapas) console.error('Erro ao limpar projeto_etapas:', errorEtapas.message);

    const { error: errorAdhoc } = await _supabase.from('adhoc_aprovacoes').delete().in('projeto_adhoc_codigo', codigos);
    if (errorAdhoc) console.error('Erro ao limpar adhoc_aprovacoes:', errorAdhoc.message);

    // NOVOS (a pedido do usuário 24/08/2026): ver mesmo comentário em
    // limparBaseSomenteAF2027.
    const { error: errorLogHoras } = await _supabase.from('log_alteracoes_horas').delete().in('projeto_codigo', codigos);
    if (errorLogHoras) console.error('Erro ao limpar log_alteracoes_horas:', errorLogHoras.message);

    const { error: errorLogHold } = await _supabase.from('log_retomada_hold').delete().in('projeto_codigo', codigos);
    if (errorLogHold) console.error('Erro ao limpar log_retomada_hold:', errorLogHold.message);

    const { error: errorLogRatif } = await _supabase.from('log_ratificacao_planejamento').delete().in('projeto_codigo', codigos);
    if (errorLogRatif) console.error('Erro ao limpar log_ratificacao_planejamento:', errorLogRatif.message);

    const { error: errorGoliveOcorrencias } = await _supabase.from('golive_ocorrencias').delete().in('projeto_codigo', codigos);
    if (errorGoliveOcorrencias) console.error('Erro ao limpar golive_ocorrencias:', errorGoliveOcorrencias.message);

    const { error: errorGoliveTermo } = await _supabase.from('golive_termo_aceite').delete().in('projeto_codigo', codigos);
    if (errorGoliveTermo) console.error('Erro ao limpar golive_termo_aceite:', errorGoliveTermo.message);

    const { data: vinculosParaApagar3 } = await _supabase.from('contratos_vinculos_projeto').select('id').in('projeto_codigo', codigos);
    const idsVinculosParaApagar3 = (vinculosParaApagar3 || []).map(v => v.id);
    if (idsVinculosParaApagar3.length > 0) {
        const { error: errorPagamentosVinculo3 } = await _supabase.from('contratos_pagamentos').delete().in('vinculo_id', idsVinculosParaApagar3);
        if (errorPagamentosVinculo3) console.error('Erro ao limpar contratos_pagamentos (por vínculo):', errorPagamentosVinculo3.message);
    }

    const { error: errorVinculosContrato } = await _supabase.from('contratos_vinculos_projeto').delete().in('projeto_codigo', codigos);
    if (errorVinculosContrato) console.error('Erro ao limpar contratos_vinculos_projeto:', errorVinculosContrato.message);

    const { error: errorLogVinculos } = await _supabase.from('log_alteracao_vinculo_contrato').delete().in('projeto_codigo', codigos);
    if (errorLogVinculos) console.error('Erro ao limpar log_alteracao_vinculo_contrato:', errorLogVinculos.message);

    // NOVO (Objetivo/Key Results/Benefit Results): mesma exigência de
    // limpar antes de apagar o projeto — ver comentário equivalente em
    // limparBaseSomenteAF2027.
    const { error: errorBeneficios } = await _supabase.from('projeto_benefit_results').delete().in('projeto_codigo', codigos);
    if (errorBeneficios) console.error('Erro ao limpar projeto_benefit_results:', errorBeneficios.message);

    const { error } = await _supabase.from('projetos').delete().in('codigo', codigos);
    if (error) {
        alert('❌ Erro ao excluir: ' + error.message);
        return;
    }

    alert(`✅ ${codigos.length} projeto(s) excluído(s) permanentemente.`);
    await loadProjects();
    await renderListaProjetosDevTools();
}
