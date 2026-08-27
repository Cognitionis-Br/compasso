// =========================================================================
// requirements/requirements.js
// Fase de Requerimentos: Gerar Requerimentos, Avaliação de Negócio,
// Avaliação TI, e Conclusão — todas usando o motor de workflow genérico
// "consciente de fase" (Especificacao_Workflow_v4.md, seção 13 — G5).
//
// AJUSTADO (a pedido do usuário): sequência dentro da fase invertida —
// era Gerar Requerimentos -> Avaliação TI -> Avaliação Negócio -> Fechar;
// agora é Gerar Requerimentos -> Avaliação Negócio -> Avaliação TI ->
// Fechar. Mudança só de dados (campo `ordem` de APROVAR REQUERIMENTOS
// TI/NEGÓCIO em fases_etapas, com proxima_etapa_id realinhado) — nenhuma
// destas funções mudou, já que obterEtapaAtualNaFase (generic-workflow-ui.js)
// decide a etapa corrente puramente pela ordem cadastrada em fases_etapas,
// não por nada hardcoded aqui. O disparo de e-mail (email_fluxo) também
// não precisou mudar — é acionado por (fase, etapa, quando_dispara), não
// por sequência.
//
// MIGRADO 10/08/2026: "Gerar Requerimentos" usava um modal próprio
// (abrirModalPlanReq/confirmarSalvarPlanReq) e um passo manual "Enviar
// para Avaliação Técnica" (enviarParaAvaliacaoTecnica). Ambos foram
// removidos — agora usa os mesmos modais genéricos de
// Planejamento/Evolução que Avaliação TI/Negócio já usavam, e a
// progressão para a próxima etapa é automática (concluir em 100% já
// libera a etapa seguinte, sem precisar de um botão manual de "enviar").
//
// Atenção: projetos que já estivessem no meio do fluxo ANTIGO (sub_status
// = 'PLANEJADO' aguardando envio manual) não migram automaticamente —
// como a carga de testes atual não tinha nenhum projeto nesse estado
// intermediário, não foi necessário migrar dados, mas vale conferir se
// isso se aplica ao seu ambiente antes de aplicar este checkpoint.
// =========================================================================

// NOVO (Fase 3, item 2): alterna entre as 3 abas de Gerar Requeriments
// (A Planejar / Em Andamento / Concluídas) — mesmo padrão V2 de
// Orçamentar Demanda.
function mudarAbaGerarRequerimentos(aba) {
    ['a_planejar', 'em_andamento', 'concluidas'].forEach(a => {
        const btn = document.getElementById(`reqGerarBtn-${a}`);
        const painel = document.getElementById(`reqGerarPainel-${a}`);
        if (btn) btn.className = `req-gerar-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('req_planejamento', 'reqGerarBtn');
}

// "Concluídas" pra Gerar Requeriments precisa de consulta própria — a
// etapa some das listas A Planejar/Em Andamento assim que 100% é
// atingido (o motor genérico já move o projeto pra próxima etapa da
// fase), então busca direto em projeto_etapas quem já concluiu essa
// etapa especificamente, independente de onde o projeto esteja agora.
async function renderReqGerarConcluidasView() {
    const etapaGerar = obterEtapaPorNome('GERAR REQUERIMENTOS');
    const tbody = document.getElementById('reqGerarConcluidoTableBody');
    if (!tbody || !etapaGerar) return;

    const { data, error } = await _supabase.from('projeto_etapas').select('*').eq('etapa_id', etapaGerar.id).eq('situacao', 'EXECUCAO_CONCLUIDO');
    const concluidas = error ? [] : (data || []);

    if (concluidas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhuma etapa concluída ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = concluidas.map(pe => {
        const p = projectsData.find(x => x.codigo === pe.projeto_codigo);
        if (!p) return '';
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs uppercase">${escapeHtml(pe.responsavel_etapa_nome) || '-'}</td>
                <td class="p-3 text-xs">${pe.concluido_em ? pe.concluido_em.split('T')[0] : '-'}</td>
                <td class="p-3 text-xs font-bold">${p.etapa_atual || '-'}</td>
            </tr>
        `;
    }).join('');
}

async function renderReqPlanejamentoView() {
    await renderFaseGenericaViewPorFase(
        'REQUIREMENTS', 'REQUERIMENTS', 'GERAR REQUERIMENTOS',
        'reqAPlanejarTableBody', 'reqPlanejadosTableBody', renderReqPlanejamentoView,
        'req_planejamento:a_planejar', 'req_planejamento:em_andamento'
    );
    await renderReqGerarConcluidasView();
}

// =========================================================================
// AVALIAÇÃO TI / AVALIAÇÃO DE NEGÓCIO — MIGRADAS 10/08/2026 pro motor de
// workflow genérico "consciente de fase" (Especificacao_Workflow_v4.md,
// seção 13, opção a): agora usam planejamento com data/responsável e %
// de evolução, com decisão Aprovado/Reprovado na conclusão
// (requer_decisao_aprovacao = true nessas duas etapas — configurar isso
// em Administração → Fases e Etapas do Workflow se ainda não estiver).
//
// Substituiu o padrão simplificado anterior (iniciar -> aprovar/reprovar
// sem data própria) — o usuário identificou que isso era um gap perigoso
// de controle (avaliações sem acompanhamento de prazo/andamento).
// =========================================================================

// NOVO (padrão V2, "Avaliar Requerimentos por TI/Negócio"): alterna
// entre as 2 abas — A Planejar / Execução.
function mudarAbaAvaliarTI(aba) {
    ['a_planejar', 'execucao'].forEach(a => {
        const btn = document.getElementById(`avalTIBtn-${a}`);
        const painel = document.getElementById(`avalTIPainel-${a}`);
        if (btn) btn.className = `aval-ti-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('req_aprov_ti', 'avalTIBtn');
}

function mudarAbaAvaliarNegocio(aba) {
    ['a_planejar', 'execucao'].forEach(a => {
        const btn = document.getElementById(`avalNegBtn-${a}`);
        const painel = document.getElementById(`avalNegPainel-${a}`);
        if (btn) btn.className = `aval-neg-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('req_aprov_negocio', 'avalNegBtn');
}

async function renderReqAprovTIView() {
    await renderFaseGenericaViewPorFase(
        'REQUIREMENTS', 'REQUERIMENTS', 'APROVAR REQUERIMENTOS TI',
        'reqAprovTIAPlanejarTableBody', 'reqAprovTIExecucaoTableBody', renderReqAprovTIView,
        'req_aprov_ti:a_planejar', 'req_aprov_ti:execucao'
    );
}

async function renderReqAprovNegocioView() {
    await renderFaseGenericaViewPorFase(
        'REQUIREMENTS', 'REQUERIMENTS', 'APROVAR REQUERIMENTOS NEGÓCIO',
        'reqAprovNegAPlanejarTableBody', 'reqAprovNegExecucaoTableBody', renderReqAprovNegocioView,
        'req_aprov_negocio:a_planejar', 'req_aprov_negocio:execucao'
    );
}

// -------------------------------------------------------------------------
// Conclusão de Requerimentos — regra especial (Especificacao_Workflow_v2.md,
// seção 7): mostra valor inicialmente orçado, pede revisão do valor e
// ratificação/retificação do porte, loga quem concluiu e quando.
// -------------------------------------------------------------------------
// NOVO (item 3, novos ajustes): lista simples (código/nome/área) —
// clicar em Concluir abre o modal de comparação Business Case × Pós-Fase.
// Config genérica, reaproveitada em Concluir Etapa de Technical (item 6).
const CONFIG_CONCLUSAO_REQUERIMENTOS = {
    titulo: 'Concluir Etapa de Requerimentos',
    labelApos: 'Após Requerimentos',
    labelReferencia: 'Business Case',
    campoValorReferencia: 'val_bc',
    campoValorPos: 'val_req',
    // NOVO (a pedido do usuário 24/08/2026): porte deixou de ser
    // referência/escolha aqui — agora é horas, calculando o porte por
    // tabela (obterPortePorHoras). Mesmo padrão de nomes que já existia
    // pra valor (campoValorReferencia/campoValorPos), espelhado pra horas.
    campoHorasReferencia: 'horas_bc',
    campoHorasPos: 'horas_req',
    campoAlertaVariacaoHoras: 'req_alerta_variacao_horas',
    campoVariacaoPercentualHoras: 'req_variacao_percentual_horas',
    // NOVO (Mudança de Orçamento, 27/08/2026): campos de
    // config_bloqueio_orcamento usados por confirmarConclusaoFaseGenerica
    // pra decidir se BLOQUEIA o avanço (diferente do alerta amarelo/
    // vermelho acima, que é só informativo).
    campoPercentualBloqueioHoras: 'req_percentual_horas',
    campoPercentualBloqueioValor: 'req_percentual_valor',
    etapaNomeRBAC: 'FECHAR REQUERIMENTOS',
    faseFluxoEmail: 'REQUERIMENTS',
    quandoDisparaConcluir: 'Após fechar requerimentos',
    proximaFase: 'TECHNICAL',
    proximoSubStatus: 'A PLANEJAR',
    campoConcluidoPor: 'req_concluido_por',
    campoConcluidoEm: 'req_concluido_em',
    campoAlertaVariacao: 'req_alerta_variacao',
    campoVariacaoPercentual: 'req_variacao_percentual',
    campoObservacao: 'req_observacao_conclusao',
    callbackAtualizar: () => renderReqConclusaoView()
};

function renderReqConclusaoView() {
    const tbody = document.getElementById('reqConclusaoTableBody');
    if (!tbody) return;

    // CORRIGIDO 10/08/2026: antes filtrava por um sub_status setado pelo
    // fluxo simplificado antigo (aprovarEtapaSimples, removido). Agora
    // usa a cadeia de projeto_etapas: só entra aqui quem já concluiu (e
    // teve aprovado) Gerar Requerimentos + Avaliação TI + Avaliação
    // Negócio — ou seja, a fase inteira está pronta pra fechar, exceto
    // pela própria etapa de Fechar Requerimentos (que é esta tela).
    const etapasDaFase = obterEtapasDaFase('REQUERIMENTS').filter(e => e.etapa !== 'FECHAR REQUERIMENTOS');
    const candidatos = projectsData.filter(p => {
        const etapa = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        // NOVO (Mudança de Orçamento, 27/08/2026): some daqui assim que
        // bloqueado — passa a aparecer só em Governança > Mudança de
        // Orçamento até ser aprovado.
        return etapa === 'REQUIREMENTS' && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD' && p.bloqueado_mudanca_orcamento !== true;
    });
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const pendentes = filtrarProjetosPorArea(candidatos.filter(p => obterEtapaAtualNaFase(p.codigo, etapasDaFase) === null)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR')), 'req_conclusao');

    if (pendentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum requerimento aguardando revisão de conclusão</td></tr>`;
        return;
    }

    tbody.innerHTML = pendentes.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-purple-700">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 text-xs">${p.area || '-'}</td>
            <td class="p-3 text-center">
                ${botaoSeTemAtividade('req_conclusao', `
                    <button onclick="abrirModalConcluirFase('${p.codigo}', CONFIG_CONCLUSAO_REQUERIMENTOS)" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                        <i class="fa-solid fa-check"></i> Concluir
                    </button>
                `) || '<span class="text-gray-400 italic text-[10px]">Sem permissão</span>'}
            </td>
        </tr>
    `).join('');
}

// -------------------------------------------------------------------------
// Modal genérico de Conclusão de Fase — abre com os campos: Código/Nome,
// Área/Solicitante, Porte e Orçamento do Business Case (só leitura), e
// Porte/Orçamento "após [fase]" (editáveis) + observação opcional.
// -------------------------------------------------------------------------
let conclFaseConfigAtual = null;

function abrirModalConcluirFase(codigo, config) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;
    conclFaseConfigAtual = config;

    document.getElementById('conclFaseCodigoHidden').value = codigo;
    document.getElementById('conclFaseTitulo').innerText = config.titulo;
    document.getElementById('conclFaseCodigo').innerText = p.codigo;
    document.getElementById('conclFaseNome').innerText = p.nome;
    document.getElementById('conclFaseArea').innerText = p.area || '-';
    document.getElementById('conclFaseSolicitante').innerText = p.pessoa_solicitante || '-';

    // NOVO (item 6, novos ajustes): referência configurável — em
    // Requerimentos compara contra o Business Case; em Technical
    // compara contra o valor pós-Requerimentos (ou BC, se não existir).
    // AJUSTADO (a pedido do usuário 24/08/2026): porte saiu daqui — a
    // referência agora é horas (compara/recalcula o porte por tabela).
    const horasReferencia = Number(p[config.campoHorasReferencia]) || 0;
    const valorReferencia = Number(p[config.campoValorReferencia]) || Number(p.val_bc) || 0;
    document.getElementById('conclFaseLabelHorasBC').innerText = `Horas Projeto (${config.labelReferencia})`;
    document.getElementById('conclFaseLabelValorBC').innerText = `Orçamento Projeto (${config.labelReferencia})`;
    document.getElementById('conclFaseHorasBC').innerText = horasReferencia > 0 ? `${horasReferencia}h` : '-';
    document.getElementById('conclFaseValorBC').innerText = `R$ ${valorReferencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    document.getElementById('conclFaseLabelHorasApos').innerText = `Horas Projeto ${config.labelApos}`;
    document.getElementById('conclFaseLabelValorApos').innerText = `Orçamento Projeto ${config.labelApos}`;

    document.getElementById('conclFaseHorasApos').value = horasReferencia || '';
    document.getElementById('conclFaseValorApos').value = valorReferencia;
    document.getElementById('conclFaseObservacaoInput').value = '';
    document.getElementById('conclFaseAlerta').innerHTML = '';
    document.getElementById('conclFasePorteCalculadoAviso').innerText = '';

    document.getElementById('modalConcluirFase').classList.remove('hidden');
}

// NOVO (a pedido do usuário 24/08/2026): mesmo feedback ao vivo do
// checkpoint de Realizar Orçamento — mostra o porte calculado assim que
// o usuário digita as horas.
function onChangeHorasConclFase() {
    const horas = parseFloat(document.getElementById('conclFaseHorasApos').value);
    const aviso = document.getElementById('conclFasePorteCalculadoAviso');
    if (!aviso) return;
    if (isNaN(horas)) { aviso.innerText = ''; return; }
    const porte = obterPortePorHoras(horas);
    aviso.innerText = porte ? `Porte calculado: ${porte.codigo} - ${porte.descricao}` : '⚠️ Nenhum porte cadastrado cobre essa quantidade de horas.';
}

function fecharModalConcluirFase() {
    document.getElementById('modalConcluirFase').classList.add('hidden');
    conclFaseConfigAtual = null;
}

async function confirmarConclusaoFaseGenerica() {
    if (!conclFaseConfigAtual) return;
    const config = conclFaseConfigAtual;
    const codigo = document.getElementById('conclFaseCodigoHidden').value;

    const horasApos = parseFloat(document.getElementById('conclFaseHorasApos').value);
    const valorApos = parseFloat(document.getElementById('conclFaseValorApos').value);
    const observacao = document.getElementById('conclFaseObservacaoInput').value.trim();

    if (isNaN(horasApos) || horasApos <= 0 || isNaN(valorApos) || valorApos <= 0) {
        return alert('Informe a quantidade de horas e um valor de orçamento válido!');
    }

    const p = projectsData.find(x => x.codigo === codigo);

    // AJUSTADO (a pedido do usuário 24/08/2026): porte deixou de ter
    // qualquer vínculo com o valor de orçamento — passa a ser calculado
    // só a partir das horas informadas (obterPortePorHoras).
    const porteCalculado = obterPortePorHoras(horasApos);
    if (!porteCalculado) {
        return alert(`⛔ Nenhum porte cadastrado cobre ${horasApos}h. Ajuste a quantidade de horas ou cadastre/ajuste as faixas em Administração → Cadastro de Porte.`);
    }
    const tamanho = porteCalculado.codigo;

    const valorReferenciaAlerta = p ? (Number(p[config.campoValorReferencia]) || Number(p.val_bc) || 0) : 0;
    const alerta = calcularAlertaVariacaoOrcamento(valorReferenciaAlerta, valorApos);
    const avisoAlerta = alerta.nivel !== 'ok'
        ? `\n\n${alerta.nivel === 'vermelho' ? '🔴' : '🟡'} ATENÇÃO: variação de ${alerta.percentual}% no ORÇAMENTO em relação ao do ${config.labelReferencia}!`
        : '';

    // NOVO (a pedido do usuário 24/08/2026): mesma regra de alerta de
    // variação, agora também sobre horas — usa a mesma função genérica
    // (calcularAlertaVariacaoOrcamento não é específica de dinheiro, só
    // compara dois números).
    const horasReferenciaAlerta = p ? (Number(p[config.campoHorasReferencia]) || 0) : 0;
    const alertaHoras = calcularAlertaVariacaoOrcamento(horasReferenciaAlerta, horasApos);
    const avisoAlertaHoras = alertaHoras.nivel !== 'ok'
        ? `\n\n${alertaHoras.nivel === 'vermelho' ? '🔴' : '🟡'} ATENÇÃO: variação de ${alertaHoras.percentual}% em HORAS em relação ao ${config.labelReferencia}!`
        : '';

    // NOVO (Mudança de Orçamento, 27/08/2026): checa se a variação estoura
    // o percentual de BLOQUEIO parametrizado (Administração > Percentual
    // de Bloqueio de Orçamento) — diferente do alerta amarelo/vermelho
    // acima, que é só informativo e nunca impediu o avanço. Lê ao vivo
    // (não usa cache) — mesmo padrão já usado pra chave geral de e-mail —
    // pra não bloquear/liberar com um valor desatualizado numa sessão
    // aberta há muito tempo. Campos NULL (não configurados) nunca bloqueiam.
    const { data: configBloqueio } = await _supabase.from('config_bloqueio_orcamento').select('*').eq('id', 1).maybeSingle();
    const limiteValor = configBloqueio && configBloqueio[config.campoPercentualBloqueioValor] != null ? Number(configBloqueio[config.campoPercentualBloqueioValor]) : null;
    const limiteHoras = configBloqueio && configBloqueio[config.campoPercentualBloqueioHoras] != null ? Number(configBloqueio[config.campoPercentualBloqueioHoras]) : null;
    const estourouValor = limiteValor !== null && alerta.percentual > limiteValor;
    const estourouHoras = limiteHoras !== null && alertaHoras.percentual > limiteHoras;
    const vaiBloquear = estourouValor || estourouHoras;

    const avisoBloqueio = vaiBloquear
        ? `\n\n⛔ A variação ultrapassa o percentual de bloqueio parametrizado — o projeto ficará BLOQUEADO, aguardando aprovação em Governança → Mudança de Orçamento, em vez de seguir direto para ${config.proximaFase}.`
        : `\n\nO projeto migrará para a fase ${config.proximaFase}.`;

    if (!confirm(`Confirma a conclusão de ${config.titulo} para ${codigo}?\n\nHoras: ${horasApos}h (Porte calculado: ${tamanho})\nOrçamento revisado: R$ ${valorApos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${avisoAlerta}${avisoAlertaHoras}${avisoBloqueio}`)) {
        return;
    }

    const payload = {
        tamanho,
        [config.campoValorPos]: valorApos,
        [config.campoHorasPos]: horasApos,
        // NOVO (Mudança de Orçamento): se bloqueou, a fase/status NÃO
        // avançam — o projeto fica parado na fase atual até ser aprovado
        // em Governança > Mudança de Orçamento (aprovarMudancaOrcamento,
        // js/governanca/mudanca-orcamento.js), que aí sim escreve a
        // próxima fase.
        etapa_atual: vaiBloquear ? p.etapa_atual : config.proximaFase,
        sub_status: vaiBloquear ? p.sub_status : config.proximoSubStatus,
        bloqueado_mudanca_orcamento: vaiBloquear,
        [config.campoConcluidoPor]: currentUser ? currentUser.nome : 'desconhecido',
        [config.campoConcluidoEm]: new Date().toISOString(),
        [config.campoAlertaVariacao]: alerta.nivel,
        [config.campoVariacaoPercentual]: alerta.percentual,
        [config.campoAlertaVariacaoHoras]: alertaHoras.nivel,
        [config.campoVariacaoPercentualHoras]: alertaHoras.percentual,
        [config.campoObservacao]: observacao || null,
        // NOVO (item 10, novos ajustes): limpa a marcação "atual" de
        // revisão/reprovação ao migrar de fase — o histórico de verdade
        // fica preservado em log_decisoes_etapa, que nunca é apagado.
        // Sem isso, um projeto reprovado em Requerimentos continuava
        // aparecendo marcado como "em revisão" mesmo já em Technical.
        ultima_reprovacao_por: null,
        ultima_reprovacao_em: null,
        ultima_reprovacao_etapa: null,
        qtd_reprovacoes: 0
    };

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao migrar de fase: ' + error.message);

    // NOVO (a pedido do usuário 24/08/2026): registra a alteração de
    // horas num log dedicado (log_alteracoes_horas), lido na tela de
    // Detalhe do Projeto — só aqui (checkpoints 2/3), porque só aqui
    // existe um valor "anterior" real pra comparar (checkpoint 1 é a
    // primeira definição, não uma alteração).
    const { error: errorLogHoras } = await _supabase.from('log_alteracoes_horas').insert([{
        projeto_codigo: codigo,
        fase: config.labelApos,
        horas_anterior: horasReferenciaAlerta || null,
        horas_novo: horasApos,
        alterado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (errorLogHoras) console.error('Erro ao registrar log de alteração de horas:', errorLogHoras.message);

    // NOVO (item 1, novos ajustes): disparo de e-mail — pontos 11/15
    // (Fechar Requerimentos / Fechar Especificação), reaproveitado nos
    // dois usos desta mesma função genérica.
    // NOVO (Mudança de Orçamento): não dispara enquanto bloqueado — o
    // projeto ainda não avançou de fase de verdade, então o e-mail de
    // "concluído" seria enganoso; dispara normalmente quando aprovado
    // em Governança > Mudança de Orçamento (fora do escopo deste e-mail).
    if (!vaiBloquear && config.faseFluxoEmail && config.quandoDisparaConcluir) {
        const projConcluido = Object.assign({}, p, payload);
        await dispararEmailFluxo(config.faseFluxoEmail, config.etapaNomeRBAC, config.quandoDisparaConcluir, projConcluido, {});
    }

    alert(vaiBloquear
        ? `⛔ Projeto ${codigo} bloqueado — a variação de orçamento ultrapassou o percentual parametrizado. Ele aguarda aprovação em Governança → Mudança de Orçamento.`
        : `✅ Projeto migrado para ${config.proximaFase} com sucesso!`);
    fecharModalConcluirFase();
    await loadProjects();
    config.callbackAtualizar();
}
