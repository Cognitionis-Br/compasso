// =========================================================================
// ano-fiscal/fechamento-projetos.js
// Aba "Avaliação Projetos Fechamento Ano Fiscal" (tela fechamento_af).
// Substitui a antiga tela "Projetos Carry Over".
//
// Lista os projetos do Ano Fiscal sendo encerrado (fechamentoAfTargetAF())
// e registra, por projeto, uma decisão de fechamento:
//   CONTINUAR  -> Carryover Desenvolvimento — vira Carryover (gravação de
//                 marcarComoCarryover): is_carryover=true + valor_carryover
//                 congelado; o projeto segue ativo e o saldo entra no pool.
//   HOLD       -> Carryover Hold — Carryover + sub_status='HOLD' (entra no
//                 pool e fica retomável em "Retomar Projetos em Hold").
//   CANCELAR   -> cancelamento (sub_status/status='CANCELADO' + resp/dt/motivo),
//                 sem carryover.
//   (Reverter) -> desfaz a decisão anterior enquanto o Ano Fiscal não foi
//                 fechado.
// Toda decisão / reversão é logada em fechamento_af_decisoes.
//
// Permissão de escrita: usuarioPodeAlterar('fechamento_af:projetos')
// (grants: GOVERNANÇA / GESTOR TI) ou Administrador / Proprietário — e só
// enquanto o Ano Fiscal alvo não estiver fechado.
// =========================================================================

let fechamentoDecisoesCache = [];
let fechamentoAnosFiscaisCfgCache = [];

const FECHAMENTO_DECISAO_LABEL = {
    CONTINUAR: { txt: 'Carryover Desenv.', cls: 'bg-emerald-100 text-emerald-800' },
    HOLD:      { txt: 'Carryover Hold',    cls: 'bg-yellow-100 text-yellow-800' },
    CANCELAR:  { txt: 'Cancelado',         cls: 'bg-red-100 text-red-800' },
    REVERTIDO: { txt: 'Revertido',         cls: 'bg-gray-100 text-gray-500' }
};

function fmtFech(v) {
    return (typeof formatCurrency === 'function')
        ? formatCurrency(v)
        : 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function decisaoAtualFechamento(codigo) {
    let maisRecente = null;
    (fechamentoDecisoesCache || []).forEach(d => {
        if (d.projeto_codigo !== codigo) return;
        if (!maisRecente || new Date(d.decidido_em) > new Date(maisRecente.decidido_em)) maisRecente = d;
    });
    return maisRecente;
}

async function carregarDecisoesFechamento() {
    const { data } = await _supabase
        .from('fechamento_af_decisoes')
        .select('*')
        .order('decidido_em', { ascending: false });
    fechamentoDecisoesCache = data || [];
}

// Projetos do Ano Fiscal sendo encerrado (inclui os já tratados, para
// exibir o badge e permitir Reverter).
function projetosDoFechamentoAf() {
    const alvo = (typeof fechamentoAfTargetAF === 'function') ? fechamentoAfTargetAF() : null;
    return (projectsData || []).filter(p => {
        if (alvo && p.ano_fiscal !== alvo) return false;
        if (p.is_subprojeto === true) return false;
        if (p.projeto_concluido === true) return false;
        if ((p.sub_status || '').toUpperCase() === 'REPROVADO') return false;
        return true;
    });
}

async function renderFechamentoProjetosView() {
    const tbody = document.getElementById('fechamentoProjetosTableBody');
    if (!tbody) return;

    await carregarDecisoesFechamento();
    if (typeof carregarProdutosData === 'function' && (typeof produtosCache === 'undefined' || !produtosCache || !produtosCache.length)) {
        try { await carregarProdutosData(); } catch (e) { /* fallback: nomeProdutoPorId mostra "Produto #id" */ }
    }
    const { data: cfg } = await _supabase.from('anos_fiscais_config').select('*');
    fechamentoAnosFiscaisCfgCache = cfg || [];

    const alvo = (typeof fechamentoAfTargetAF === 'function') ? fechamentoAfTargetAF() : null;
    const afFechado = (typeof fechamentoAfJaFechado === 'function') && fechamentoAfJaFechado();

    let lista = projetosDoFechamentoAf();
    if (typeof filtrarProjetosPorArea === 'function') {
        lista = filtrarProjetosPorArea(lista, 'fechamento_af:projetos');
    }
    lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    // Card do pool de carryover do próximo AF.
    const elPool = document.getElementById('fechamentoProjetosPoolCard');
    if (elPool && typeof calcularPoolCarryover === 'function' && typeof proximoAnoFiscal === 'function') {
        const destino = proximoAnoFiscal(alvo || '');
        const pool = calcularPoolCarryover(destino);
        elPool.innerHTML = `
            <div class="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <h4 class="text-xs font-bold text-orange-800 uppercase mb-2"><i class="fa-solid fa-flag"></i> Saldo do Orçamento Carryover — ${destino || '-'}</h4>
                <div class="grid grid-cols-3 gap-3">
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">Total (${pool.qtd} projeto(s))</span><div class="text-lg font-extrabold text-orange-800">${fmtFech(pool.total)}</div></div>
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">CAPEX</span><div class="text-sm font-bold text-orange-800">${fmtFech(pool.capex)}</div></div>
                    <div><span class="text-[10px] font-bold text-orange-600 uppercase block">OPEX</span><div class="text-sm font-bold text-orange-800">${fmtFech(pool.opex)}</div></div>
                </div>
            </div>`;
    }

    // Resumo por situação (estado real do projeto).
    const est = p => {
        const s = (p.sub_status || '').toUpperCase();
        if (s === 'CANCELADO') return 'CANCELAR';
        if (s === 'HOLD') return 'HOLD';
        if (p.is_carryover === true) return 'CONTINUAR';
        return 'SEM';
    };
    const resumo = { CONTINUAR: 0, HOLD: 0, CANCELAR: 0, SEM: 0 };
    lista.forEach(p => { resumo[est(p)]++; });
    const elResumo = document.getElementById('fechamentoProjetosResumo');
    if (elResumo) {
        const chip = (rot, n, cls) => `<span class="px-3 py-1.5 rounded-lg text-xs font-bold ${cls}">${rot}: ${n}</span>`;
        elResumo.innerHTML =
            chip(`Projetos ${alvo || ''}`.trim(), lista.length, 'bg-slate-100 text-slate-700') +
            chip('Carryover Desenv.', resumo.CONTINUAR, 'bg-emerald-100 text-emerald-800') +
            chip('Carryover Hold', resumo.HOLD, 'bg-yellow-100 text-yellow-800') +
            chip('Cancelados', resumo.CANCELAR, 'bg-red-100 text-red-800') +
            chip('Em andamento (pendente)', resumo.SEM, 'bg-gray-100 text-gray-500');
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto do ${alvo || 'Ano Fiscal'} para tratar.</td></tr>`;
        return;
    }

    const podeDecidir = (typeof usuarioPodeAlterar === 'function') && usuarioPodeAlterar('fechamento_af:projetos') && !afFechado;

    tbody.innerHTML = lista.map(p => {
        const saldo = (typeof calcularValorCarryover === 'function') ? calcularValorCarryover(p) : 0;
        const orcAtual = Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
        const situ = est(p);
        const badge = FECHAMENTO_DECISAO_LABEL[situ]
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${FECHAMENTO_DECISAO_LABEL[situ].cls}">${FECHAMENTO_DECISAO_LABEL[situ].txt}</span>`
            : '<span class="text-gray-400 text-[10px] font-bold">—</span>';
        const prodTxt = (typeof nomeProdutoPorId === 'function' && p.produto_id) ? escapeHtml(nomeProdutoPorId(p.produto_id)) : '-';
        let acoes;
        if (!podeDecidir) {
            acoes = afFechado
                ? '<span class="text-gray-400 text-[10px] italic">AF fechado</span>'
                : '<span class="text-gray-400 text-[10px] italic">somente consulta</span>';
        } else if (situ === 'SEM') {
            acoes = `
                <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','CONTINUAR')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-1 rounded">Carryover Desenv.</button>
                <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','HOLD')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-[10px] px-2 py-1 rounded">Carryover Hold</button>
                <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','CANCELAR')" class="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2 py-1 rounded">Cancelar</button>`;
        } else {
            acoes = `<button onclick="reverterDecisaoFechamento('${escapeJsAttr(p.codigo)}')" class="bg-gray-600 hover:bg-gray-700 text-white font-bold text-[10px] px-2 py-1 rounded"><i class="fa-solid fa-rotate-left"></i> Reverter</button>`;
        }
        return `
            <tr>
                <td class="p-2"><button onclick="abrirDetalheProjeto('${escapeJsAttr(p.codigo)}','fechamento_af')" class="font-mono font-bold text-red-700 hover:underline">${escapeHtml(p.codigo)}</button></td>
                <td class="p-2 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-2 font-mono">${p.ano_fiscal || '-'}</td>
                <td class="p-2">${escapeHtml(p.area) || '-'}</td>
                <td class="p-2">${prodTxt}</td>
                <td class="p-2 text-xs">${p.etapa_atual || 'BUSINESS CASE'}<br><span class="text-gray-500">${p.sub_status || '-'}</span></td>
                <td class="p-2 text-right font-mono">${fmtFech(orcAtual)}</td>
                <td class="p-2 text-right font-mono">${fmtFech(Number(p.realizado) || 0)}</td>
                <td class="p-2 text-right font-mono font-bold text-amber-700">${fmtFech(saldo)}</td>
                <td class="p-2 text-center">${badge}</td>
                <td class="p-2 text-center space-x-1 whitespace-nowrap">${acoes}</td>
            </tr>`;
    }).join('');
}

function abrirModalDecisaoFechamento(codigo, tipo) {
    const p = (projectsData || []).find(x => x.codigo === codigo);
    if (!p) return;
    document.getElementById('fechDecisaoCodigo').value = codigo;
    document.getElementById('fechDecisaoTipo').value = tipo;
    const titulos = {
        CONTINUAR: 'Carryover Desenvolvimento',
        HOLD: 'Carryover Hold',
        CANCELAR: 'Cancelar projeto'
    };
    const saldo = (typeof calcularValorCarryover === 'function') ? calcularValorCarryover(p) : 0;
    document.getElementById('fechDecisaoTitulo').innerText = `${titulos[tipo] || tipo} — ${codigo}`;
    document.getElementById('fechDecisaoInfo').innerHTML =
        `${escapeHtml(p.nome)}<br>Fase: <b>${p.etapa_atual || 'BUSINESS CASE'} / ${p.sub_status || '-'}</b>` +
        (tipo === 'CANCELAR' ? '' : `<br>Saldo que entra no carryover: <b>${fmtFech(saldo)}</b>`);
    const obsLabel = document.getElementById('fechDecisaoObsLabel');
    obsLabel.innerText = tipo === 'CANCELAR' ? 'Motivo do cancelamento *' : 'Observação (opcional)';
    document.getElementById('fechDecisaoObs').value = '';
    document.getElementById('modalDecisaoFechamento').classList.remove('hidden');
}

function fecharModalDecisaoFechamento() {
    document.getElementById('modalDecisaoFechamento').classList.add('hidden');
}

async function confirmarDecisaoFechamento() {
    if (!(typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('fechamento_af:projetos'))) {
        return alert('Você não tem permissão para registrar decisões de fechamento.');
    }
    if (typeof fechamentoAfJaFechado === 'function' && fechamentoAfJaFechado()) {
        return alert('O Ano Fiscal já foi fechado — não é possível registrar decisões.');
    }
    const codigo = document.getElementById('fechDecisaoCodigo').value;
    const tipo = document.getElementById('fechDecisaoTipo').value;
    const obs = document.getElementById('fechDecisaoObs').value.trim();
    const p = (projectsData || []).find(x => x.codigo === codigo);
    if (!p) return;
    if (tipo === 'CANCELAR' && !obs) return alert('Informe o motivo do cancelamento.');

    const agora = new Date().toISOString();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const saldo = (typeof calcularValorCarryover === 'function') ? calcularValorCarryover(p) : 0;

    let payload;
    if (tipo === 'CONTINUAR' || tipo === 'HOLD') {
        // Mesmo gate do Carryover: o próximo AF precisa já existir aberto/fechado.
        if (typeof verificarElegibilidadeCarryover === 'function') {
            const el = verificarElegibilidadeCarryover(p, fechamentoAnosFiscaisCfgCache || []);
            if (!el.elegivel) return alert('⛔ ' + el.motivo);
        }
        payload = {
            is_carryover: true,
            valor_carryover: saldo,
            carryover_marcado_por: quem,
            carryover_marcado_em: agora,
            carryover_etapa_marcacao: p.etapa_atual || 'BUSINESS CASE',
            carryover_sub_status_marcacao: (tipo === 'HOLD') ? 'HOLD' : (p.sub_status || null)
        };
        if (tipo === 'HOLD') {
            payload.sub_status = 'HOLD';
            payload.sub_status_antes_hold = p.sub_status || null;
            payload.tradeoff_por = quem;
            payload.tradeoff_em = agora;
            payload.tradeoff_observacao = obs || 'Colocado em Carryover Hold no fechamento do Ano Fiscal.';
        }
    } else {
        payload = {
            sub_status: 'CANCELADO',
            status: 'CANCELADO',
            resp_cancelamento: quem,
            dt_cancelamento: new Date().toISOString().split('T')[0],
            motivo_cancelamento: obs,
            is_carryover: false,
            valor_carryover: null,
            carryover_marcado_por: null,
            carryover_marcado_em: null,
            carryover_etapa_marcacao: null,
            carryover_sub_status_marcacao: null
        };
    }

    const confirmMsg = {
        CONTINUAR: `Confirmar CARRYOVER DESENVOLVIMENTO de "${codigo}"?\n\nO projeto segue ativo e o saldo de ${fmtFech(saldo)} entra no pool de carryover do próximo Ano Fiscal.`,
        HOLD: `Confirmar CARRYOVER HOLD de "${codigo}"?\n\nO projeto é suspenso (some das telas operacionais, retomável em "Retomar Projetos em Hold") e o saldo de ${fmtFech(saldo)} entra no pool de carryover.`,
        CANCELAR: `Confirmar CANCELAMENTO de "${codigo}"?\n\nEncerramento definitivo, sem continuidade orçamentária.`
    }[tipo];
    if (!confirm(confirmMsg)) return;

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao aplicar a decisão: ' + error.message);
    Object.assign(p, payload);

    const { error: errLog } = await _supabase.from('fechamento_af_decisoes').insert([{
        ano_fiscal: p.ano_fiscal || null,
        projeto_codigo: codigo,
        decisao: tipo,
        valor_remanescente: (tipo === 'CANCELAR') ? 0 : saldo,
        observacao: obs || null,
        decidido_por: quem
    }]);
    if (errLog) console.error('Decisão aplicada, mas houve erro ao gravar o log:', errLog.message);

    fecharModalDecisaoFechamento();
    alert('✅ Decisão registrada.');
    if (typeof loadProjects === 'function') await loadProjects();
    if (typeof renderFechamentoAfView === 'function') await renderFechamentoAfView();
    else await renderFechamentoProjetosView();
}

async function reverterDecisaoFechamento(codigo) {
    if (!(typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('fechamento_af:projetos'))) {
        return alert('Você não tem permissão para reverter decisões de fechamento.');
    }
    if (typeof fechamentoAfJaFechado === 'function' && fechamentoAfJaFechado()) {
        return alert('O Ano Fiscal já foi fechado — não é possível reverter decisões.');
    }
    const p = (projectsData || []).find(x => x.codigo === codigo);
    if (!p) return;
    const s = (p.sub_status || '').toUpperCase();
    const eraCancelado = s === 'CANCELADO';
    const eraHold = s === 'HOLD';
    const eraCarryover = p.is_carryover === true;
    if (!eraCancelado && !eraHold && !eraCarryover) return alert('Este projeto não tem decisão de fechamento para reverter.');

    if (!confirm(`Reverter a decisão de fechamento de "${codigo}"?\n\nO projeto volta a contar como "em andamento" e precisará de nova decisão antes de fechar o Ano Fiscal.`)) return;

    let payload = {
        is_carryover: false,
        valor_carryover: null,
        carryover_marcado_por: null,
        carryover_marcado_em: null,
        carryover_etapa_marcacao: null,
        carryover_sub_status_marcacao: null
    };
    let decisaoRevertida;
    if (eraCancelado) {
        decisaoRevertida = 'CANCELAR';
        payload.sub_status = p.sub_status_antes_hold || 'A PLANEJAR';
        payload.status = 'EM ANDAMENTO';
        payload.resp_cancelamento = null;
        payload.dt_cancelamento = null;
        payload.motivo_cancelamento = null;
    } else if (eraHold) {
        decisaoRevertida = 'HOLD';
        payload.sub_status = p.sub_status_antes_hold || 'A PLANEJAR';
        payload.sub_status_antes_hold = null;
        payload.tradeoff_por = null;
        payload.tradeoff_em = null;
        payload.tradeoff_observacao = null;
    } else {
        decisaoRevertida = 'CONTINUAR';
    }

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao reverter a decisão: ' + error.message);
    Object.assign(p, payload);

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const { error: errLog } = await _supabase.from('fechamento_af_decisoes').insert([{
        ano_fiscal: p.ano_fiscal || null,
        projeto_codigo: codigo,
        decisao: 'REVERTIDO',
        valor_remanescente: 0,
        observacao: `Revertida a decisão anterior: ${decisaoRevertida}`,
        decidido_por: quem
    }]);
    if (errLog) console.error('Reversão aplicada, mas houve erro ao gravar o log:', errLog.message);

    alert('✅ Decisão revertida.');
    if (typeof loadProjects === 'function') await loadProjects();
    if (typeof renderFechamentoAfView === 'function') await renderFechamentoAfView();
    else await renderFechamentoProjetosView();
}

// Carrega só o cache do log (para a tela de Detalhe do Projeto).
async function carregarDecisoesFechamentoCache() {
    const { data } = await _supabase.from('fechamento_af_decisoes').select('*');
    fechamentoDecisoesCache = data || [];
}
