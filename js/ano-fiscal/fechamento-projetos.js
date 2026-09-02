// =========================================================================
// ano-fiscal/fechamento-projetos.js
// Épico "Fechamento de Ano Fiscal" — História 1: decisão de fechamento.
//
// Lista todos os projetos em curso (não concluídos) e registra, por
// projeto, uma de três decisões, reaproveitando a base já usada por
// Projetos Carry Over:
//   CONTINUAR -> vira Carryover (mesma gravação de marcarComoCarryover):
//                is_carryover=true + valor_carryover congelado; o projeto
//                segue ativo e o saldo entra no pool do próximo AF.
//   HOLD      -> Carryover + sub_status='HOLD' (também entra no pool,
//                fica disponível para retomada em "Retomar Projetos em Hold").
//   CANCELAR  -> cancelamento (sub_status/status='CANCELADO' + resp/dt/motivo),
//                sem carryover.
// Toda decisão é logada em fechamento_af_decisoes (usuário, data/hora).
//
// Acesso: a tela aparece para quem tem a atividade 'fechamento_projetos'
// (consulta). Os botões de decisão só para quem pode ALTERAR essa tela
// (grants: GOVERNANÇA / GESTOR TI) ou Administrador / Proprietário.
// =========================================================================

let fechamentoDecisoesCache = [];
let fechamentoAnosFiscaisCfgCache = [];

const FECHAMENTO_DECISAO_LABEL = {
    CONTINUAR: { txt: 'Continuar', cls: 'bg-emerald-100 text-emerald-800' },
    HOLD:      { txt: 'Hold',      cls: 'bg-yellow-100 text-yellow-800' },
    CANCELAR:  { txt: 'Cancelado', cls: 'bg-red-100 text-red-800' }
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

function projetosEmCursoFechamento() {
    return (projectsData || []).filter(p => {
        if (p.is_subprojeto === true) return false;
        if (p.projeto_concluido === true) return false;
        const sub = (p.sub_status || '').toUpperCase();
        if (['CANCELADO', 'REPROVADO'].includes(sub)) return false;
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

    let lista = projetosEmCursoFechamento();
    if (typeof filtrarProjetosPorArea === 'function') {
        lista = filtrarProjetosPorArea(lista, 'fechamento_projetos');
    }
    lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    // Resumo por decisão
    const resumo = { CONTINUAR: 0, HOLD: 0, CANCELAR: 0, SEM: 0 };
    lista.forEach(p => {
        const d = decisaoAtualFechamento(p.codigo);
        resumo[d ? d.decisao : 'SEM']++;
    });
    const elResumo = document.getElementById('fechamentoProjetosResumo');
    if (elResumo) {
        const chip = (rot, n, cls) => `<span class="px-3 py-1.5 rounded-lg text-xs font-bold ${cls}">${rot}: ${n}</span>`;
        elResumo.innerHTML =
            chip('Em curso', lista.length, 'bg-slate-100 text-slate-700') +
            chip('Continuar', resumo.CONTINUAR, 'bg-emerald-100 text-emerald-800') +
            chip('Hold', resumo.HOLD, 'bg-yellow-100 text-yellow-800') +
            chip('Cancelar', resumo.CANCELAR, 'bg-red-100 text-red-800') +
            chip('Sem decisão', resumo.SEM, 'bg-gray-100 text-gray-500');
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em curso para tratar.</td></tr>`;
        return;
    }

    const podeDecidir = (typeof usuarioPodeAlterarTela === 'function') && usuarioPodeAlterarTela('fechamento_projetos');

    tbody.innerHTML = lista.map(p => {
        const saldo = (typeof calcularValorCarryover === 'function') ? calcularValorCarryover(p) : 0;
        const orcAtual = Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
        const d = decisaoAtualFechamento(p.codigo);
        const badge = d && FECHAMENTO_DECISAO_LABEL[d.decisao]
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${FECHAMENTO_DECISAO_LABEL[d.decisao].cls}">${FECHAMENTO_DECISAO_LABEL[d.decisao].txt}</span>`
            : '<span class="text-gray-400 text-[10px] font-bold">—</span>';
        const prodTxt = (typeof nomeProdutoPorId === 'function' && p.produto_id) ? escapeHtml(nomeProdutoPorId(p.produto_id)) : '-';
        const acoes = podeDecidir ? `
            <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','CONTINUAR')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-1 rounded">Continuar</button>
            <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','HOLD')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-[10px] px-2 py-1 rounded">Hold</button>
            <button onclick="abrirModalDecisaoFechamento('${escapeJsAttr(p.codigo)}','CANCELAR')" class="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2 py-1 rounded">Cancelar</button>`
            : '<span class="text-gray-400 text-[10px] italic">somente consulta</span>';
        return `
            <tr>
                <td class="p-2"><button onclick="abrirDetalheProjeto('${escapeJsAttr(p.codigo)}','fechamento_projetos')" class="font-mono font-bold text-red-700 hover:underline">${escapeHtml(p.codigo)}</button></td>
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
        CONTINUAR: 'Continuar no próximo Ano Fiscal',
        HOLD: 'Colocar em Hold (carryover)',
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
    if (!(typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('fechamento_projetos'))) {
        return alert('Você não tem permissão para registrar decisões de fechamento.');
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
            payload.tradeoff_observacao = obs || 'Colocado em Hold no fechamento do Ano Fiscal.';
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
        CONTINUAR: `Confirmar CONTINUAR "${codigo}" no próximo Ano Fiscal?\n\nO projeto segue ativo e o saldo de ${fmtFech(saldo)} entra no pool de carryover.`,
        HOLD: `Confirmar HOLD de "${codigo}"?\n\nO projeto é suspenso (some das telas operacionais, retomável em "Retomar Projetos em Hold") e o saldo de ${fmtFech(saldo)} entra no pool de carryover.`,
        CANCELAR: `Confirmar CANCELAMENTO de "${codigo}"?\n\nEncerramento definitivo, sem continuidade orçamentária.`
    }[tipo];
    if (!confirm(confirmMsg)) return;

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao aplicar a decisão: ' + error.message);

    // espelha em memória
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
    await renderFechamentoProjetosView();
}

// Carrega só o cache do log (para a tela de Detalhe do Projeto).
async function carregarDecisoesFechamentoCache() {
    const { data } = await _supabase.from('fechamento_af_decisoes').select('*');
    fechamentoDecisoesCache = data || [];
}
