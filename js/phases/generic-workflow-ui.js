// =========================================================================
// phases/generic-workflow-ui.js
// Núcleo genérico de Planejamento e Evolução/Conclusão de etapa —
// Especificacao_Workflow_v2.md, seções 6 e 7. Reutilizável por qualquer
// fase/etapa: só muda qual etapa do workflow (fases_etapas) e qual
// etapa_atual de projeto (projetos.etapa_atual) a tela está olhando.
//
// Regras implementadas (seção 6):
// - Data de início do planejamento deve ser >= hoje. Se for anterior,
//   pede confirmação explícita e grava log (quem aprovou, quando).
// - Data de término deve ser > data de início.
// - Responsável selecionado de lista pré-cadastrada (responsaveisData,
//   filtrado por quem tem permissão para a etapa via
//   obterResponsaveisPorAtividade — já existia em config/responsaveis.js).
//
// Regras implementadas (seção 7):
// - Percentual de evolução 0–100.
// - Ao atingir 100%, pede confirmação de conclusão + observações
//   obrigatórias, e loga quem concluiu e quando.
//
// NÃO implementado ainda nesta etapa: a regra especial de Requerimentos/
// Technical (exibir orçamento inicial e pedir ratificação/retificação de
// valor e porte na conclusão) — fica para quando essas telas específicas
// migrarem para o motor genérico.
// =========================================================================

// AJUSTADO (a pedido do usuário 24/08/2026): porte deixou de ser
// escolhido manualmente — agora é calculado a partir da quantidade de
// horas do projeto (obterPortePorHoras, js/core/workflow-engine.js).
// Mostra o resultado ao vivo assim que o usuário digita as horas,
// mesma ideia de feedback imediato que existia antes (só invertendo
// qual campo dirige qual).
function onChangeHorasProjetoGenerico() {
    const horas = parseFloat(document.getElementById('evolGenHorasProjetoInput').value);
    const aviso = document.getElementById('evolGenPorteCalculadoAviso');
    if (!aviso) return;
    if (isNaN(horas)) { aviso.innerText = ''; return; }
    const porte = obterPortePorHoras(horas);
    aviso.innerText = porte ? `Porte calculado: ${porte.codigo} - ${porte.descricao}` : '⚠️ Nenhum porte cadastrado cobre essa quantidade de horas.';
}

let callbackAtualizarViewGenerica = null;
let etapaModalRequerDecisao = false; // guarda se a etapa aberta no modal de evolução exige decisão Aprovado/Reprovado
const ETAPA_REGISTRO_CONTRATOS = 'EXECUTAR (EXECUTION)'; // G17: Registro de Contratos, escopo confirmado só Execution

// NOVO (a pedido do usuário 25/08/2026): UAT e Go-Live não recebem mais
// planejamento próprio — o planejamento das 3 etapas (Execution/UAT/
// Go-Live) já é feito de uma vez em "Planejar Execução"
// (js/subprojetos/subprojetos.js, confirmarPlanejamentoExecucaoCompleto).
// Quando o projeto chega em UAT/Go-Live, o plano já existe — a ação
// esperada é RATIFICAR (confirmar como está) ou RETIFICAR (editar) esse
// plano herdado, não planejar do zero. Ver abrirModalPlanejamentoGenerico/
// confirmarPlanejamentoGenerico mais abaixo.
const ETAPAS_RATIFICACAO = ['EXECUTAR (UAT)', 'EXECUTAR (GO-LIVE)'];
let etapaModalExigeValorGasto = false; // G17: guarda se a conclusão desta etapa exige valor gasto (contrato interno+terceiros)
let etapaModalRequerDefinicaoOrcamento = false; // G5: guarda se a conclusão desta etapa exige definir orçamento (Realizar Orçamento)

// NOVO (a pedido do usuário): nenhum prazo de planejamento (início ou
// término) pode ultrapassar o Ano Fiscal do projeto — exceto quando o
// projeto é Carryover. Necessário pra não gerar datas fora do que o
// Roadmap mostra (ele só exibe o AF em curso).
function obterLimitesAnoFiscal(anoFiscalStr) {
    const anoNum = parseInt((anoFiscalStr || '').replace('AF', ''), 10);
    if (!anoNum) return null;
    return { inicio: `${anoNum - 1}-04-01`, fim: `${anoNum}-03-31` };
}

function validarDataDentroDoAF(dataStr, projeto) {
    if (!dataStr || !projeto) return true;
    if (projeto.is_carryover === true) return true; // exceção explícita
    const limites = obterLimitesAnoFiscal(projeto.ano_fiscal);
    if (!limites) return true; // sem AF definido, não bloqueia
    return dataStr >= limites.inicio && dataStr <= limites.fim;
}

function mensagemDataForaDoAF(nomeCampo, projeto) {
    const limites = obterLimitesAnoFiscal(projeto.ano_fiscal);
    return `⛔ ${nomeCampo} precisa estar dentro do Ano Fiscal ${projeto.ano_fiscal} (${limites.inicio.split('-').reverse().join('/')} a ${limites.fim.split('-').reverse().join('/')}). ` +
           `Só projetos marcados como Carryover podem ter datas fora do AF de origem.`;
}
const ETAPA_GERAR_REQUERIMENTOS = 'GERAR REQUERIMENTOS';
let etapaModalRequerResponsaveisValidacao = false; // item 5-b (relatório de testes): ao concluir Gerar Requerimentos, exige responsável+e-mail de validação TI e Negócio
const ETAPA_GERAR_ESPECIFICACAO = 'GERAR ESPECIFICAÇÃO';
let etapaModalRequerRespEspecifNegocio = false; // item 8 (novos ajustes): ao concluir Gerar Especificação, exige responsável de Avaliação por Negócio

async function loadProjetoEtapasPorNomeEtapa(nomeEtapa) {
    const etapa = obterEtapaPorNome(nomeEtapa);
    if (!etapa) {
        console.error(`Etapa "${nomeEtapa}" não encontrada em fases_etapas — rode schema_motor_workflow.sql ou cadastre a etapa em Parâmetros.`);
        projetoEtapasData = [];
        return;
    }
    const { data, error } = await _supabase.from('projeto_etapas').select('*').eq('etapa_id', etapa.id);
    projetoEtapasData = error ? [] : (data || []);
}

// -------------------------------------------------------------------------
// Motor "consciente de fase" (Especificacao_Workflow_v4.md, seção 13,
// opção (a)): carrega TODAS as etapas de uma fase de uma vez (não só
// uma), e descobre em qual etapa dentro da fase cada projeto está —
// necessário para fases com múltiplas etapas compartilhando o mesmo
// projetos.etapa_atual (ex.: Requerimentos tem 4 etapas, todas com
// etapa_atual = 'REQUIREMENTS').
// -------------------------------------------------------------------------
async function loadProjetoEtapasPorFase(etapaIds) {
    if (!etapaIds || etapaIds.length === 0) {
        projetoEtapasData = [];
        return;
    }
    const { data, error } = await _supabase.from('projeto_etapas').select('*').in('etapa_id', etapaIds);
    projetoEtapasData = error ? [] : (data || []);
}

// Retorna a etapa "atual" de um projeto dentro de uma fase: a primeira
// etapa (em ordem) ainda não concluída. Retorna null se todas as etapas
// da fase já foram concluídas (a fase inteira está pronta pra avançar), e
// a string 'REPROVADO' se alguma etapa de decisão da fase foi reprovada
// (bloqueia o restante da fase).
function obterEtapaAtualNaFase(codigoProjeto, etapasDaFase) {
    for (const etapa of etapasDaFase) {
        const pe = obterProjetoEtapa(codigoProjeto, etapa.etapa);
        if (pe && pe.decisao_resultado === 'REPROVADO') {
            return 'REPROVADO';
        }
        if (!pe || pe.situacao !== 'EXECUCAO_CONCLUIDO') {
            return etapa;
        }
    }
    return null;
}

function obterProjetoEtapa(codigoProjeto, nomeEtapa) {
    const etapa = obterEtapaPorNome(nomeEtapa);
    if (!etapa) return null;
    return projetoEtapasData.find(pe => pe.projeto_codigo === codigoProjeto && pe.etapa_id === etapa.id) || null;
}

// -------------------------------------------------------------------------
// Percentual previsto vs. realizado, com alerta (Especificacao_Workflow_v4.md,
// seção 5): compara quanto do prazo planejado já decorreu (em dias úteis)
// contra o quanto foi de fato realizado. Atraso de até 50 pontos
// percentuais = amarelo; acima disso = vermelho.
// -------------------------------------------------------------------------
function calcularAlertaEvolucao(pe) {
    if (!pe || !pe.data_inicio_planejamento || !pe.data_termino_planejamento) return null;

    const hojeStr = new Date().toISOString().split('T')[0];
    if (hojeStr < pe.data_inicio_planejamento) return null; // ainda não começou

    const totalDiasUteis = contarDiasUteisEntre(pe.data_inicio_planejamento, pe.data_termino_planejamento);
    if (totalDiasUteis <= 0) return null;

    const dataReferencia = hojeStr > pe.data_termino_planejamento ? pe.data_termino_planejamento : hojeStr;
    const decorridosDiasUteis = contarDiasUteisEntre(pe.data_inicio_planejamento, dataReferencia);

    const percentualPrevisto = Math.min(100, Math.round((decorridosDiasUteis / totalDiasUteis) * 100));
    const percentualRealizado = pe.percentual_evolucao || 0;
    const diferenca = percentualPrevisto - percentualRealizado;

    if (diferenca <= 0) return { nivel: 'ok', percentualPrevisto, diferenca: 0 };
    if (diferenca <= 50) return { nivel: 'amarelo', percentualPrevisto, diferenca };
    return { nivel: 'vermelho', percentualPrevisto, diferenca };
}

function renderBadgeAlertaEvolucao(pe) {
    const alerta = calcularAlertaEvolucao(pe);
    if (!alerta || alerta.nivel === 'ok') return '';

    const cor = alerta.nivel === 'vermelho' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
    const icone = alerta.nivel === 'vermelho' ? '🔴' : '🟡';
    return `<span class="${cor} font-bold px-1.5 py-0.5 rounded text-[9px] ml-1" title="Previsto: ${alerta.percentualPrevisto}% | Realizado: ${pe.percentual_evolucao || 0}% | Atraso: ${alerta.diferenca} pontos">${icone} Previsto ${alerta.percentualPrevisto}%</span>`;
}

// NOVO 10/08/2026 (bug reportado pelo usuário: Dashboard não detectava
// etapas atrasadas fora de Business Case/Requerimentos): normaliza o
// nome da fase e acha a etapa "corrente" (a próxima pendente dentro da
// fase atual do projeto) — usado pelo Dashboard (calcularSaudeProjeto) E
// pelo Cronograma & Evolução, pra não duplicar a mesma lógica duas
// vezes com risco de ficarem dessincronizadas.
function normalizarNomeFaseWorkflow(nomeFaseProjeto) {
    const nome = (nomeFaseProjeto || 'BUSINESS CASE').toUpperCase();
    const aliases = { 'GO LIVE': 'GOLIVE', 'CONCLUIDO': 'GOLIVE', 'REQUIREMENTS': 'REQUERIMENTS' };
    return aliases[nome] || nome;
}

function obterEtapaCorrenteEProgresso(p, todasEtapas) {
    const faseCanonica = normalizarNomeFaseWorkflow(p.etapa_atual);
    const etapasDaFase = obterEtapasDaFase(faseCanonica);
    if (!etapasDaFase || etapasDaFase.length === 0) return null;

    for (const et of etapasDaFase) {
        // CORRIGIDO 10/08/2026 (bug reportado pelo usuário: todo projeto
        // aparecia "A Planejar" mesmo já tendo avançado bem além disso):
        // "Formalização Demanda" nunca ganha uma linha em projeto_etapas
        // — ela é controlada direto pela tabela projetos (criação da
        // demanda), fora do motor genérico. Sem esse pulo, o loop
        // sempre parava nela (pe nunca existe -> sempre "pendente"),
        // nunca chegando a olhar pra etapa real seguinte (Realizar
        // Orçamento e além).
        if (et.etapa === 'FORMALIZAÇÃO DEMANDA') continue;

        const pe = todasEtapas.find(row => row.projeto_codigo === p.codigo && row.etapa_id === et.id);
        if (!pe || pe.situacao !== 'EXECUCAO_CONCLUIDO') {
            return { etapa: et, pe: pe || null };
        }
    }
    return null; // toda a fase já concluída
}

// -------------------------------------------------------------------------
// Tela genérica de listagem (A Planejar / Em Andamento) para uma fase.
// -------------------------------------------------------------------------
async function renderFaseGenericaView(etapaAtualProjeto, nomeEtapaWorkflow, tbodyAPlanejarId, tbodyEmAndamentoId, refreshCallback, exigeRatificacao, tabId) {
    const projetosNaFase = projectsData.filter(p => {
        const etapa = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        return etapa === etapaAtualProjeto && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD'; // item 1 (relatório de testes): projeto em HOLD some de todas as telas operacionais
    });
    await renderListaPlanejamentoEvolucao(projetosNaFase, nomeEtapaWorkflow, tbodyAPlanejarId, tbodyEmAndamentoId, refreshCallback, exigeRatificacao, tabId);
}

// Variante que recebe a lista de projetos JÁ FILTRADA pelo chamador — usada
// quando a elegibilidade não pode ser expressa só por etapa_atual (ex.:
// "Realizar Orçamento" precisa também checar sub_status === 'PLANEJADO',
// já que etapa_atual = 'BUSINESS CASE' cobre várias sub-etapas ao mesmo
// tempo). renderFaseGenericaView acima é só um atalho para o caso comum
// (1 fase = 1 etapa = filtro só por etapa_atual).
async function renderListaPlanejamentoEvolucao(projetosElegiveis, nomeEtapaWorkflow, tbodyAPlanejarId, tbodyEmAndamentoId, refreshCallback, exigeRatificacao, tabId) {
    callbackAtualizarViewGenerica = refreshCallback;

    await loadProjetoEtapasPorNomeEtapa(nomeEtapaWorkflow);

    // NOVO (item 2 do relatório de testes): lista ordenada por código de
    // projeto — antes não tinha ordenação nenhuma (ordem de carga do
    // banco). Aplica em todas as fases que usam este motor genérico.
    const projetosOrdenados = [...projetosElegiveis].sort((a, b) => a.codigo.localeCompare(b.codigo));

    let aPlanejar = [];
    let emAndamento = [];

    projetosOrdenados.forEach(p => {
        const pe = obterProjetoEtapa(p.codigo, nomeEtapaWorkflow);
        if (!pe || pe.situacao === 'PLANEJAMENTO_A_INICIAR') {
            aPlanejar.push(p);
        } else {
            emAndamento.push({ projeto: p, etapa: pe });
        }
    });

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área,
    // aplicada por sub-aba (a_planejar/em_andamento podem ter
    // restricao_area diferente uma da outra no catálogo).
    if (tabId) {
        aPlanejar = filtrarProjetosPorArea(aPlanejar, `${tabId}:a_planejar`);
        emAndamento = emAndamento.filter(e => filtrarProjetosPorArea([e.projeto], `${tabId}:em_andamento`).length > 0);
    }

    const tbodyAPlanejar = document.getElementById(tbodyAPlanejarId);
    if (tbodyAPlanejar) {
        // CORRIGIDO 10/08/2026 (bug reportado: coluna de prazo sempre
        // vazia): calcula o prazo limite pela SLA da etapa/porte, a
        // partir de hoje (não temos um carimbo de "quando a etapa ficou
        // disponível" pra esse projeto — hoje é a base mais razoável:
        // "se começar agora, o limite é este").
        const etapaObjPrazo = obterEtapaPorNome(nomeEtapaWorkflow);
        const hojeStrPrazo = new Date().toISOString().split('T')[0];
        tbodyAPlanejar.innerHTML = aPlanejar.length === 0
            ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto pendente de planejamento nesta etapa</td></tr>`
            : aPlanejar.map(p => {
                const diasSlaPrazo = etapaObjPrazo ? obterSlaEtapaPorte(etapaObjPrazo.id, p.tamanho) : null;
                const prazoLimite = diasSlaPrazo != null ? somarDiasUteis(hojeStrPrazo, diasSlaPrazo) : '-';
                return `
                <tr>
                    <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                    <td class="p-3 text-xs font-bold">${p.tamanho || 'M'} <span class="text-gray-400 font-normal">(${horasAtuaisDoProjeto(p)}h)</span></td>
                    <td class="p-3 text-xs text-gray-500">${prazoLimite}</td>
                    <td class="p-3 text-center">
                        ${nomeEtapaWorkflow === 'EXECUTAR (EXECUTION)'
                            ? `<button onclick="abrirModalPlanejamentoExecucaoCompleto('${escapeJsAttr(p.codigo)}')" class="bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs px-3 py-1.5 rounded shadow"><i class="fa-solid fa-calendar-plus"></i> Planejar Execução</button>`
                            : `<button onclick="abrirModalPlanejamentoGenerico('${escapeJsAttr(p.codigo)}', '${escapeJsAttr(nomeEtapaWorkflow)}')" class="bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs px-3 py-1.5 rounded shadow"><i class="fa-solid fa-calendar-plus"></i> Planejar</button>`
                        }
                    </td>
                </tr>
            `;}).join('');
    }

    const tbodyEmAndamento = document.getElementById(tbodyEmAndamentoId);
    if (tbodyEmAndamento) {
        tbodyEmAndamento.innerHTML = emAndamento.length === 0
            ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em andamento nesta etapa</td></tr>`
            : emAndamento.map(({ projeto: p, etapa: pe }) => `
                <tr>
                    <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                    <td class="p-3 text-xs uppercase">${escapeHtml(pe.responsavel_etapa_nome) || '-'}</td>
                    <td class="p-3 text-xs">${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}</td>
                    <td class="p-3 text-center">
                        ${pe.situacao === 'EXECUCAO_CONCLUIDO'
                            ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-[10px]">✅ CONCLUÍDO (100%)</span>'
                            : `<button onclick="abrirModalEvolucaoGenerica('${p.codigo}', '${nomeEtapaWorkflow}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                                   <i class="fa-solid fa-chart-line"></i> Evolução (${pe.percentual_evolucao || 0}%)
                               </button>${renderBadgeAlertaEvolucao(pe)}
                               ${(!pe.percentual_evolucao && !exigeRatificacao)
                                    ? `<button onclick="abrirModalPlanejamentoGenerico('${p.codigo}', '${nomeEtapaWorkflow}')" class="ml-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-2 py-1.5 rounded" title="Ratificar/retificar o planejamento — só permitido antes da primeira marcação de evolução"><i class="fa-solid fa-pen"></i></button>`
                                    : ''}`
                        }
                    </td>
                </tr>
            `).join('');
    }
}

// NOVO (a pedido do usuário 25/08/2026 — padronização/segregação de
// atividades): tela própria de "Retificar/Ratificar Planejamento" pra
// UAT e Go-Live — antes era um botão embutido na lista de "Em Andamento"
// (renderListaPlanejamentoEvolucao acima). Mesma base de elegibilidade
// de renderFaseGenericaView (etapa_atual da fase, fora Cancelado/
// Reprovado/Hold), só a fatia que ainda não teve evolução registrada
// (pe && !pe.percentual_evolucao) — é exatamente a mesma condição que
// antes decidia se o botão aparecia.
async function renderListaRatificarPlanejamento(nomeEtapaWorkflow, tbodyId, activityKey) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const etapa = obterEtapaPorNome(nomeEtapaWorkflow);
    if (!etapa) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Etapa não configurada.</td></tr>`;
        return;
    }

    const projetosNaFase = projectsData.filter(p => {
        const et = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        return et === etapa.fase && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD';
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));

    const { data: etapasData } = await _supabase.from('projeto_etapas').select('*').eq('etapa_id', etapa.id);
    const projetoEtapasDaEtapa = etapasData || [];

    let paraRatificar = projetosNaFase
        .map(p => ({ projeto: p, etapa: projetoEtapasDaEtapa.find(pe => pe.projeto_codigo === p.codigo) }))
        .filter(({ etapa: pe }) => pe && !pe.percentual_evolucao);

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    if (activityKey) {
        paraRatificar = paraRatificar.filter(({ projeto }) => filtrarProjetosPorArea([projeto], activityKey).length > 0);
    }

    tbody.innerHTML = paraRatificar.length === 0
        ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto aguardando ratificação/retificação nesta etapa</td></tr>`
        : paraRatificar.map(({ projeto: p, etapa: pe }) => `
            <tr>
                <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs uppercase">${escapeHtml(pe.responsavel_etapa_nome) || '-'}</td>
                <td class="p-3 text-xs">${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}</td>
                <td class="p-3 text-center">
                    <button onclick="abrirModalPlanejamentoGenerico('${escapeJsAttr(p.codigo)}', '${escapeJsAttr(nomeEtapaWorkflow)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow"><i class="fa-solid fa-scale-balanced"></i> Ratificar/Retificar</button>
                </td>
            </tr>
        `).join('');
}

// -------------------------------------------------------------------------
// Variante "consciente de fase": mesma listagem A Planejar/Em Andamento,
// mas a seleção de quais projetos entram é feita pela cadeia de
// projeto_etapas dentro da fase (obterEtapaAtualNaFase), não pelo campo
// grosseiro etapa_atual — necessária pra fases com múltiplas etapas
// (Requerimentos). etapasDaFasePreCarregadas evita recarregar a lista de
// etapas da fase toda vez (o chamador já tem fasesEtapasData carregado).
// -------------------------------------------------------------------------
async function renderFaseGenericaViewPorFase(etapaAtualProjeto, nomeFaseWorkflow, nomeEtapaAlvo, tbodyAPlanejarId, tbodyEmAndamentoId, refreshCallback, activityKeyAPlanejar, activityKeyEmAndamento) {
    callbackAtualizarViewGenerica = refreshCallback;

    const etapasDaFase = obterEtapasDaFase(nomeFaseWorkflow);
    const etapaIds = etapasDaFase.map(e => e.id);
    await loadProjetoEtapasPorFase(etapaIds);

    const projetosNaFase = projectsData.filter(p => {
        const etapa = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        return etapa === etapaAtualProjeto && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD'; // item 1 (relatório de testes): projeto em HOLD some de todas as telas operacionais
    });

    let aPlanejar = [];
    let emAndamento = [];

    // Mesma ordenação por código aplicada aqui também.
    const projetosNaFaseOrdenados = [...projetosNaFase].sort((a, b) => a.codigo.localeCompare(b.codigo));

    projetosNaFaseOrdenados.forEach(p => {
        const etapaAtualDoProjeto = obterEtapaAtualNaFase(p.codigo, etapasDaFase);
        // Só entra nesta tela se a "etapa atual dentro da fase" do projeto
        // for exatamente a etapa que esta tela representa.
        if (!etapaAtualDoProjeto || etapaAtualDoProjeto === 'REPROVADO' || etapaAtualDoProjeto.etapa !== nomeEtapaAlvo) {
            return;
        }
        const pe = obterProjetoEtapa(p.codigo, nomeEtapaAlvo);
        if (!pe || pe.situacao === 'PLANEJAMENTO_A_INICIAR') {
            aPlanejar.push(p);
        } else {
            emAndamento.push({ projeto: p, etapa: pe });
        }
    });

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área
    // por sub-aba — activityKeyAPlanejar/activityKeyEmAndamento vêm
    // explícitas do chamador porque, aqui (Requerimentos/Technical), a
    // 2ª sub-aba se chama "execucao", não "em_andamento" como no resto.
    if (activityKeyAPlanejar) aPlanejar = filtrarProjetosPorArea(aPlanejar, activityKeyAPlanejar);
    if (activityKeyEmAndamento) emAndamento = emAndamento.filter(e => filtrarProjetosPorArea([e.projeto], activityKeyEmAndamento).length > 0);

    const tbodyAPlanejar = document.getElementById(tbodyAPlanejarId);
    if (tbodyAPlanejar) {
        const etapaObjPrazo2 = obterEtapaPorNome(nomeEtapaAlvo);
        const hojeStrPrazo2 = new Date().toISOString().split('T')[0];
        tbodyAPlanejar.innerHTML = aPlanejar.length === 0
            ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto pendente de planejamento nesta etapa</td></tr>`
            : aPlanejar.map(p => {
                const diasSlaPrazo2 = etapaObjPrazo2 ? obterSlaEtapaPorte(etapaObjPrazo2.id, p.tamanho) : null;
                const prazoLimite2 = diasSlaPrazo2 != null ? somarDiasUteis(hojeStrPrazo2, diasSlaPrazo2) : '-';
                return `
                <tr>
                    <td class="p-3 font-mono font-bold text-purple-700">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)} ${p.qtd_reprovacoes > 0 ? `<span class="ml-1 bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" title="Reprovado por ${escapeHtml(p.ultima_reprovacao_por) || '-'} em ${(p.ultima_reprovacao_em || '').split('T')[0]}">Em Revisão (${p.qtd_reprovacoes}ª reprovação)</span>` : ''}</td>
                    <td class="p-3 text-xs font-bold">${p.tamanho || 'M'} <span class="text-gray-400 font-normal">(${horasAtuaisDoProjeto(p)}h)</span></td>
                    <td class="p-3 text-xs text-gray-500">${prazoLimite2}</td>
                    <td class="p-3 text-center">
                        <button onclick="abrirModalPlanejamentoGenerico('${escapeJsAttr(p.codigo)}', '${escapeJsAttr(nomeEtapaAlvo)}')" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                            <i class="fa-solid fa-calendar-plus"></i> Planejar
                        </button>
                    </td>
                </tr>
            `;}).join('');
    }

    const tbodyEmAndamento = document.getElementById(tbodyEmAndamentoId);
    if (tbodyEmAndamento) {
        tbodyEmAndamento.innerHTML = emAndamento.length === 0
            ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em andamento nesta etapa</td></tr>`
            : emAndamento.map(({ projeto: p, etapa: pe }) => `
                <tr>
                    <td class="p-3 font-mono font-bold text-purple-700">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                    <td class="p-3 text-xs uppercase">${escapeHtml(pe.responsavel_etapa_nome) || '-'}</td>
                    <td class="p-3 text-xs">${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}</td>
                    <td class="p-3 text-center">
                        ${pe.situacao === 'EXECUCAO_CONCLUIDO'
                            ? (pe.decisao_resultado
                                ? `<span class="${pe.decisao_resultado === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'} font-bold px-2 py-1 rounded text-[10px]">${pe.decisao_resultado === 'APROVADO' ? '✅ APROVADO' : '❌ REPROVADO'}</span>`
                                : '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-[10px]">✅ CONCLUÍDO (100%)</span>')
                            : `<button onclick="abrirModalEvolucaoGenerica('${p.codigo}', '${nomeEtapaAlvo}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                                   <i class="fa-solid fa-chart-line"></i> Evolução (${pe.percentual_evolucao || 0}%)
                               </button>${renderBadgeAlertaEvolucao(pe)}
                               ${!pe.percentual_evolucao ? `<button onclick="abrirModalPlanejamentoGenerico('${p.codigo}', '${nomeEtapaAlvo}')" class="ml-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-2 py-1.5 rounded" title="Ratificar/retificar o planejamento — só permitido antes da primeira marcação de evolução"><i class="fa-solid fa-pen"></i></button>` : ''}`
                        }
                    </td>
                </tr>
            `).join('');
    }
}

// -------------------------------------------------------------------------
// Modal de Planejamento
// -------------------------------------------------------------------------
function abrirModalPlanejamentoGenerico(codigoProjeto, nomeEtapa) {
    const projeto = projectsData.find(p => p.codigo === codigoProjeto);
    const etapa = obterEtapaPorNome(nomeEtapa);
    if (!projeto || !etapa) return alert('Projeto ou etapa não encontrados.');

    document.getElementById('planGenCodigoHidden').value = codigoProjeto;
    document.getElementById('planGenEtapaHidden').value = nomeEtapa;
    document.getElementById('planGenNomeDisplay').innerText = `${projeto.codigo} - ${projeto.nome} — ${etapa.etapa}`;

    const respSelect = document.getElementById('planGenRespSelect');
    const responsaveisPermitidos = obterResponsaveisPorAtividade(nomeEtapa);
    respSelect.innerHTML = responsaveisPermitidos.length === 0
        ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta etapa --</option>'
        : ['<option value="" disabled selected>-- Selecione --</option>']
            .concat(responsaveisPermitidos.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}">${escapeHtml(r.nome)}</option>`))
            .join('');

    // NOVO (a pedido do usuário 25/08/2026): se já existe plano gravado
    // pra este projeto+etapa (típico de UAT/Go-Live, herdado de "Planejar
    // Execução"), pré-preenche com o que já foi definido — sem isso,
    // ratificar não faz sentido (o usuário nunca veria o que está
    // confirmando). Fora desse caso, mantém o comportamento de sempre
    // (início = hoje, término em branco).
    const planoExistente = obterProjetoEtapa(codigoProjeto, nomeEtapa);
    const hojeStr = new Date().toISOString().split('T')[0];
    document.getElementById('planGenDtInicioInput').value = planoExistente ? (planoExistente.data_inicio_planejamento || hojeStr) : hojeStr;
    // AJUSTADO (Fase 2, item 1): término deixou de vir pré-preenchido —
    // só o início vem com uma proposta; o término precisa ser digitado.
    document.getElementById('planGenDtTerminoInput').value = planoExistente ? (planoExistente.data_termino_planejamento || '') : '';
    if (planoExistente && planoExistente.responsavel_etapa_email) {
        respSelect.value = planoExistente.responsavel_etapa_email;
    }

    const eRatificacao = ETAPAS_RATIFICACAO.includes(nomeEtapa) && !!planoExistente;
    const tituloModal = document.getElementById('planGenModalTitulo');
    const btnSalvar = document.getElementById('planGenBtnSalvar');
    if (tituloModal) tituloModal.innerText = eRatificacao ? 'Ratificar ou Retificar Planejamento' : `Planejar ${etapa.etapa}`;
    if (btnSalvar) btnSalvar.innerText = eRatificacao ? 'Confirmar' : 'Salvar';

    // NOVO (Fase 2, item 1): sempre mostra os dados da demanda (vindos
    // de Formalizar Demanda) dentro do quadro de planejamento.
    const wrapperDemanda = document.getElementById('planGenDadosDemandaWrapper');
    if (wrapperDemanda) {
        const badgesExtra = `${projeto.is_adhoc ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 ml-1">Extraordinário</span>' : ''}${projeto.is_carryover ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-800 ml-1">Carryover</span>' : ''}`;
        document.getElementById('planGenDemandaArea').innerHTML = `${projeto.area || '-'}${badgesExtra}`;
        document.getElementById('planGenDemandaSolicitante').innerText = `${projeto.pessoa_solicitante || '-'}`;
        document.getElementById('planGenDemandaDescricao').innerText = projeto.descricao_projeto || '-';
        const tipoEl = document.getElementById('planGenDemandaTipo');
        tipoEl.innerText = '-';
        if (projeto.tipo_projeto_id) {
            _supabase.from('tipos_projeto').select('*').eq('id', projeto.tipo_projeto_id).maybeSingle().then(({ data: tp }) => {
                if (tp) tipoEl.innerText = `${tp.codigo} - ${tp.descricao}`;
            });
        }
        wrapperDemanda.classList.remove('hidden');
    }

    // G17 — Registro de Contratos: só aparece para a etapa de Execution.
    const contratoWrapper = document.getElementById('planGenContratoWrapper');
    if (nomeEtapa === ETAPA_REGISTRO_CONTRATOS) {
        contratoWrapper.classList.remove('hidden');
        document.getElementById('planGenTipoContratacaoInput').selectedIndex = 0;
        document.getElementById('planGenEmpresaInput').value = '';
        document.getElementById('planGenCodigoPropostaInput').value = '';
        document.getElementById('planGenValorPropostaInput').value = '';
        onChangeTipoContratacao();
    } else {
        contratoWrapper.classList.add('hidden');
    }

    document.getElementById('modalPlanejamentoGenerico').classList.remove('hidden');
}

// Mostra/esconde campos condicionais conforme o tipo de contratação
// selecionado (G17).
function onChangeTipoContratacao() {
    const tipo = document.getElementById('planGenTipoContratacaoInput').value;
    document.getElementById('planGenEmpresaWrapper').classList.toggle('hidden', tipo === 'INTERNO');
    document.getElementById('planGenPropostaWrapper').classList.toggle('hidden', tipo !== 'TERCEIRIZADO');
}

function fecharModalPlanejamentoGenerico() {
    document.getElementById('modalPlanejamentoGenerico').classList.add('hidden');
}

async function confirmarPlanejamentoGenerico() {
    const codigoProjeto = document.getElementById('planGenCodigoHidden').value;
    const nomeEtapa = document.getElementById('planGenEtapaHidden').value;
    const etapa = obterEtapaPorNome(nomeEtapa);

    const respSelect = document.getElementById('planGenRespSelect');
    const respOption = respSelect.options[respSelect.selectedIndex];
    const responsavel_etapa_email = respSelect.value;
    const responsavel_etapa_nome = respOption ? respOption.getAttribute('data-nome') : '';

    const dataInicio = document.getElementById('planGenDtInicioInput').value;
    const dataTermino = document.getElementById('planGenDtTerminoInput').value;

    if (!responsavel_etapa_email || !dataInicio || !dataTermino) {
        return alert('Preencha responsável, data de início e data de término!');
    }

    if (dataTermino <= dataInicio) {
        return alert('A data de término deve ser posterior à data de início!');
    }

    // AJUSTADO (a pedido do usuário): retirada a checagem de data dentro
    // do Ano Fiscal especificamente para Realizar Orçamento (Business
    // Case) — permite planejar sem travar pelo período do AF. Mantida
    // para as demais etapas (Gerar Requerimentos, Gerar Especificação).
    const projetoParaValidacaoAF = projectsData.find(p => p.codigo === codigoProjeto);
    if (projetoParaValidacaoAF && nomeEtapa !== 'REALIZAR ORÇAMENTO') {
        if (!validarDataDentroDoAF(dataInicio, projetoParaValidacaoAF)) {
            return alert(mensagemDataForaDoAF('A data de início', projetoParaValidacaoAF));
        }
        if (!validarDataDentroDoAF(dataTermino, projetoParaValidacaoAF)) {
            return alert(mensagemDataForaDoAF('A data de término', projetoParaValidacaoAF));
        }
    }

    // Regra: data de início >= hoje, senão pede confirmação explícita e loga.
    const hojeStr = new Date().toISOString().split('T')[0];
    let dataInicioRetroativa = false;
    let aprovadorDataRetroativa = null;

    if (dataInicio < hojeStr) {
        const confirmou = confirm(
            `⚠️ A data de início do planejamento (${dataInicio}) é anterior a hoje (${hojeStr}).\n\n` +
            `Isso ficará registrado em log de auditoria (quem aprovou, dia e hora).\n\n` +
            `Deseja confirmar mesmo assim?`
        );
        if (!confirmou) return;
        dataInicioRetroativa = true;
        aprovadorDataRetroativa = `${currentUser ? currentUser.nome : 'desconhecido'} em ${new Date().toISOString()}`;
    }

    // G17 — Registro de Contratos (só Execution): valida e monta os
    // campos condicionais conforme o tipo de contratação selecionado.
    let tipo_contratacao = null, empresa_executora = null, codigo_proposta = null, valor_proposta = null;
    if (nomeEtapa === ETAPA_REGISTRO_CONTRATOS) {
        tipo_contratacao = document.getElementById('planGenTipoContratacaoInput').value;
        if (tipo_contratacao !== 'INTERNO') {
            empresa_executora = document.getElementById('planGenEmpresaInput').value.trim().toUpperCase();
            if (!empresa_executora) {
                return alert('Informe a empresa executora!');
            }
        }
        if (tipo_contratacao === 'TERCEIRIZADO') {
            codigo_proposta = document.getElementById('planGenCodigoPropostaInput').value.trim();
            const valorPropostaInput = document.getElementById('planGenValorPropostaInput').value;
            valor_proposta = parseFloat(valorPropostaInput);
            if (!codigo_proposta || isNaN(valor_proposta) || valor_proposta <= 0) {
                return alert('Informe o código e o valor da proposta!');
            }
        }
    }

    // NOVO (a pedido do usuário 25/08/2026): em UAT/Go-Live, o plano já
    // vem herdado de "Planejar Execução" — aqui é decisão de Ratificar
    // (nada mudou) ou Retificar (algo mudou), não um planejamento novo.
    // Copia os valores ANTERIORES pra variáveis próprias AGORA (não só a
    // referência do objeto) — `planoAnterior` vem do cache
    // `projetoEtapasData`, e o upsert logo abaixo não deve deixar essa
    // comparação vulnerável a como o cache é (ou não) atualizado depois.
    const eEtapaRatificacao = ETAPAS_RATIFICACAO.includes(nomeEtapa);
    const planoAnteriorObj = eEtapaRatificacao ? obterProjetoEtapa(codigoProjeto, nomeEtapa) : null;
    const planoAnterior = planoAnteriorObj ? {
        responsavel_etapa_nome: planoAnteriorObj.responsavel_etapa_nome,
        data_inicio_planejamento: planoAnteriorObj.data_inicio_planejamento,
        data_termino_planejamento: planoAnteriorObj.data_termino_planejamento
    } : null;

    const payload = {
        projeto_codigo: codigoProjeto,
        etapa_id: etapa.id,
        situacao: 'EXECUCAO_A_INICIAR',
        responsavel_etapa_nome,
        responsavel_etapa_email,
        data_inicio_planejamento: dataInicio,
        data_termino_planejamento: dataTermino,
        data_inicio_planejamento_retroativa: dataInicioRetroativa,
        evolucao_atualizada_em: new Date().toISOString(), // Cronograma & Evolução usa isso pra saber se o responsável está atualizando
        tipo_contratacao,
        empresa_executora,
        codigo_proposta,
        valor_proposta,
        aprovador_data_retroativa: aprovadorDataRetroativa
    };

    const { error } = await _supabase.from('projeto_etapas').upsert(payload, { onConflict: 'projeto_codigo,etapa_id' });
    if (error) return alert('Erro ao salvar planejamento: ' + error.message);

    // NOVO (a pedido do usuário 25/08/2026): loga a decisão de
    // Ratificar/Retificar (só UAT/Go-Live, só quando já existia plano
    // herdado) — aparece no histórico do projeto (Detalhamento, ver
    // js/projeto-detalhe/projeto-detalhe.js).
    let ehRatificado = false;
    if (eEtapaRatificacao && planoAnterior) {
        const mudou = planoAnterior.responsavel_etapa_nome !== responsavel_etapa_nome ||
            planoAnterior.data_inicio_planejamento !== dataInicio ||
            planoAnterior.data_termino_planejamento !== dataTermino;
        ehRatificado = !mudou;
        const { error: errorLog } = await _supabase.from('log_ratificacao_planejamento').insert({
            projeto_codigo: codigoProjeto,
            etapa: etapa.etapa,
            decisao: mudou ? 'RETIFICADO' : 'RATIFICADO',
            responsavel_anterior: planoAnterior.responsavel_etapa_nome,
            data_inicio_anterior: planoAnterior.data_inicio_planejamento,
            data_termino_anterior: planoAnterior.data_termino_planejamento,
            responsavel_novo: responsavel_etapa_nome,
            data_inicio_novo: dataInicio,
            data_termino_novo: dataTermino,
            decidido_por: currentUser ? currentUser.nome : 'desconhecido'
        });
        if (errorLog) console.error('Erro ao logar ratificação/retificação do planejamento:', errorLog.message);
    }

    // CORRIGIDO (item 9-e/9-f, novos ajustes — bug reportado: projetos de
    // Requerimentos/Technical já planejados continuavam aparecendo como
    // "A Planejar" no Detalhamento do Projeto): estendido pra essas duas
    // fases também — antes só se aplicava a Realizar Orçamento. Preserva
    // o qualificador "Em Revisão" se o projeto já estava nesse estado
    // (item 10), virando "PLANEJADO - EM REVISÃO" em vez de perder essa
    // informação.
    if (['REALIZAR ORÇAMENTO', 'GERAR REQUERIMENTOS', 'GERAR ESPECIFICAÇÃO'].includes(nomeEtapa)) {
        const projAtualParaSubStatus = projectsData.find(p => p.codigo === codigoProjeto);
        const jaEmRevisao = projAtualParaSubStatus && (projAtualParaSubStatus.sub_status || '').toUpperCase().includes('EM REVISÃO');
        const novoSubStatus = jaEmRevisao ? 'PLANEJADO - EM REVISÃO' : 'PLANEJADO';
        const { error: errorSubStatus } = await _supabase.from('projetos').update({ sub_status: novoSubStatus }).eq('codigo', codigoProjeto);
        if (errorSubStatus) console.error('Erro ao atualizar sub_status após planejar:', errorSubStatus.message);
        const projLocal = projectsData.find(p => p.codigo === codigoProjeto);
        if (projLocal) projLocal.sub_status = novoSubStatus;
    }

    // NOVO (item 1, novos ajustes): disparo de e-mail — "Após realizar
    // planejamento", pontos 2/6/12 da lista fixa (Orçamentar Demanda,
    // Gerar Requeriments, Gerar Especificação). Um único hook genérico
    // cobre as três, já que dispararEmailFluxo checa o cadastro antes de
    // agir — não faz nada se a linha não existir ou estiver inativa.
    // NOVO (a pedido do usuário 25/08/2026): ratificar (nada mudou) não
    // dispara o e-mail de "planejamento realizado" de novo — só faz
    // sentido notificar quando algo de fato muda (retificação).
    if (!ehRatificado) {
        const projPlanejado = projectsData.find(p => p.codigo === codigoProjeto);
        const nomeRespPlanejado = respSelect.options[respSelect.selectedIndex] ? respSelect.options[respSelect.selectedIndex].getAttribute('data-nome') : null;
        await dispararEmailFluxo(etapa.fase, etapa.etapa, 'Após realizar planejamento', projPlanejado, {
            responsavelNome: nomeRespPlanejado,
            responsavelEmail: respSelect.value
        });
    }

    alert(eEtapaRatificacao ? (ehRatificado ? '✅ Planejamento ratificado!' : '✅ Planejamento retificado!') : '✅ Planejamento salvo!');
    fecharModalPlanejamentoGenerico();
    if (callbackAtualizarViewGenerica) await callbackAtualizarViewGenerica();
}

// -------------------------------------------------------------------------
// Modal de Evolução/Conclusão
// -------------------------------------------------------------------------
function abrirModalEvolucaoGenerica(codigoProjeto, nomeEtapa) {
    const projeto = projectsData.find(p => p.codigo === codigoProjeto);
    const etapa = obterEtapaPorNome(nomeEtapa);
    const pe = obterProjetoEtapa(codigoProjeto, nomeEtapa);
    if (!projeto || !etapa) return alert('Projeto ou etapa não encontrados.');

    document.getElementById('evolGenCodigoHidden').value = codigoProjeto;
    document.getElementById('evolGenEtapaHidden').value = nomeEtapa;

    const alerta = calcularAlertaEvolucao(pe);
    const alertaHtml = (alerta && alerta.nivel !== 'ok')
        ? `<br><span class="${alerta.nivel === 'vermelho' ? 'text-red-700' : 'text-amber-700'}">${alerta.nivel === 'vermelho' ? '🔴' : '🟡'} Previsto: ${alerta.percentualPrevisto}% já decorrido do prazo — você está ${alerta.diferenca} pontos atrás.</span>`
        : '';
    document.getElementById('evolGenNomeDisplay').innerHTML = `${projeto.codigo} - ${escapeHtml(projeto.nome)} — ${etapa.etapa}${alertaHtml}`;

    // NOVO (Fase 2, item 1): sempre mostra os dados da demanda.
    const wrapperDemanda = document.getElementById('evolGenDadosDemandaWrapper');
    if (wrapperDemanda) {
        const badgesExtraEvol = `${projeto.is_adhoc ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 ml-1">Extraordinário</span>' : ''}${projeto.is_carryover ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-800 ml-1">Carryover</span>' : ''}`;
        document.getElementById('evolGenDemandaArea').innerHTML = `${projeto.area || '-'}${badgesExtraEvol}`;
        document.getElementById('evolGenDemandaSolicitante').innerText = projeto.pessoa_solicitante || '-';
        document.getElementById('evolGenDemandaDescricao').innerText = projeto.descricao_projeto || '-';
        wrapperDemanda.classList.remove('hidden');
    }

    // AJUSTADO (Fase 2, item 1): percentual passou de campo numérico
    // livre pra um seletor 0-100.
    const percentualAtual = pe ? (pe.percentual_evolucao || 0) : 0;
    document.getElementById('evolGenPercentualAtualHidden').value = percentualAtual;
    const selectPercentual = document.getElementById('evolGenPercentualInput');
    selectPercentual.innerHTML = Array.from({ length: 101 }, (_, i) => `<option value="${i}" ${i === percentualAtual ? 'selected' : ''}>${i}%</option>`).join('');
    document.getElementById('evolGenRelatorioInput').value = '';
    document.getElementById('evolGenObservacoesInput').value = '';
    document.getElementById('evolGenObservacoesWrapper').classList.add('hidden');
    document.getElementById('evolGenDecisaoWrapper').classList.add('hidden');
    document.getElementById('evolGenDecisaoInput').selectedIndex = 0; // padrão: Aprovado
    etapaModalRequerDecisao = !!etapa.requer_decisao_aprovacao;

    // G17: exige valor gasto na conclusão só se esta etapa é Execution E o
    // contrato registrado no planejamento foi "Interno com Terceiros".
    etapaModalExigeValorGasto = (nomeEtapa === ETAPA_REGISTRO_CONTRATOS && pe && pe.tipo_contratacao === 'INTERNO_COM_TERCEIROS');
    document.getElementById('evolGenValorGastoWrapper').classList.add('hidden');
    document.getElementById('evolGenValorGastoInput').value = pe ? (pe.valor_gasto_execucao || '') : '';

    etapaModalRequerDefinicaoOrcamento = !!etapa.requer_definicao_orcamento;
    document.getElementById('evolGenOrcamentoWrapper').classList.add('hidden');
    if (etapaModalRequerDefinicaoOrcamento) {
        // CORRIGIDO 10/08/2026 (apontado pelo usuário): Classificação
        // Financeira e Porte não devem vir pré-selecionados aqui — um
        // valor pré-marcado nesses dois campos pode passar despercebido
        // e ser salvo sem escolha consciente. Ficam sempre em
        // "-- Selecione --" ao abrir; só o valor (que é um número, não
        // uma opção escondida) continua sugerido a partir do que já
        // existe, para servir de ponto de partida editável.
        document.getElementById('evolGenTipoOrcamentoInput').value = '';
        document.getElementById('evolGenValorOrcamentoInput').value = projeto.val_bc || projeto.previsto || '';
        document.getElementById('evolGenHorasProjetoInput').value = projeto.horas_bc || '';
        document.getElementById('evolGenObservacoesEncerramentoInput').value = '';
        const avisoPorteCalc = document.getElementById('evolGenPorteCalculadoAviso');
        if (avisoPorteCalc) avisoPorteCalc.innerText = '';
    }

    // AJUSTADO (item 7, novos ajustes): trocado de campos de texto livre
    // (nome/e-mail digitados) por seleção da lista de Responsáveis por
    // Atividade, filtrados pela função certa — mesmo padrão já usado no
    // planejamento genérico (obterResponsaveisPorAtividade).
    etapaModalRequerResponsaveisValidacao = (nomeEtapa === ETAPA_GERAR_REQUERIMENTOS);
    document.getElementById('evolGenResponsaveisValidacaoWrapper').classList.add('hidden');
    if (etapaModalRequerResponsaveisValidacao) {
        const selectTi = document.getElementById('evolGenRespValidacaoTiSelect');
        const respTiPermitidos = obterResponsaveisPorAtividade('APROVAR REQUERIMENTOS TI');
        selectTi.innerHTML = respTiPermitidos.length === 0
            ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta função --</option>'
            : ['<option value="" disabled selected>-- Selecione --</option>']
                .concat(respTiPermitidos.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}" ${r.email === projeto.resp_validacao_ti_email ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`))
                .join('');

        const selectNegocio = document.getElementById('evolGenRespValidacaoNegocioSelect');
        const respNegocioPermitidos = obterResponsaveisPorAtividade('APROVAR REQUERIMENTOS NEGÓCIO');
        selectNegocio.innerHTML = respNegocioPermitidos.length === 0
            ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta função --</option>'
            : ['<option value="" disabled selected>-- Selecione --</option>']
                .concat(respNegocioPermitidos.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}" ${r.email === projeto.resp_validacao_negocio_email ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`))
                .join('');
    }

    // NOVO (item 8, novos ajustes): mesma lógica, pra Gerar
    // Especificação — só o responsável de Negócio.
    etapaModalRequerRespEspecifNegocio = (nomeEtapa === ETAPA_GERAR_ESPECIFICACAO);
    document.getElementById('evolGenRespEspecifNegocioWrapper').classList.add('hidden');
    if (etapaModalRequerRespEspecifNegocio) {
        const selectEspecifNegocio = document.getElementById('evolGenRespEspecifNegocioSelect');
        const respPermitidos = obterResponsaveisPorAtividade('AVALIAR ESPECIFICAÇÃO NEGÓCIO');
        selectEspecifNegocio.innerHTML = respPermitidos.length === 0
            ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta função --</option>'
            : ['<option value="" disabled selected>-- Selecione --</option>']
                .concat(respPermitidos.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}" ${r.email === projeto.resp_validacao_especif_negocio_email ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`))
                .join('');
    }

    document.getElementById('modalEvolucaoGenerico').classList.remove('hidden');
    onChangePercentualEvolucaoGenerica();
}

function fecharModalEvolucaoGenerico() {
    document.getElementById('modalEvolucaoGenerico').classList.add('hidden');
}

// Mostra o campo de observações (e o de decisão/valor gasto, se
// aplicável) assim que 100% for digitado.
function onChangePercentualEvolucaoGenerica() {
    const val = parseInt(document.getElementById('evolGenPercentualInput').value);
    // AJUSTADO (Fase 2, item 1): pra "Realizar Orçamento", o campo de
    // observações genérico fica escondido — o "Registro de Encerramento
    // da Atividade" já traz o campo de observações integrado junto de
    // Classificação/Porte/Valor, num quadro só (evita duplicar o campo).
    document.getElementById('evolGenObservacoesWrapper').classList.toggle('hidden', val !== 100 || etapaModalRequerDefinicaoOrcamento);
    document.getElementById('evolGenDecisaoWrapper').classList.toggle('hidden', !(val === 100 && etapaModalRequerDecisao));
    document.getElementById('evolGenValorGastoWrapper').classList.toggle('hidden', !(val === 100 && etapaModalExigeValorGasto));
    document.getElementById('evolGenOrcamentoWrapper').classList.toggle('hidden', !(val === 100 && etapaModalRequerDefinicaoOrcamento));
    document.getElementById('evolGenResponsaveisValidacaoWrapper').classList.toggle('hidden', !(val === 100 && etapaModalRequerResponsaveisValidacao));
    document.getElementById('evolGenRespEspecifNegocioWrapper').classList.toggle('hidden', !(val === 100 && etapaModalRequerRespEspecifNegocio));
}

// NOVO (item 10, novos ajustes): log persistente de toda decisão de
// aprovação/reprovação — nunca é apagado (diferente das linhas de
// projeto_etapas, que são resetadas a cada reprovação pra reiniciar o
// ciclo da fase). É a fonte de verdade do histórico.
async function logDecisaoEtapa(codigoProjeto, fase, etapa, decisao, motivo) {
    const { error } = await _supabase.from('log_decisoes_etapa').insert([{
        projeto_codigo: codigoProjeto,
        fase, etapa, decisao,
        decidido_por: currentUser ? currentUser.nome : 'desconhecido',
        decidido_em: new Date().toISOString(),
        motivo: motivo || null
    }]);
    if (error) console.error('Erro ao registrar log de decisão:', error.message);
}

async function confirmarEvolucaoGenerica() {
    const codigoProjeto = document.getElementById('evolGenCodigoHidden').value;
    const nomeEtapa = document.getElementById('evolGenEtapaHidden').value;
    const etapa = obterEtapaPorNome(nomeEtapa);
    const percentual = parseInt(document.getElementById('evolGenPercentualInput').value);

    if (isNaN(percentual) || percentual < 0 || percentual > 100) {
        return alert('Informe um percentual entre 0 e 100!');
    }

    // NOVO (item 5, novos ajustes — bug reportado: estava permitindo
    // involuir, ou seja, alimentar percentual menor do que o já salvo):
    // bloqueia qualquer tentativa de diminuir o percentual em relação ao
    // que já está registrado.
    const percentualAtual = parseInt(document.getElementById('evolGenPercentualAtualHidden').value) || 0;
    if (percentual < percentualAtual) {
        return alert(`⛔ Não é possível reduzir o percentual de evolução. O valor atual é ${percentualAtual}% — informe ${percentualAtual}% ou mais.`);
    }

    const payload = {
        projeto_codigo: codigoProjeto,
        etapa_id: etapa.id,
        percentual_evolucao: percentual,
        situacao: percentual === 100 ? 'EXECUCAO_CONCLUIDO' : 'EXECUCAO_EM_ANDAMENTO',
        evolucao_atualizada_em: new Date().toISOString(),
        // NOVO (Fase 2, item 1): relatório opcional sobre a evolução, e
        // registro de quem atualizou (auditoria — a data já é capturada
        // acima em evolucao_atualizada_em).
        relatorio_evolucao: document.getElementById('evolGenRelatorioInput').value.trim() || null,
        evolucao_atualizada_por: currentUser ? currentUser.nome : 'desconhecido'
    };
    let dadosOrcamento = null; // precisa ficar visível depois do bloco abaixo (usado após o upsert)
    let dadosResponsaveisValidacao = null; // idem — usado após o upsert pra atualizar o projeto

    if (percentual === 100) {
        // AJUSTADO (Fase 2, item 1): pra "Realizar Orçamento", a
        // observação agora vem do campo integrado no quadro de
        // "Registro de Encerramento da Atividade" (evita duplicar).
        const observacoes = etapaModalRequerDefinicaoOrcamento
            ? document.getElementById('evolGenObservacoesEncerramentoInput').value.trim()
            : document.getElementById('evolGenObservacoesInput').value.trim();
        if (!observacoes) {
            return alert('Ao atingir 100%, é obrigatório registrar observações sobre a conclusão!');
        }

        // AJUSTADO (item 7, novos ajustes): captura e valida o
        // responsável de validação TI e Negócio via seleção da lista de
        // Responsáveis por Atividade (data-nome do option escolhido),
        // em vez de nome/e-mail digitados.
        if (etapaModalRequerResponsaveisValidacao) {
            const selectTi = document.getElementById('evolGenRespValidacaoTiSelect');
            const selectNegocio = document.getElementById('evolGenRespValidacaoNegocioSelect');
            const respTiEmail = selectTi.value;
            const respTiNome = respTiEmail ? selectTi.options[selectTi.selectedIndex].getAttribute('data-nome') : '';
            const respNegocioEmail = selectNegocio.value;
            const respNegocioNome = respNegocioEmail ? selectNegocio.options[selectNegocio.selectedIndex].getAttribute('data-nome') : '';
            if (!respTiNome || !respTiEmail || !respNegocioNome || !respNegocioEmail) {
                return alert('Selecione o responsável pela validação de TI e de Negócio!');
            }
            dadosResponsaveisValidacao = {
                resp_validacao_ti_nome: respTiNome,
                resp_validacao_ti_email: respTiEmail,
                resp_validacao_negocio_nome: respNegocioNome,
                resp_validacao_negocio_email: respNegocioEmail
            };
        }

        // NOVO (item 8, novos ajustes): captura e valida o responsável
        // de Avaliação de Especificação por Negócio ao concluir Gerar
        // Especificação.
        if (etapaModalRequerRespEspecifNegocio) {
            const selectEspecifNegocio = document.getElementById('evolGenRespEspecifNegocioSelect');
            const respEspecifEmail = selectEspecifNegocio.value;
            const respEspecifNome = respEspecifEmail ? selectEspecifNegocio.options[selectEspecifNegocio.selectedIndex].getAttribute('data-nome') : '';
            if (!respEspecifNome || !respEspecifEmail) {
                return alert('Selecione o responsável pela Avaliação de Especificação por Negócio!');
            }
            dadosResponsaveisValidacao = {
                resp_validacao_especif_negocio_nome: respEspecifNome,
                resp_validacao_especif_negocio_email: respEspecifEmail
            };
        }

        if (etapa.requer_decisao_aprovacao) {
            const decisao = document.getElementById('evolGenDecisaoInput').value;
            if (!decisao) {
                return alert('Selecione o resultado da avaliação (Aprovado/Reprovado)!');
            }
            payload.decisao_resultado = decisao;
        }

        // G17 — Registro de Contratos: valor gasto obrigatório na
        // conclusão de Execution quando o contrato é "Interno com
        // Terceiros" (definido no planejamento desta etapa).
        if (etapaModalExigeValorGasto) {
            const valorGastoInput = document.getElementById('evolGenValorGastoInput').value;
            const valor_gasto_execucao = parseFloat(valorGastoInput);
            if (isNaN(valor_gasto_execucao) || valor_gasto_execucao < 0) {
                return alert('Informe o valor gasto na execução (controlado por timesheet)!');
            }

            // NOVO 10/08/2026 (item 14 do relatório de testes): confronta
            // o valor gasto com o orçado pro projeto (o mais recente
            // definido — Technical > Requerimentos > Business Case). Se
            // for maior, exige uma aprovação explícita da divergência,
            // registrando quem aprovou, quando, e os dois valores.
            const projExec = projectsData.find(pr => pr.codigo === codigoProjeto);
            const valorOrcado = projExec ? (Number(projExec.val_tech) || Number(projExec.val_req) || Number(projExec.val_bc) || 0) : 0;
            if (valorOrcado > 0 && valor_gasto_execucao > valorOrcado) {
                const diferenca = valor_gasto_execucao - valorOrcado;
                const confirmouDivergencia = confirm(
                    `⚠️ O valor gasto (R$ ${valor_gasto_execucao.toLocaleString('pt-BR', {minimumFractionDigits:2})}) é MAIOR que o valor orçado pro projeto (R$ ${valorOrcado.toLocaleString('pt-BR', {minimumFractionDigits:2})}) — diferença de R$ ${diferenca.toLocaleString('pt-BR', {minimumFractionDigits:2})}.\n\nConfirma e aprova essa divergência, ciente de que ela vai ficar registrada?`
                );
                if (!confirmouDivergencia) {
                    return alert('Conclusão cancelada — o valor gasto não pode exceder o orçado sem aprovação da divergência.');
                }
                payload.valor_gasto_divergente_aprovado_por = currentUser ? currentUser.nome : 'desconhecido';
                payload.valor_gasto_divergente_aprovado_em = new Date().toISOString();
                payload.valor_gasto_divergente_valor_orcado = valorOrcado;
            }

            payload.valor_gasto_execucao = valor_gasto_execucao;
        }

        // G5 — Realizar Orçamento migrado pro motor genérico: na conclusão,
        // pede classificação financeira, valor e porte.
        let dadosOrcamentoLocal = null;
        if (etapaModalRequerDefinicaoOrcamento) {
            const tipo_orcamento = document.getElementById('evolGenTipoOrcamentoInput').value;
            const val_bc = parseFloat(document.getElementById('evolGenValorOrcamentoInput').value);
            const horas = parseFloat(document.getElementById('evolGenHorasProjetoInput').value);
            if (!tipo_orcamento || isNaN(val_bc) || val_bc <= 0 || isNaN(horas) || horas <= 0) {
                return alert('Preencha classificação financeira, valor do orçamento e quantidade de horas do projeto!');
            }

            // AJUSTADO (a pedido do usuário 24/08/2026): porte deixou de
            // ser escolhido/validado contra o valor — agora é só
            // calculado a partir das horas informadas. Se nenhuma faixa
            // cadastrada cobre esse total, bloqueia (em vez de salvar
            // com porte nulo/errado em silêncio).
            const porteCalculado = obterPortePorHoras(horas);
            if (!porteCalculado) {
                return alert(`⛔ Nenhum porte cadastrado cobre ${horas}h. Ajuste a quantidade de horas ou cadastre/ajuste as faixas em Administração → Cadastro de Porte.`);
            }

            dadosOrcamentoLocal = { tipo_orcamento, val_bc, horas, tamanho: porteCalculado.codigo };
        }
        dadosOrcamento = dadosOrcamentoLocal;

        if (!confirm('Confirma a CONCLUSÃO desta etapa? Isso ficará registrado em log de auditoria.')) return;

        payload.observacoes_conclusao = observacoes;
        payload.concluido_por = currentUser ? currentUser.nome : 'desconhecido';
        payload.concluido_em = new Date().toISOString();

        if (dadosOrcamento) {
            payload.tipo_orcamento_definido = dadosOrcamento.tipo_orcamento;
            payload.valor_orcamento_definido = dadosOrcamento.val_bc;
            payload.porte_ratificado = dadosOrcamento.tamanho;
            payload.qtd_horas_definida = dadosOrcamento.horas;
        }
    }

    const { error } = await _supabase.from('projeto_etapas').upsert(payload, { onConflict: 'projeto_codigo,etapa_id' });
    if (error) return alert('Erro ao salvar evolução: ' + error.message);

    // NOVO (item 10, novos ajustes): loga a decisão ANTES de qualquer
    // reset de ciclo — o log persiste mesmo que as linhas de
    // projeto_etapas dessa fase sejam apagadas logo abaixo.
    if (payload.decisao_resultado) {
        await logDecisaoEtapa(codigoProjeto, etapa.fase, etapa.etapa, payload.decisao_resultado);

        // NOVO (item 1, novos ajustes): disparo de e-mail — pontos
        // 7/8/9/10/13/14 (aprovar/reprovar Requerimentos TI/Negócio,
        // Especificação Negócio). "Quando dispara" muda conforme
        // aprovado/reprovado, mas a etapa cadastrada é a mesma.
        const projDecisao = projectsData.find(pr => pr.codigo === codigoProjeto);
        const peDecisao = obterProjetoEtapa(codigoProjeto, etapa.etapa);
        const quandoDispara = payload.decisao_resultado === 'APROVADO' ? 'Após aprovar projeto' : 'Após reprovar projeto';
        await dispararEmailFluxo(etapa.fase, etapa.etapa, quandoDispara, projDecisao, {
            responsavelNome: peDecisao ? peDecisao.responsavel_etapa_nome : null,
            responsavelEmail: peDecisao ? peDecisao.responsavel_etapa_email : null
        });
    }

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário — na fase de
    // Requerimentos): antes, reprovar deixava o projeto com sub_status =
    // 'REPROVADO' pra sempre, o que o excluía de TODAS as telas
    // (nenhum filtro que checa sub !== 'REPROVADO' voltava a mostrá-lo)
    // — um beco sem saída. Agora: reprova, LOGA a reprovação no projeto
    // (quem, quando, qual etapa reprovou), e reinicia o ciclo inteiro da
    // FASE (não só da etapa) — apaga as linhas de projeto_etapas dessa
    // fase pra esse projeto, fazendo o motor "consciente de fase"
    // (obterEtapaAtualNaFase) recomeçar da primeira etapa novamente,
    // exigindo novo planejamento e nova evolução em cada etapa até
    // passar de novo pelas que reprovaram.
    if (payload.decisao_resultado === 'REPROVADO') {
        const etapasDaMesmaFase = obterEtapasDaFase(etapa.fase).map(e => e.id);
        const { error: errorReset } = await _supabase.from('projeto_etapas').delete().eq('projeto_codigo', codigoProjeto).in('etapa_id', etapasDaMesmaFase);
        if (errorReset) console.error('Erro ao reiniciar o ciclo da fase após reprovação:', errorReset.message);

        // AJUSTADO 10/08/2026 (item 11 do relatório de testes): status
        // distinto "A PLANEJAR - EM REVISÃO" (não só "A PLANEJAR", pra
        // ficar visível em qualquer pesquisa/lista que já mostra
        // sub_status) e contador de quantas vezes esse projeto já foi
        // reprovado — pode acontecer mais de uma vez.
        const projAtual = projectsData.find(p => p.codigo === codigoProjeto);
        const payloadReprova = {
            sub_status: 'A PLANEJAR - EM REVISÃO',
            ultima_reprovacao_por: currentUser ? currentUser.nome : 'desconhecido',
            ultima_reprovacao_em: new Date().toISOString(),
            ultima_reprovacao_etapa: etapa.etapa,
            qtd_reprovacoes: (projAtual && projAtual.qtd_reprovacoes || 0) + 1
        };
        const { error: errorReprova } = await _supabase.from('projetos').update(payloadReprova).eq('codigo', codigoProjeto);
        if (errorReprova) console.error('Erro ao registrar reprovação:', errorReprova.message);
        const proj = projectsData.find(p => p.codigo === codigoProjeto);
        if (proj) Object.assign(proj, payloadReprova);

        alert(`⚠️ Etapa reprovada (${payloadReprova.qtd_reprovacoes}ª vez). O ciclo da fase "${etapa.fase}" foi reiniciado para este projeto — ele volta pra "A Planejar - Em Revisão" na primeira etapa da fase, exigindo novo planejamento.`);
        fecharModalEvolucaoGenerico();
        if (callbackAtualizarViewGenerica) await callbackAtualizarViewGenerica();
        return;
    }

    // CORRIGIDO 10/08/2026 (bug reportado: valor gasto em Execution não
    // aparecia no Dashboard): o Dashboard só lê projetos.realizado (nunca
    // populado antes) — não cruza com projeto_etapas.valor_gasto_execucao.
    // Em vez de fazer o Dashboard aprender a cruzar tabelas, grava o
    // valor também no projeto — reaproveita tudo que já existe (KPIs,
    // lista detalhada, etc.).
    // AJUSTADO (a pedido do usuário 26/08/2026): deixou de ser um SET
    // direto (que sobrescrevia qualquer valor já composto pelos vínculos
    // de contrato — Fase 3/4) e passou a recalcular somando este valor
    // gasto legado com os vínculos do projeto (recalcularRealizadoProjeto,
    // em contratos.js) — as duas origens precisam compor o mesmo total.
    if (payload.valor_gasto_execucao != null) {
        if (typeof recalcularRealizadoProjeto === 'function') {
            await recalcularRealizadoProjeto(codigoProjeto);
        } else {
            console.error('recalcularRealizadoProjeto não encontrada — js/contratos/contratos.js precisa estar carregado.');
        }
    }

    // G5: grava o orçamento definido também no PROJETO (não só na etapa) —
    // necessário porque a tela de Comitê (approvals/comite.js), que não
    // muda nesta migração, continua lendo projetos.val_bc/tipo_orcamento/
    // sub_status diretamente.
    if (dadosOrcamento) {
        const payloadProjeto = {
            tipo_orcamento: dadosOrcamento.tipo_orcamento,
            val_bc: dadosOrcamento.val_bc,
            previsto: dadosOrcamento.val_bc,
            tamanho: dadosOrcamento.tamanho,
            horas_bc: dadosOrcamento.horas,
            sub_status: 'ORÇAMENTO REALIZADO',
            status_comite: 'PENDENTE'
        };
        const { error: errorProjeto } = await _supabase.from('projetos').update(payloadProjeto).eq('codigo', codigoProjeto);
        if (errorProjeto) return alert('Etapa concluída, mas houve erro ao atualizar o orçamento do projeto: ' + errorProjeto.message);
        const proj = projectsData.find(p => p.codigo === codigoProjeto);
        if (proj) Object.assign(proj, payloadProjeto);
    }

    // NOVO (item 5-b do relatório de testes): grava os responsáveis de
    // validação TI/Negócio no projeto (não só na etapa) — usados depois
    // nas etapas de Avaliação TI/Negócio e em envios de e-mail.
    if (dadosResponsaveisValidacao) {
        const { error: errorResp } = await _supabase.from('projetos').update(dadosResponsaveisValidacao).eq('codigo', codigoProjeto);
        if (errorResp) console.error('Etapa concluída, mas houve erro ao gravar responsáveis de validação:', errorResp.message);
        const projResp = projectsData.find(p => p.codigo === codigoProjeto);
        if (projResp) Object.assign(projResp, dadosResponsaveisValidacao);
    }

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário: Execution
    // concluído não avançava de fase): quando a etapa concluída em 100%
    // é a ÚLTIMA etapa da sua fase — e não é uma etapa de decisão nem de
    // definição de orçamento, que têm fluxo próprio — avança
    // projeto.etapa_atual automaticamente pra fase seguinte na
    // sequência global. Cobre Execution -> UAT -> Go-Live -> Concluído
    // (fases de etapa única, sem aprovação manual no meio).
    if (percentual === 100 && !etapa.requer_decisao_aprovacao && !etapa.requer_definicao_orcamento) {
        const etapasDaFase = obterEtapasDaFase(etapa.fase);
        const maxOrdemDaFase = Math.max(...etapasDaFase.map(e => e.ordem));
        const ehUltimaDaFase = etapa.ordem === maxOrdemDaFase;

        if (ehUltimaDaFase) {
            const ativasGlobal = fasesEtapasData.filter(e => e.ativo !== false).sort((a, b) => a.ordem - b.ordem);
            const idxAtual = ativasGlobal.findIndex(e => e.id === etapa.id);
            const proximaEtapaGlobal = (idxAtual >= 0 && idxAtual < ativasGlobal.length - 1) ? ativasGlobal[idxAtual + 1] : null;

            let payloadAvanco;
            if (!proximaEtapaGlobal) {
                // CORRIGIDO (a pedido do usuário 02/09/2026 — bug reportado):
                // a ÚLTIMA fase do fluxo (Go-Live) concluída em 100% NÃO
                // migra sozinha para "Concluído". O projeto fica PENDENTE
                // DE TERMO DE ACEITE (etapa_atual continua 'GOLIVE') e só
                // vai para a Conclusão pela tela "Concluir Projeto/
                // Subprojeto", que exige o Termo de Aceite registrado +
                // zero ocorrências de erro abertas.
                payloadAvanco = { sub_status: 'PENDENTE TERMO DE ACEITE' };
            } else {
                // NOVO (a pedido do usuário 25/08/2026): ao entrar em UAT ou
                // Go-Live, o plano já pode existir (herdado de "Planejar
                // Execução") — nesse caso o projeto não está "a planejar",
                // está "a ratificar". Consulta pontual porque o cache
                // projetoEtapasData está carregado pra etapa ATUAL aqui, não
                // pra próxima (ver obterProjetoEtapa/loadProjetoEtapasPorNomeEtapa
                // logo acima neste arquivo).
                let subStatusAvanco = 'A PLANEJAR';
                if (proximaEtapaGlobal.fase === 'UAT' || proximaEtapaGlobal.fase === 'GOLIVE') {
                    const { data: planoHerdado } = await _supabase.from('projeto_etapas').select('id').eq('projeto_codigo', codigoProjeto).eq('etapa_id', proximaEtapaGlobal.id).maybeSingle();
                    if (planoHerdado) subStatusAvanco = 'A RATIFICAR';
                }
                payloadAvanco = {
                    etapa_atual: proximaEtapaGlobal.fase,
                    sub_status: subStatusAvanco
                };
            }
            const { error: errorAvanco } = await _supabase.from('projetos').update(payloadAvanco).eq('codigo', codigoProjeto);
            if (errorAvanco) {
                console.error('Erro ao avançar o projeto para a próxima fase:', errorAvanco.message);
            } else {
                const proj = projectsData.find(p => p.codigo === codigoProjeto);
                if (proj) Object.assign(proj, payloadAvanco);
            }
        }
    }

    // NOVO (item 1, novos ajustes): disparo de e-mail — pontos 17/19/21
    // ("Após finalizar Execution/UAT/Go-Live"). Mapa explícito (não
    // transformação de string) pra bater exatamente com o texto
    // semeado em email_fluxo — "EXECUTAR (EXECUTION)" vira "Execution"
    // com só a inicial maiúscula, não "EXECUTION" todo em caixa alta.
    const LABEL_FINALIZAR_ETAPA = {
        'EXECUTAR (EXECUTION)': 'Execution',
        'EXECUTAR (UAT)': 'UAT',
        'EXECUTAR (GO-LIVE)': 'Go-Live'
    };
    if (percentual === 100 && LABEL_FINALIZAR_ETAPA[etapa.etapa]) {
        const quandoDisparaFinalizar = `Após finalizar ${LABEL_FINALIZAR_ETAPA[etapa.etapa]} (100% de execução)`;
        const projFinalizado = projectsData.find(pr => pr.codigo === codigoProjeto);
        const peFinalizado = obterProjetoEtapa(codigoProjeto, etapa.etapa);
        await dispararEmailFluxo(etapa.fase, etapa.etapa, quandoDisparaFinalizar, projFinalizado, {
            responsavelNome: peFinalizado ? peFinalizado.responsavel_etapa_nome : null,
            responsavelEmail: peFinalizado ? peFinalizado.responsavel_etapa_email : null
        });
    }

    // NOVO (a pedido do usuário): disparo de e-mail — Business Case /
    // Realizar Orçamento (tela "Registro de Evolução") / "Ao registrar
    // 100%". Ponto separado do LABEL_FINALIZAR_ETAPA acima porque o
    // texto de "quando dispara" é diferente (não segue o mesmo padrão
    // "Após finalizar X").
    if (percentual === 100 && etapa.etapa === 'REALIZAR ORÇAMENTO') {
        const projOrcamento = projectsData.find(pr => pr.codigo === codigoProjeto);
        const peOrcamento = obterProjetoEtapa(codigoProjeto, etapa.etapa);
        await dispararEmailFluxo(etapa.fase, etapa.etapa, 'Ao registrar 100%', projOrcamento, {
            responsavelNome: peOrcamento ? peOrcamento.responsavel_etapa_nome : null,
            responsavelEmail: peOrcamento ? peOrcamento.responsavel_etapa_email : null
        });
    }

    alert(percentual === 100 ? '✅ Etapa concluída com sucesso!' : '✅ Evolução registrada!');
    fecharModalEvolucaoGenerico();
    if (callbackAtualizarViewGenerica) await callbackAtualizarViewGenerica();
}
