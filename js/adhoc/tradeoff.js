// =========================================================================
// adhoc/tradeoff.js
// Fluxo de Projetos Extraordinário: simulação de impacto no orçamento do AF e
// trade-off (colocar outros projetos em HOLD/Cancelar para liberar verba)
// antes de aprovar a inclusão do projeto ad-hoc.
//
// projetoSimuladoAtual e alteracoesSimulacao são estado local deste fluxo
// de simulação (não vivem em core/state.js porque são específicos desta
// tela, não do sistema como um todo).
//
// GAP CORRIGIDO 10/08/2026 (Especificacao_Workflow_v4.md, seção 6):
// aprovarSimulacaoAdhoc() agora persiste no Supabase — antes só mudava
// projectsData em memória, e um F5 perdia a aprovação inteira. Também
// adiciona: log de quem/quando/observação nos projetos afetados pelo
// trade-off, e um registro de auditoria da rodada de aprovação inteira
// em adhoc_aprovacoes. Saldo negativo continua como ALERTA (visual,
// confirmação extra), não bloqueio — decisão faseada, ver
// Especificacao_Workflow_v4.md, seção 14 (tela de alçada é trabalho
// futuro, ainda sem especificação).
// =========================================================================

let projetoSimuladoAtual = null;
let alteracoesSimulacao = {};
// NOVO (a pedido do usuário 24/08/2026): valor digitado por projeto
// quando a ação escolhida é CEDER_PARTE — ceder só uma fração do saldo
// disponível em vez do saldo inteiro (HOLD/CANCELAR continuam sendo
// tudo-ou-nada). Teto de cada valor = calcularValorCarryover(proj), a
// mesma fórmula que já garante "não ficar abaixo do já gasto".
let valoresParciaisSimulacao = {};
let ultimoSaldoSimulado = 0; // guarda o último saldo calculado, para aprovarSimulacaoAdhoc checar sem recalcular
let ultimoVal1OrcamentoAF = 0; // item 1 da validação — guardado pra usar no log de aprovação
let simulacaoValida = false; // item 8: situação (item5) <= orçamento do AF (item1)?

// NOVO (Feature 1.1 — 03/09/2026): true quando o modo de controle
// orçamentário é AREA/PRODUTO e a simulação atual inclui pelo menos um
// projeto (ação != MANTER) de OUTRO subgrupo que o do projeto
// extraordinário. Nesse caso, aprovar NÃO aplica na hora — grava uma
// pendência em tradeoff_validacao_pendencias, validada na tela
// "Validação de Trade-off Extraordinário" (js/ano-fiscal/validacao-tradeoff.js).
let simulacaoForaDeEscopo = false;

// Modo que rege a elegibilidade do trade-off — vem do parâmetro persistido
// "Controle Orçamentário" (js/config/controle-orcamento.js), NÃO do seletor
// de agrupamento das telas de Dashboard/Financeiro.
function modoTradeoff() {
    return (typeof modoControleOrcamentoAtivo === 'function') ? modoControleOrcamentoAtivo() : 'AF';
}

// Um projeto candidato está no mesmo subgrupo do projeto extraordinário
// simulado? (modo 'AF' => sempre true.)
function tradeoffMesmoSubgrupo(projCandidato) {
    const modo = modoTradeoff();
    if (modo === 'AF' || !projetoSimuladoAtual || !projCandidato) return true;
    return (typeof mesmoSubgrupoOrcamento === 'function')
        ? mesmoSubgrupoOrcamento(projCandidato, projetoSimuladoAtual, modo)
        : true;
}

// Recalcula simulacaoForaDeEscopo a partir do estado atual da simulação e
// atualiza o aviso não-bloqueante na tela.
function recomputarForaDeEscopoTradeoff() {
    simulacaoForaDeEscopo = false;
    if (modoTradeoff() !== 'AF') {
        simulacaoForaDeEscopo = Object.keys(alteracoesSimulacao).some(codigo => {
            if (alteracoesSimulacao[codigo] === 'MANTER') return false;
            const proj = projectsData.find(p => p.codigo === codigo);
            return proj && !tradeoffMesmoSubgrupo(proj);
        });
    }
    const aviso = document.getElementById('adhocAvisoForaEscopo');
    if (aviso) {
        aviso.classList.toggle('hidden', !simulacaoForaDeEscopo);
        if (simulacaoForaDeEscopo) {
            const rot = modoTradeoff() === 'AREA' ? 'área' : 'produto';
            aviso.innerHTML = `⚠️ Esta simulação inclui projeto(s) de <b>outro ${rot}</b> que o do projeto extraordinário. Ao aprovar, a simulação vai para a fila de <b>Validação de Trade-off Extraordinário</b> (menu Ano Fiscal) e só produz efeito depois de aprovada lá.`;
        }
    }
}

// CORRIGIDO (higiene de nomenclatura): rótulo "AD-HOC" era resíduo do
// nome antigo da funcionalidade — o resto do sistema chama de
// "Extraordinário" desde a padronização de telas.
function renderAdhocBadge(projeto) {
    if (projeto.is_adhoc || projeto.tipo === 'ADHOC') {
        return `<span class="bg-red-100 text-red-700 font-bold text-[9px] px-1.5 py-0.5 rounded ml-1 border border-red-200">EXTRAORDINÁRIO</span>`;
    }
    return '';
}

// CORRIGIDO (bug reportado 02/09/2026): as Demandas Extraordinárias são
// registradas contra o Ano Fiscal EM ANDAMENTO (orçamento já fechado),
// não contra o AF calculado pela data do dia. Todo este fluxo passa a
// mirar afEmAndamentoStr() (js/core/filtro-af-visao.js), com a data só
// como último recurso — antes o trade-off ficava vazio porque filtrava
// pelo AF errado.
function afAlvoExtraordinaria() {
    const s = (typeof afEmAndamentoStr === 'function') ? afEmAndamentoStr() : null;
    if (s) return s;
    const info = (typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal() : null;
    return info ? info.afAtualStr : null;
}

// CORRIGIDO (bug reportado 02/09/2026): a Demanda Extraordinária não passa
// mais pelo Comitê (ver js/approvals/comite.js), então depois de
// "Orçamentar Demanda" ela fica em 'ORÇAMENTO REALIZADO' — e não em
// 'APROVADO'. Este fluxo passa a aceitar as duas situações como
// "aguardando inclusão via trade-off".
function subStatusAguardandoTradeoff(sub) {
    const s = (sub || '').toUpperCase();
    return s === 'ORÇAMENTO REALIZADO' || s === 'APROVADO';
}

async function renderAdhocView() {
    // NOVO (item 7): pré-carrega as autorizações especiais de ajuste de
    // orçamento pra o check de subgrupo no trade-off (alterarAcaoTradeoff).
    if (typeof carregarAutorizacoesAjuste === 'function') carregarAutorizacoesAjuste();
    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista();
    const afAlvo = afAlvoExtraordinaria();

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário): usava p.status
    // (campo errado — quase sempre 'EM ANDAMENTO', nunca refletia
    // cancelamento/reprovação de verdade) e não excluía REPROVADO —
    // projetos reprovados no Comitê estavam contando pro "orçamento
    // aprovado" do AF. Também separa demandas Extraordinárias já aprovadas
    // individualmente mas ainda não incluídas via trade-off — não devem
    // se misturar ao valor pré-existente do AF até serem de fato
    // incluídas.
    const projetosAF = projectsData.filter(p => {
        const sub = (p.sub_status || '').toUpperCase();
        if (p.ano_fiscal !== afAlvo) return false;
        if (sub === 'CANCELADO' || sub === 'REPROVADO') return false;
        if (p.is_adhoc && p.etapa_atual === 'BUSINESS CASE') return false; // ainda não incluído via trade-off
        return true;
    });

    let totalAprovado = 0, totalReq = 0, totalTech = 0, totalRealizado = 0;

    projetosAF.forEach(p => {
        const sub = (p.sub_status || '').toUpperCase();
        if (sub !== 'HOLD') {
            totalAprovado += Number(p.val_bc || p.previsto || 0);
            totalReq += Number(p.val_req || p.val_bc || 0);
            totalTech += Number(p.val_tech || p.val_req || 0);
            totalRealizado += Number(p.realizado || 0);
        }
    });

    // Valor das demandas Extraordinárias já com orçamento realizado e
    // aguardando inclusão via trade-off — mostrado separado do orçamento
    // pré-existente (item 3b do relatado).
    const projsAdhocPendenteInclusao = projectsData.filter(p =>
        p.is_adhoc && p.etapa_atual === 'BUSINESS CASE' &&
        subStatusAguardandoTradeoff(p.sub_status) &&
        p.ano_fiscal === afAlvo
    );
    const totalAdhocPendente = projsAdhocPendenteInclusao.reduce((acc, p) => acc + Number(p.val_bc || p.previsto || 0), 0);

    const saldoRemanescente = totalAprovado - totalRealizado;

    document.getElementById('adhocKpiAprovado').innerText = formatCurrency(totalAprovado);
    document.getElementById('adhocKpiReq').innerText = formatCurrency(totalReq);
    document.getElementById('adhocKpiTech').innerText = formatCurrency(totalTech);
    document.getElementById('adhocKpiRealizado').innerText = formatCurrency(totalRealizado);
    document.getElementById('adhocKpiSaldo').innerText = formatCurrency(saldoRemanescente);
    const elAdhocPendente = document.getElementById('adhocKpiPendenteInclusao');
    if (elAdhocPendente) elAdhocPendente.innerText = formatCurrency(totalAdhocPendente);

    // NOVO 10/08/2026 (item 5-a do relatório de testes): lista clicável
    // em vez de combo — mostra todos os projetos Extraordinário disponíveis de
    // uma vez, marcando o selecionado, em vez de precisar abrir/escolher
    // um select e depois clicar em "Carregar".
    renderListaAdhocPendentes(projsAdhocPendenteInclusao);

    document.getElementById('adhocSimulacaoPanel').classList.add('hidden');
    projetoSimuladoAtual = null;
    alteracoesSimulacao = {};
    valoresParciaisSimulacao = {};
    simulacaoForaDeEscopo = false;
    const avisoFE = document.getElementById('adhocAvisoForaEscopo');
    if (avisoFE) avisoFE.classList.add('hidden');
}

// Renderiza só a lista clicável de demandas Extraordinárias, sem mexer no resto
// do estado da tela — chamada tanto pelo renderAdhocView (carga
// inicial) quanto pelo carregarSimulacaoAdhoc (só pra atualizar qual
// linha aparece marcada como "Selecionado", sem resetar a simulação
// que acabou de ser montada).
function renderListaAdhocPendentes(lista) {
    const listaContainer = document.getElementById('adhocListaDemandasBody');
    if (!listaContainer) return;

    if (lista.length === 0) {
        listaContainer.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">Nenhuma demanda Extraordinária aguardando avaliação no momento</div>`;
        return;
    }

    listaContainer.innerHTML = lista.map(p => {
        const selecionado = projetoSimuladoAtual && projetoSimuladoAtual.codigo === p.codigo;
        return `
            <button onclick="carregarSimulacaoAdhoc('${p.codigo}')" class="w-full text-left p-3 rounded-lg border-2 transition ${selecionado ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-mono font-bold text-red-700">${p.codigo}</span>
                        <span class="font-semibold text-gray-800 ml-2">${escapeHtml(p.nome)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-amber-700">${formatCurrency(p.val_bc || p.previsto || 0)}</span>
                        ${selecionado ? '<span class="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Selecionado</span>' : ''}
                    </div>
                </div>
            </button>
        `;
    }).join('');
}

function carregarSimulacaoAdhoc(codigo) {
    if (!codigo) {
        alert('Selecione uma demanda Extraordinária para simular.');
        return;
    }

    projetoSimuladoAtual = projectsData.find(p => p.codigo === codigo);
    if (!projetoSimuladoAtual) return;

    document.getElementById('simulandoProjetoNome').innerText = `${projetoSimuladoAtual.codigo} - ${projetoSimuladoAtual.nome}`;

    document.getElementById('adhocSimulacaoPanel').classList.remove('hidden');

    // Reconstrói a mesma lista de pendentes só pra atualizar o destaque
    // visual de "Selecionado" — sem chamar renderAdhocView() inteiro,
    // que resetaria projetoSimuladoAtual de volta pra null.
    const pendentesAtualizados = projectsData.filter(p =>
        p.is_adhoc && p.etapa_atual === 'BUSINESS CASE' &&
        subStatusAguardandoTradeoff(p.sub_status) &&
        p.ano_fiscal === afAlvoExtraordinaria()
    );
    renderListaAdhocPendentes(pendentesAtualizados);

    renderTradeoffTable();
    recalcularSaldoSimulado();
}

// Calcula a posição de uma fase na sequência do workflow (menor "ordem"
// entre as etapas cadastradas para essa fase), usada para ordenar a
// lista de trade-off por fase/etapa (Especificacao_Workflow_v4.md,
// seção 6 — G15). Trata os dois nomes que a fase de Go-Live usa hoje
// ("GO LIVE" em projetos.etapa_atual vs "GOLIVE" em fases_etapas.fase —
// inconsistência pré-existente no seed, não introduzida aqui).
function obterOrdemDaFase(nomeFaseProjeto) {
    const nome = (nomeFaseProjeto || 'BUSINESS CASE').toUpperCase();
    const aliases = { 'GO LIVE': 'GOLIVE', 'CONCLUIDO': 'GOLIVE', 'REQUIREMENTS': 'REQUERIMENTS' };
    const nomeFaseCanonico = aliases[nome] || nome;
    const etapasDaFase = fasesEtapasData.filter(e => e.fase === nomeFaseCanonico && e.ativo !== false);
    if (etapasDaFase.length === 0) return 999; // fase não reconhecida: manda pro final da lista
    return Math.min(...etapasDaFase.map(e => e.ordem));
}

function renderTradeoffTable() {
    const tbody = document.getElementById('adhocTradeoffTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const afAlvo = afAlvoExtraordinaria();
    // CORRIGIDO 10/08/2026 (bug reportado, item 8): trazia TODOS os
    // projetos, inclusive quem ainda estava em Business Case sem
    // orçamento aprovado (inclusive outros Extraordinário pendentes). Só devem
    // aparecer projetos que já passaram por Business Case com orçamento
    // aprovado — mesma regra usada na Visão de Orçamento.
    const projetosTradeoff = projectsData
        .filter(p => {
            if (p.ano_fiscal !== afAlvo) return false;
            if (p.codigo === projetoSimuladoAtual.codigo) return false;
            const sub = (p.sub_status || '').toUpperCase();
            if (sub === 'CANCELADO' || sub === 'REPROVADO') return false;
            // CORRIGIDO (divergência encontrada 24/08/2026): um projeto já
            // em HOLD continuava aparecendo como candidato — como colocar
            // em HOLD não reduz o valor orçado (só muda sub_status), o
            // mesmo saldo cheio ficava disponível pra ser "liberado" de
            // novo numa rodada futura, contando o mesmo dinheiro duas
            // vezes. Já deu tudo que tinha; se for retomado depois (nova
            // tela "Retomar Projetos em Hold"), volta a ser candidato
            // normalmente, com o saldo que sobrou.
            if (sub === 'HOLD') return false;
            // NOVO (a pedido do usuário 25/08/2026 — bug reportado): projeto
            // já concluído não pode ter o orçamento mexido num trade-off —
            // some da lista de candidatos, igual já acontece em outras
            // telas (ex.: Consolidação por Fase, Financeiro).
            if (p.projeto_concluido === true) return false;
            const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
            if (etapa === 'BUSINESS CASE' && sub !== 'APROVADO') return false;
            return true;
        })
        .sort((a, b) => obterOrdemDaFase(a.etapa_atual) - obterOrdemDaFase(b.etapa_atual));

    if (projetosTradeoff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">Nenhum outro projeto com orçamento aprovado disponível para trade-off.</td></tr>`;
        return;
    }

    const linhaTradeoffHtml = (p) => {
        const acaoAtual = alteracoesSimulacao[p.codigo] || 'MANTER';
        const valorOrc = Number(p.val_tech || p.val_req || p.val_bc || p.previsto || 0);
        const saldoDisponivel = calcularValorCarryover(p); // mesma fórmula: orçado - realizado
        const valorParcialAtual = valoresParciaisSimulacao[p.codigo] || '';
        return `
            <tr>
                <td class="p-3 font-mono font-bold">${p.codigo}</td>
                <td class="p-3 font-semibold text-gray-800">${escapeHtml(p.nome)} ${renderAdhocBadge(p)}</td>
                <td class="p-3">${p.etapa_atual || 'BUSINESS CASE'}</td>
                <td class="p-3 text-right font-mono">${formatCurrency(valorOrc)}</td>
                <td class="p-3 text-right font-mono text-green-700">${formatCurrency(saldoDisponivel)}</td>
                <td class="p-3 text-center">
                    <select onchange="alterarAcaoTradeoff('${p.codigo}', this.value)" class="p-1 border border-gray-300 rounded text-xs bg-white font-bold">
                        <option value="MANTER" ${acaoAtual === 'MANTER' ? 'selected' : ''}>Manter no Portfólio</option>
                        <option value="HOLD" ${acaoAtual === 'HOLD' ? 'selected' : ''}>Colocar em HOLD (- Verba)</option>
                        <option value="CANCELAR" ${acaoAtual === 'CANCELAR' ? 'selected' : ''}>Cancelar (- Verba)</option>
                        <option value="CEDER_PARTE" ${acaoAtual === 'CEDER_PARTE' ? 'selected' : ''}>Ceder Parte do Saldo</option>
                    </select>
                    ${acaoAtual === 'CEDER_PARTE' ? `
                        <div class="mt-1">
                            <input type="number" step="0.01" min="0.01" max="${saldoDisponivel}" value="${valorParcialAtual}"
                                   placeholder="Valor a ceder (máx. ${formatCurrency(saldoDisponivel)})"
                                   oninput="alterarValorParcialTradeoff('${p.codigo}', this.value)"
                                   class="w-full p-1 border border-amber-300 rounded text-xs">
                        </div>
                    ` : ''}
                </td>
            </tr>`;
    };

    // NOVO (Feature 1.1): com o modo de controle = Área/Produto, separa os
    // candidatos em "mesmo subgrupo" e "outro subgrupo (requer validação)".
    // Não remove os de fora — só sinaliza; escolher uma ação num deles manda
    // a simulação para a fila de Validação de Trade-off Extraordinário.
    const modo = modoTradeoff();
    if (modo === 'AF') {
        tbody.innerHTML = projetosTradeoff.map(linhaTradeoffHtml).join('');
    } else {
        const rot = modo === 'AREA' ? 'área' : 'produto';
        const dentro = projetosTradeoff.filter(p => tradeoffMesmoSubgrupo(p));
        const fora = projetosTradeoff.filter(p => !tradeoffMesmoSubgrupo(p));
        const divisor = (txt, cls) => `<tr class="${cls}"><td colspan="6" class="p-2 text-[10px] font-bold uppercase tracking-wider">${txt}</td></tr>`;
        let html = '';
        html += divisor(`Mesmo ${rot} do projeto extraordinário`, 'bg-emerald-50 text-emerald-800');
        html += dentro.length ? dentro.map(linhaTradeoffHtml).join('') : `<tr><td colspan="6" class="p-3 text-center text-gray-400 text-xs">Nenhum projeto no mesmo ${rot}.</td></tr>`;
        if (fora.length) {
            html += divisor(`Outro ${rot} — ao usar, a simulação vai para validação`, 'bg-amber-50 text-amber-800');
            html += fora.map(linhaTradeoffHtml).join('');
        }
        tbody.innerHTML = html;
    }
}

function alterarAcaoTradeoff(codigoProjeto, acao) {
    // AJUSTADO (Feature 1.1 — 03/09/2026): o bloqueio "só mesmo subgrupo"
    // deixou de ser um alerta que impedia a escolha. Agora escolher uma
    // ação num projeto de OUTRO subgrupo é permitido — a simulação inteira
    // passa a exigir aprovação em "Validação de Trade-off Extraordinário"
    // (sinalizado por recomputarForaDeEscopoTradeoff, chamado dentro de
    // recalcularSaldoSimulado). O modo vem do parâmetro persistido
    // "Controle Orçamentário", não mais do seletor de agrupamento das telas.
    alteracoesSimulacao[codigoProjeto] = acao;
    if (acao !== 'CEDER_PARTE') delete valoresParciaisSimulacao[codigoProjeto];
    // AJUSTADO (a pedido do usuário 24/08/2026): precisa re-renderizar a
    // linha pra mostrar/esconder o campo de valor parcial assim que a
    // ação muda pra/de CEDER_PARTE — antes só recalculava o saldo.
    renderTradeoffTable();
    recalcularSaldoSimulado();
}

// NOVO (a pedido do usuário 24/08/2026): valor digitado quando a ação é
// CEDER_PARTE — ceder só parte do saldo, mantendo o projeto ativo. O
// teto (não deixar o restante do orçamento abaixo do já gasto) é
// aplicado em recalcularSaldoSimulado/aprovarSimulacaoAdhoc, não aqui —
// aqui só guarda o que foi digitado pra recalcular ao vivo.
function alterarValorParcialTradeoff(codigoProjeto, valor) {
    valoresParciaisSimulacao[codigoProjeto] = parseFloat(valor);
    recalcularSaldoSimulado();
}

// NOVO 10/08/2026 (item 8 do relatório de testes): calcula os 5 valores
// exatos pedidos pra validar a simulação, e bloqueia a aprovação de
// verdade se a regra não for satisfeita (antes era só um alerta
// contornável — agora é uma regra de negócio explícita e obrigatória).
function recalcularSaldoSimulado() {
    const afAlvo = afAlvoExtraordinaria();

    // 1. Valor do orçamento do ano fiscal (o total já aprovado,
    // pré-existente — mesmo valor mostrado no KPI principal da tela).
    const projetosAF = projectsData.filter(p => {
        const sub = (p.sub_status || '').toUpperCase();
        if (p.ano_fiscal !== afAlvo) return false;
        if (sub === 'CANCELADO' || sub === 'REPROVADO') return false;
        if (p.is_adhoc && p.etapa_atual === 'BUSINESS CASE') return false;
        return true;
    });
    const val1OrcamentoAF = projetosAF
        .filter(p => (p.sub_status || '').toUpperCase() !== 'HOLD')
        .reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);

    // 2. Valor orçado para o projeto Extraordinário sendo simulado.
    const val2OrcadoProjeto = Number(projetoSimuladoAtual.val_bc || projetoSimuladoAtual.previsto || 0);

    // 3. Novo valor do AF, somando o Extraordinário.
    const val3NovoValorAF = val1OrcamentoAF + val2OrcadoProjeto;

    // 4. Soma do SALDO (não o valor orçado total — o saldo ainda a
    // consumir) de cada projeto marcado como HOLD ou CANCELAR (saldo
    // INTEIRO) ou CEDER_PARTE (só o valor digitado, limitado ao saldo —
    // AJUSTADO 24/08/2026, item 3 do pedido). Valor parcial inválido/
    // vazio/acima do teto conta como 0 — não libera nada até o usuário
    // corrigir, e a validação de baixo sinaliza que falta liberar mais.
    let val4SaldoLiberado = 0;
    Object.keys(alteracoesSimulacao).forEach(codigo => {
        const acao = alteracoesSimulacao[codigo];
        const proj = projectsData.find(p => p.codigo === codigo);
        if (!proj) return;
        if (acao === 'HOLD' || acao === 'CANCELAR') {
            val4SaldoLiberado += calcularValorCarryover(proj);
        } else if (acao === 'CEDER_PARTE') {
            const saldoMax = calcularValorCarryover(proj);
            const valorDigitado = Number(valoresParciaisSimulacao[codigo]) || 0;
            val4SaldoLiberado += Math.max(0, Math.min(valorDigitado, saldoMax));
        }
    });

    // 5. Situação final: novo valor menos o saldo liberado.
    const val5Situacao = val3NovoValorAF - val4SaldoLiberado;

    ultimoSaldoSimulado = val5Situacao;
    ultimoVal1OrcamentoAF = val1OrcamentoAF;
    simulacaoValida = val5Situacao <= val1OrcamentoAF;

    const setTexto = (id, valor) => { const el = document.getElementById(id); if (el) el.innerText = formatCurrency(valor); };
    setTexto('simVal1OrcamentoAF', val1OrcamentoAF);
    setTexto('simVal2OrcadoProjeto', val2OrcadoProjeto);
    setTexto('simVal3NovoValorAF', val3NovoValorAF);
    setTexto('simVal4SaldoLiberado', val4SaldoLiberado);
    setTexto('simVal5Situacao', val5Situacao);

    const elVal5 = document.getElementById('simVal5Situacao');
    const elVal5Wrapper = document.getElementById('simVal5Wrapper');
    const elMsg = document.getElementById('simValidacaoMsg');
    const elBtnAprovar = document.getElementById('btnAprovarSimulacaoAdhoc');

    if (elVal5) elVal5.className = simulacaoValida ? 'text-sm font-black text-green-700' : 'text-sm font-black text-red-700';
    if (elVal5Wrapper) elVal5Wrapper.className = `bg-white rounded p-2 border-2 ${simulacaoValida ? 'border-green-400' : 'border-red-400'}`;
    if (elMsg) {
        elMsg.className = `text-xs font-bold mt-3 ${simulacaoValida ? 'text-green-700' : 'text-red-700'}`;
        elMsg.innerText = simulacaoValida
            ? '✅ Situação do AF dentro do orçamento aprovado — simulação pode ser aprovada.'
            : `⛔ Situação do AF (${formatCurrency(val5Situacao)}) excede o orçamento aprovado (${formatCurrency(val1OrcamentoAF)}) — marque mais projetos em HOLD/Cancelar/Ceder Parte para liberar saldo suficiente antes de aprovar.`;
    }
    if (elBtnAprovar) {
        elBtnAprovar.disabled = !simulacaoValida;
        elBtnAprovar.className = simulacaoValida
            ? 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold shadow-sm transition'
            : 'px-4 py-2 bg-gray-300 text-gray-500 rounded text-xs font-bold shadow-sm cursor-not-allowed';
    }

    // NOVO (Feature 1.1): re-avalia se a simulação cruza subgrupos e
    // atualiza o aviso não-bloqueante.
    recomputarForaDeEscopoTradeoff();
}

function cancelarSimulacaoAdhoc() {
    document.getElementById('adhocSimulacaoPanel').classList.add('hidden');
    projetoSimuladoAtual = null;
    alteracoesSimulacao = {};
    valoresParciaisSimulacao = {};
    simulacaoForaDeEscopo = false;
    const avisoFE = document.getElementById('adhocAvisoForaEscopo');
    if (avisoFE) avisoFE.classList.add('hidden');
}

// Serializa o estado atual da simulação em [{codigo, acao, valorParcial}]
// (só as linhas com ação != MANTER) — usado tanto pela aprovação direta
// quanto pela gravação de pendência de validação.
function _serializarDecisoesTradeoff() {
    return Object.keys(alteracoesSimulacao)
        .filter(codigo => alteracoesSimulacao[codigo] !== 'MANTER')
        .map(codigo => ({
            codigo,
            acao: alteracoesSimulacao[codigo],
            valorParcial: alteracoesSimulacao[codigo] === 'CEDER_PARTE' ? (Number(valoresParciaisSimulacao[codigo]) || 0) : null
        }));
}

// NOVO (Feature 1.1 — 03/09/2026): aplica de fato uma rodada de trade-off
// já aprovada. Extraído do corpo de aprovarSimulacaoAdhoc pra ser
// reaproveitado pela tela "Validação de Trade-off Extraordinário"
// (js/ano-fiscal/validacao-tradeoff.js). `decisoes` = [{codigo, acao,
// valorParcial}]. `opts` = { saldoResultante, aprovadoPor }.
// Retorna true em caso de sucesso; false (após alert) em erro de gravação.
async function aplicarTradeoffAprovado(projetoAdhoc, decisoes, opts) {
    opts = opts || {};
    const agora = new Date().toISOString();
    const responsavel = opts.aprovadoPor || (currentUser ? currentUser.nome : 'desconhecido');
    const projetosAfetadosLog = [];
    let valorLiberadoTotal = 0;

    for (const d of (decisoes || [])) {
        const acao = d.acao;
        const proj = projectsData.find(p => p.codigo === d.codigo);
        if (!proj || acao === 'MANTER') continue;

        if (acao === 'CEDER_PARTE') {
            // Reconfere valor e teto de saldo (o estado pode ter mudado
            // entre a simulação e a aplicação).
            const saldoMax = calcularValorCarryover(proj);
            const valorCedido = Number(d.valorParcial) || 0;
            if (valorCedido <= 0 || valorCedido > saldoMax) {
                console.warn(`Cessão parcial de ${d.codigo} ignorada: valor inválido (${valorCedido}), teto ${saldoMax}.`);
                continue;
            }
            const campoOrcamento = proj.val_tech ? 'val_tech' : proj.val_req ? 'val_req' : proj.val_bc ? 'val_bc' : 'previsto';
            const valorAntes = Number(proj[campoOrcamento]) || 0;
            const valorDepois = valorAntes - valorCedido;
            const observacao = `Cedeu ${formatCurrency(valorCedido)} (parcial) via trade-off Extraordinário, ` +
                `para: ${projetoAdhoc.codigo} - ${projetoAdhoc.nome}`;
            const payload = { [campoOrcamento]: valorDepois, tradeoff_por: responsavel, tradeoff_em: agora, tradeoff_observacao: observacao };
            const { error } = await _supabase.from('projetos').update(payload).eq('codigo', d.codigo);
            if (error) { alert(`Erro ao gravar a cessão parcial do projeto ${d.codigo}: ` + error.message); return false; }
            Object.assign(proj, payload);
            valorLiberadoTotal += valorCedido;
            projetosAfetadosLog.push({ codigo: d.codigo, nome: proj.nome, acao: 'CEDER_PARTE', saldo_liberado: valorCedido, campo_orcamento: campoOrcamento, valor_antes: valorAntes, valor_depois: valorDepois });
            continue;
        }

        const novoSubStatus = acao === 'CANCELAR' ? 'CANCELADO' : 'HOLD';
        const saldoLiberadoProjeto = calcularValorCarryover(proj);
        valorLiberadoTotal += saldoLiberadoProjeto;
        const observacao = `${acao === 'CANCELAR' ? 'Cancelado' : 'Colocado em HOLD'} via trade-off Extraordinário, ` +
            `substituído por: ${projetoAdhoc.codigo} - ${projetoAdhoc.nome}`;
        const payload = {
            sub_status: novoSubStatus,
            sub_status_antes_hold: acao === 'HOLD' ? proj.sub_status : proj.sub_status_antes_hold,
            tradeoff_por: responsavel,
            tradeoff_em: agora,
            tradeoff_observacao: observacao
        };
        const { error } = await _supabase.from('projetos').update(payload).eq('codigo', d.codigo);
        if (error) { alert(`Erro ao gravar o trade-off do projeto ${d.codigo}: ` + error.message); return false; }
        Object.assign(proj, payload);
        projetosAfetadosLog.push({ codigo: d.codigo, nome: proj.nome, acao: novoSubStatus, saldo_liberado: saldoLiberadoProjeto });
    }

    // Promoção do projeto Extraordinário para Requerimentos.
    const dtInicioReq = new Date().toISOString().split('T')[0];
    const dtTerminoReq = somarDiasUteis(dtInicioReq, 10);
    const custoAdhoc = Number(projetoAdhoc.val_bc || projetoAdhoc.previsto || 0);
    const payloadAdhoc = { sub_status: 'APROVADO', etapa_atual: 'REQUIREMENTS', data_solicitacao_req: dtInicioReq, dt_limite_req: dtTerminoReq };
    const { error: errorAdhoc } = await _supabase.from('projetos').update(payloadAdhoc).eq('codigo', projetoAdhoc.codigo);
    if (errorAdhoc) { alert('Erro ao aprovar o projeto Extraordinário: ' + errorAdhoc.message); return false; }
    Object.assign(projetoAdhoc, payloadAdhoc);

    const { error: errorLog } = await _supabase.from('adhoc_aprovacoes').insert([{
        projeto_adhoc_codigo: projetoAdhoc.codigo,
        valor_aprovado: custoAdhoc,
        valor_liberado_tradeoff: valorLiberadoTotal,
        saldo_resultante: (opts.saldoResultante !== undefined && opts.saldoResultante !== null) ? opts.saldoResultante : null,
        aprovado_por: responsavel,
        projetos_afetados: projetosAfetadosLog
    }]);
    if (errorLog) console.error('Aprovação Extraordinário concluída, mas houve erro ao gravar o log de auditoria:', errorLog.message);

    await dispararEmailFluxo('BUSINESS CASE', 'APROVAR DEMANDA EXTRAORDINÁRIA', 'Quando aprovar simulação e efetivar demanda', projetoAdhoc, {});
    return true;
}

async function aprovarSimulacaoAdhoc() {
    if (!usuarioPodeAlterarTela('projetos_adhoc')) return alert('Você não tem permissão para aprovar demandas extraordinárias.');
    if (!projetoSimuladoAtual) return;

    // CORRIGIDO 10/08/2026 (item 8 do relatório de testes): item 5 (situação
    // do AF) precisa ser <= item 1 (orçamento original do AF). Sem isso, a
    // simulação não pode ser aprovada.
    if (!simulacaoValida) {
        return alert(`⛔ Esta simulação não pode ser aprovada: a situação do orçamento do AF (${formatCurrency(ultimoSaldoSimulado)}) excede o orçamento aprovado (${formatCurrency(ultimoVal1OrcamentoAF)}).\n\nMarque mais projetos em HOLD/Cancelar pra liberar saldo suficiente antes de tentar de novo.`);
    }

    const decisoes = _serializarDecisoesTradeoff();
    const responsavel = currentUser ? currentUser.nome : 'desconhecido';
    recomputarForaDeEscopoTradeoff();

    // NOVO (Feature 1.1): se a simulação cruza subgrupos (modo Área/Produto),
    // NÃO aplica agora — grava uma pendência de validação. Trade-off 100%
    // dentro do subgrupo (ou modo Ano Fiscal) segue aprovando direto.
    if (simulacaoForaDeEscopo) {
        if (!confirm(`Esta simulação inclui projeto(s) de outro ${modoTradeoff() === 'AREA' ? 'área' : 'produto'}.\n\nAo confirmar, ela vai para a fila de "Validação de Trade-off Extraordinário" (menu Ano Fiscal) e só produz efeito depois de aprovada lá. Continuar?`)) return;
        const { error } = await _supabase.from('tradeoff_validacao_pendencias').insert([{
            projeto_adhoc_codigo: projetoSimuladoAtual.codigo,
            ano_fiscal: projetoSimuladoAtual.ano_fiscal || null,
            modo_controle: modoTradeoff(),
            valor_adhoc: Number(projetoSimuladoAtual.val_bc || projetoSimuladoAtual.previsto || 0),
            saldo_resultante: ultimoSaldoSimulado,
            simulacao: decisoes,
            criado_por: responsavel
        }]);
        if (error) return alert('Erro ao enviar a simulação para validação: ' + error.message);
        alert('✅ Simulação enviada para "Validação de Trade-off Extraordinário" (menu Ano Fiscal). Nada foi aplicado ainda — os efeitos só valem após a aprovação lá.');
        await loadProjects();
        renderAdhocView();
        return;
    }

    if (!confirm(`Confirma a aprovação do projeto Extraordinário ${projetoSimuladoAtual.codigo} e a aplicação dos trade-offs selecionados?`)) return;

    const ok = await aplicarTradeoffAprovado(projetoSimuladoAtual, decisoes, { saldoResultante: ultimoSaldoSimulado, aprovadoPor: responsavel });
    if (!ok) return;

    alert('✅ Simulação aprovada e gravada com sucesso! O projeto Extraordinário foi promovido para a etapa de Planejamento de Requisitos.');
    await loadProjects();
    renderAdhocView();
}
