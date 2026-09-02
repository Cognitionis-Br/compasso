// =========================================================================
// carryover/carryover.js
// Carry Over (G27, lista de ajustes do usuário 10/08/2026):
// - Marcar como carryover só liga uma flag — NÃO muda o ano_fiscal do
//   projeto.
// - Valor calculado automaticamente (não digitado): orçamento definido
//   mais recente (Technical > Requerimentos > Business Case, o que já
//   estiver preenchido) menos o valor já realizado até o momento da
//   marcação.
// - Pode ser feito a qualquer momento (não só no Q4).
// - O projeto continua seguindo o fluxo normal do workflow, só
//   carregando a marca de carryover.
// =========================================================================

// NOVO (bug reportado: permitia marcar Carryover mesmo sem o próximo
// Ano Fiscal aberto) — o projeto Carryover passa a ser avaliado dentro
// do orçamento do AF seguinte, então esse AF precisa já existir em
// algum estado ativo (aberto pra demandas, ou já com orçamento
// fechado) antes de permitir a marcação.
function proximoAnoFiscal(anoFiscalAtual) {
    if (!anoFiscalAtual) return null;
    const numero = parseInt(anoFiscalAtual.replace('AF', ''), 10);
    if (isNaN(numero)) return null;
    return `AF${numero + 1}`;
}

function verificarElegibilidadeCarryover(p, anosFiscaisConfigCache) {
    const proximoAF = proximoAnoFiscal(p.ano_fiscal);
    if (!proximoAF) return { elegivel: false, motivo: 'Projeto sem Ano Fiscal definido.' };

    const configProximo = anosFiscaisConfigCache.find(c => c.ano_fiscal === proximoAF);
    const proximoValido = configProximo && (configProximo.recebimento_demandas_aberto === true || configProximo.orcamento_fechado === true);

    if (!proximoValido) {
        return { elegivel: false, motivo: `O ${proximoAF} ainda não está aberto nem com orçamento fechado — abra-o em Ano Fiscal → Abertura Ano Fiscal antes de marcar Carryover.` };
    }
    return { elegivel: true, motivo: null };
}

// NOVO (a pedido do usuário 25/08/2026): depois de marcado, só pode
// desmarcar Carryover se o projeto ainda não teve nenhum avanço de fase
// ou status desde a marcação — qualquer progresso (etapa_atual ou
// sub_status diferentes do que eram no momento em que foi marcado)
// trava o Desmarcar, porque o saldo congelado (valor_carryover) já
// passou a valer pro AF seguinte e desfazer nesse ponto deixaria a
// contabilização inconsistente. Compara contra o snapshot gravado em
// `carryover_etapa_marcacao`/`carryover_sub_status_marcacao` no momento
// da marcação (ver marcarComoCarryover).
function verificarElegibilidadeDesmarcar(p) {
    const etapaMudou = (p.etapa_atual || 'BUSINESS CASE') !== (p.carryover_etapa_marcacao || 'BUSINESS CASE');
    const subStatusMudou = (p.sub_status || '') !== (p.carryover_sub_status_marcacao || '');
    if (etapaMudou || subStatusMudou) {
        return { elegivel: false, motivo: 'Este projeto já teve avanço de fase/status desde que foi marcado como Carryover — não é mais possível desmarcar.' };
    }
    return { elegivel: true, motivo: null };
}

function calcularValorCarryover(p) {
    const orcamentoDefinido = Number(p.val_tech || p.val_req || p.val_bc || p.previsto || 0);
    const realizado = Number(p.realizado || 0);
    return Math.max(0, orcamentoDefinido - realizado);
}

// NOVO (a pedido do usuário 24/08/2026): pool de orçamento carryover por
// AF de destino — soma o valor JÁ CONGELADO em cada projeto no momento
// da marcação (valor_carryover), de propósito, não o saldo recalculado
// hoje. Decisão explícita do usuário: o impacto no orçamento do AF de
// destino é fixo a partir da marcação, não deve se mexer sozinho se o
// projeto continuar consumindo orçamento depois. Isso SÓ deve mudar
// quando existir um ledger de uso incremental de orçamento (ainda não
// desenhado) — nesse momento, revisitar aqui (e só aqui) se o pool passa
// a precisar reconciliar com consumo real ao longo do tempo.
function calcularPoolCarryover(anoFiscalDestino) {
    const projs = projectsData.filter(p => p.is_carryover === true && proximoAnoFiscal(p.ano_fiscal) === anoFiscalDestino);
    const capexOpex = calcularCapexOpex(projs, (p) => Number(p.valor_carryover) || 0);
    const total = projs.reduce((acc, p) => acc + (Number(p.valor_carryover) || 0), 0);
    return { total, capex: capexOpex.capex.orcado, opex: capexOpex.opex.orcado, qtd: projs.length };
}

// NOVO (a pedido do usuário 24/08/2026): elegibilidade de NOVOS
// candidatos a Carryover — antes era só "não cancelado/reprovado"
// (praticamente qualquer projeto). Regra real: ainda dentro do AF atual,
// já com orçamento aprovado (passou do Business Case) e ainda não
// terminando este AF. Sem campo de data prevista de conclusão no
// sistema, "não vai terminar este AF" é aproximado por "ainda não
// chegou em Go-Live/Concluído" — mesma aproximação usada em outras
// telas pra "projeto ainda ativo".
function elegivelComoNovoCandidatoCarryover(p, afAtualStr) {
    if (p.is_carryover === true) return false; // já tratado separadamente
    if (p.is_subprojeto === true) return false;
    if (p.projeto_concluido === true) return false;
    const sub = (p.sub_status || '').toUpperCase();
    if (['CANCELADO', 'REPROVADO', 'HOLD'].includes(sub)) return false;
    if (p.ano_fiscal !== afAtualStr) return false;
    const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
    if (['BUSINESS CASE', 'GOLIVE', 'GO LIVE', 'CONCLUIDO'].includes(etapa)) return false;
    return true;
}

// NOVO (a pedido do usuário 2026-09-02): projeto de um Ano Fiscal ANTERIOR
// ao corrente que ainda não terminou é candidato natural a Carryover — o AF
// dele já virou, então ou o saldo é levado pro próximo AF, ou o projeto é
// cancelado. Não tem trava de Q4 (o Q4 só faz sentido pra "descobrir" novos
// candidatos do AF que ainda está correndo). Go-Live aqui NÃO exclui — um
// projeto de AF passado ainda em Go-Live é exatamente o caso a tratar.
function elegivelComoCandidatoCarryoverAFAnterior(p, afAtualStr) {
    if (p.is_carryover === true) return false;
    if (p.is_subprojeto === true) return false;
    if (p.projeto_concluido === true) return false;
    const sub = (p.sub_status || '').toUpperCase();
    if (['CANCELADO', 'REPROVADO', 'HOLD'].includes(sub)) return false;
    if (!p.ano_fiscal || String(p.ano_fiscal) >= String(afAtualStr)) return false; // só AF anterior
    const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
    if (['BUSINESS CASE', 'CONCLUIDO'].includes(etapa)) return false;
    return true;
}

async function renderCarryOverView() {
    const tbody = document.getElementById('carryOverTableBody');
    if (!tbody) return;

    const { data: anosFiscaisConfigCache } = await _supabase.from('anos_fiscais_config').select('*');

    // AJUSTADO (a pedido do usuário 24/08/2026): candidatos NOVOS (ainda
    // não marcados) só aparecem a partir do Q4 do Ano Fiscal — projetos
    // JÁ marcados continuam sempre visíveis/gerenciáveis (pra poder
    // desmarcar a qualquer momento), o gate é só pra descobrir novos.
    const infoAF = getInfoAnoFiscal();
    const emQ4 = infoAF.quarterAtual === 'Q4';

    const jaMarcados = projectsData.filter(p => p.is_carryover === true);
    const candidatosNovos = emQ4 ? projectsData.filter(p => elegivelComoNovoCandidatoCarryover(p, infoAF.afAtualStr)) : [];
    // NOVO (2026-09-02): candidatos de AF anterior ainda em andamento —
    // sempre listados, sem gate de Q4.
    const candidatosAFAnterior = projectsData.filter(p => elegivelComoCandidatoCarryoverAFAnterior(p, infoAF.afAtualStr));
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const elegiveis = filtrarProjetosPorArea([...jaMarcados, ...candidatosNovos, ...candidatosAFAnterior], 'carry_over');

    // Card de resumo do pool do próximo AF — sempre visível, reflete o
    // que já está marcado independente do Q4.
    const elResumo = document.getElementById('carryOverResumoPool');
    if (elResumo) {
        const proximoAF = proximoAnoFiscal(infoAF.afAtualStr);
        const pool = calcularPoolCarryover(proximoAF);
        const fmtResumo = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        elResumo.innerHTML = `
            <div class="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <h4 class="text-xs font-bold text-orange-800 uppercase mb-2"><i class="fa-solid fa-flag"></i> Saldo do Orçamento Carryover — ${proximoAF}</h4>
                <div class="grid grid-cols-3 gap-3">
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">Total (${pool.qtd} projeto(s))</span><div class="text-lg font-extrabold text-orange-800">${fmtResumo(pool.total)}</div></div>
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">CAPEX</span><div class="text-sm font-bold text-orange-800">${fmtResumo(pool.capex)}</div></div>
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">OPEX</span><div class="text-sm font-bold text-orange-800">${fmtResumo(pool.opex)}</div></div>
                </div>
            </div>
        `;
    }

    if (!emQ4 && jaMarcados.length === 0 && candidatosAFAnterior.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Candidatos a Carryover do Ano Fiscal corrente só aparecem a partir do último quarter (Q4) — hoje estamos no ${infoAF.quarterAtual}. (Projetos de Ano Fiscal anterior ainda em andamento apareceriam aqui a qualquer momento.)</td></tr>`;
        return;
    }

    if (elegiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">${emQ4 ? 'Nenhum projeto elegível a Carryover no momento' : `Nenhum projeto elegível — candidatos novos do AF corrente só aparecem a partir do Q4 (hoje: ${infoAF.quarterAtual})`}</td></tr>`;
        return;
    }

    tbody.innerHTML = elegiveis.map(p => {
        const marcado = p.is_carryover === true;
        const valorExibido = marcado ? Number(p.valor_carryover || 0) : calcularValorCarryover(p);
        const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        const elegibilidade = marcado ? null : verificarElegibilidadeCarryover(p, anosFiscaisConfigCache || []);
        const elegibilidadeDesmarcar = marcado ? verificarElegibilidadeDesmarcar(p) : null;

        return `
            <tr class="${marcado ? 'bg-amber-50' : ''}">
                <td class="p-3 font-mono font-bold text-gray-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs">${p.etapa_atual || 'BUSINESS CASE'} <br><span class="text-gray-500">${p.sub_status || 'A PLANEJAR'}</span></td>
                <td class="p-3 text-right font-mono">${fmt(p.val_bc)}</td>
                <td class="p-3 text-right font-mono">${fmt(p.val_req)}</td>
                <td class="p-3 text-right font-mono">${fmt(p.val_tech)}</td>
                <td class="p-3 text-right font-mono font-bold ${marcado ? 'text-amber-700' : 'text-gray-500'}">${fmt(valorExibido)}</td>
                <td class="p-3 text-center">
                    ${marcado
                        ? `<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] block mb-1">CARRYOVER</span>
                           ${elegibilidadeDesmarcar.elegivel
                                ? `<button onclick="desmarcarCarryover('${p.codigo}')" class="text-red-600 hover:text-red-800 text-[10px] font-bold">Desmarcar</button>`
                                : `<span class="text-gray-400 text-[10px] font-bold cursor-not-allowed" title="${elegibilidadeDesmarcar.motivo}">Desmarcar</span>
                                   <div class="text-[9px] text-amber-700 mt-1 max-w-[160px]">${elegibilidadeDesmarcar.motivo}</div>`}`
                        : (elegibilidade.elegivel
                            ? `<button onclick="marcarComoCarryover('${p.codigo}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                                   <i class="fa-solid fa-flag"></i> Marcar Carryover
                               </button>`
                            : `<button disabled title="${elegibilidade.motivo}" class="bg-gray-200 text-gray-400 font-bold text-xs px-3 py-1.5 rounded cursor-not-allowed">
                                   <i class="fa-solid fa-flag"></i> Marcar Carryover
                               </button>
                               <div class="text-[9px] text-amber-700 mt-1 max-w-[160px]">${elegibilidade.motivo}</div>`)}
                </td>
            </tr>
        `;
    }).join('');
}

async function marcarComoCarryover(codigo) {
    if (!usuarioPodeAlterarTela('carry_over')) return alert('Você não tem permissão para marcar projetos como Carry Over.');
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    // Reconfere no clique — defesa em profundidade, mesmo padrão já
    // usado em outras telas (o botão já vem desabilitado quando
    // inelegível, mas confere de novo antes de gravar).
    const { data: anosFiscaisConfigCache } = await _supabase.from('anos_fiscais_config').select('*');
    const elegibilidade = verificarElegibilidadeCarryover(p, anosFiscaisConfigCache || []);
    if (!elegibilidade.elegivel) {
        return alert(`⛔ ${elegibilidade.motivo}`);
    }

    const valor = calcularValorCarryover(p);
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    if (!confirm(`Confirma marcar ${codigo} como Carryover?\n\nSaldo calculado: ${fmt(valor)}\n(orçamento definido menos realizado)\n\nO Ano Fiscal do projeto NÃO muda — só recebe a marcação, e ele continua seguindo o fluxo normal do workflow.`)) {
        return;
    }

    const payload = {
        is_carryover: true,
        valor_carryover: valor,
        carryover_marcado_por: currentUser ? currentUser.nome : 'desconhecido',
        carryover_marcado_em: new Date().toISOString(),
        // NOVO (a pedido do usuário 25/08/2026): snapshot de fase/status no
        // momento da marcação — usado por verificarElegibilidadeDesmarcar
        // pra travar o Desmarcar assim que o projeto avançar depois disso.
        carryover_etapa_marcacao: p.etapa_atual || 'BUSINESS CASE',
        carryover_sub_status_marcacao: p.sub_status || null
    };

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao marcar como carryover: ' + error.message);

    await loadProjects();
    renderCarryOverView();
}

async function desmarcarCarryover(codigo) {
    if (!usuarioPodeAlterarTela('carry_over')) return alert('Você não tem permissão para desmarcar Carry Over.');
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    // Reconfere no clique — defesa em profundidade, mesmo padrão já usado
    // em marcarComoCarryover (o botão já vem trocado por um aviso quando
    // inelegível, mas confere de novo antes de gravar).
    const elegibilidade = verificarElegibilidadeDesmarcar(p);
    if (!elegibilidade.elegivel) {
        return alert(`⛔ ${elegibilidade.motivo}`);
    }

    if (!confirm('Deseja remover a marcação de Carryover deste projeto?')) return;

    const { error } = await _supabase.from('projetos').update({
        is_carryover: false,
        valor_carryover: null,
        carryover_marcado_por: null,
        carryover_marcado_em: null,
        carryover_etapa_marcacao: null,
        carryover_sub_status_marcacao: null
    }).eq('codigo', codigo);

    if (error) return alert('Erro ao desmarcar carryover: ' + error.message);

    await loadProjects();
    renderCarryOverView();
}
