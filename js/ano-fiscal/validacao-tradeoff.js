// =========================================================================
// ano-fiscal/validacao-tradeoff.js
// NOVO (Feature 1.1 — 03/09/2026): tela "Validação de Trade-off
// Extraordinário" (menu ANO FISCAL, ao lado de "Ajuste de Orçamento" —
// que NÃO é alterada por esta feature).
//
// Quando o modo de controle orçamentário (js/config/controle-orcamento.js)
// é AREA ou PRODUTO e a simulação de trade-off da Demanda Extraordinária
// inclui projetos de OUTRO subgrupo, a aprovação em "Aprovar Demanda
// Extraordinária" grava uma pendência em tradeoff_validacao_pendencias em
// vez de aplicar na hora. Esta tela lista essas pendências, mostra os 3
// painéis de situação orçamentária pedidos, e permite APROVAR (com motivo
// obrigatório -> aplica os efeitos via aplicarTradeoffAprovado, de
// js/adhoc/tradeoff.js) ou REJEITAR (com motivo -> nada é aplicado).
// =========================================================================

let validacaoTradeoffCache = [];
let validacaoTradeoffDecisao = { id: null, acao: null };

function _podeVerValidacaoTradeoff() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('validacao_tradeoff'));
}
function _podeDecidirValidacaoTradeoff() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('validacao_tradeoff'));
}

async function renderValidacaoTradeoffView() {
    const restrito = document.getElementById('validacaoTradeoffRestrito');
    const conteudo = document.getElementById('validacaoTradeoffConteudo');
    const podeVer = _podeVerValidacaoTradeoff();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    // Garante áreas + produtos carregados (subgrupoDoProjeto depende de produtosCache).
    if (typeof garantirDadosAgrupamento === 'function') await garantirDadosAgrupamento();

    const { data, error } = await _supabase
        .from('tradeoff_validacao_pendencias')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('criado_em', { ascending: false });
    validacaoTradeoffCache = error ? [] : (data || []);

    const tbody = document.getElementById('validacaoTradeoffTableBody');
    const podeDecidir = _podeDecidirValidacaoTradeoff();
    if (tbody) {
        tbody.innerHTML = validacaoTradeoffCache.length === 0
            ? `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhuma pendência de validação.</td></tr>`
            : validacaoTradeoffCache.map(p => `
                <tr>
                    <td class="p-2 whitespace-nowrap">${p.criado_em ? new Date(p.criado_em).toLocaleString('pt-BR') : '-'}<span class="block text-[9px] text-gray-400 uppercase">${escapeHtml(p.criado_por || '-')}</span></td>
                    <td class="p-2 font-mono font-bold text-red-700">${escapeHtml(p.projeto_adhoc_codigo)}</td>
                    <td class="p-2 font-bold">${p.modo_controle === 'AREA' ? 'Área' : 'Produto'}</td>
                    <td class="p-2 text-right font-mono">${formatCurrency(Number(p.valor_adhoc) || 0)}</td>
                    <td class="p-2 text-right font-mono">${formatCurrency(Number(p.saldo_resultante) || 0)}</td>
                    <td class="p-2 text-center whitespace-nowrap">
                        <button onclick="abrirDetalheValidacaoTradeoff(${p.id})" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[10px] px-2 py-1 rounded">Detalhar</button>
                        ${podeDecidir ? `
                        <button onclick="abrirModalDecisaoValidacaoTradeoff(${p.id}, 'aprovar')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-2 py-1 rounded">Aprovar</button>
                        <button onclick="abrirModalDecisaoValidacaoTradeoff(${p.id}, 'rejeitar')" class="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2 py-1 rounded">Rejeitar</button>` : ''}
                    </td>
                </tr>`).join('');
    }
    const det = document.getElementById('validacaoTradeoffDetalhe');
    if (det) det.innerHTML = '';
}

// -------- situação orçamentária (orçado / realizado / saldo) ------------
function _projetoAtivoParaSituacao(p) {
    if (p.is_subprojeto === true || p.projeto_concluido === true) return false;
    const sub = (p.sub_status || '').toUpperCase();
    return sub !== 'CANCELADO' && sub !== 'REPROVADO';
}
function _situacaoOrcamentaria(lista) {
    const orcado = lista.reduce((a, p) => a + (Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0), 0);
    const realizado = lista.reduce((a, p) => a + (Number(p.realizado) || 0), 0);
    return { qtd: lista.length, orcado, realizado, saldo: orcado - realizado };
}
function _painelSituacaoHtml(titulo, sit) {
    return `
        <div class="bg-white border border-gray-200 rounded-lg p-3">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">${titulo}</div>
            <div class="grid grid-cols-4 gap-2 text-xs">
                <div><span class="text-gray-400 block">Projetos</span><b>${sit.qtd}</b></div>
                <div><span class="text-gray-400 block">Orçado</span><b>${formatCurrency(sit.orcado)}</b></div>
                <div><span class="text-gray-400 block">Realizado</span><b class="text-red-600">${formatCurrency(sit.realizado)}</b></div>
                <div><span class="text-gray-400 block">Saldo</span><b class="${sit.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}">${formatCurrency(sit.saldo)}</b></div>
            </div>
        </div>`;
}

function abrirDetalheValidacaoTradeoff(id) {
    const pend = validacaoTradeoffCache.find(p => String(p.id) === String(id));
    const det = document.getElementById('validacaoTradeoffDetalhe');
    if (!pend || !det) return;

    const modo = pend.modo_controle; // 'AREA' | 'PRODUTO'
    const agrup = modo === 'AREA' ? 'AREA' : 'PRODUTO';
    const projAdhoc = projectsData.find(p => p.codigo === pend.projeto_adhoc_codigo);
    const decisoes = Array.isArray(pend.simulacao) ? pend.simulacao : [];

    // Painel A — Ano Fiscal inteiro.
    const listaAF = projectsData.filter(p => p.ano_fiscal === pend.ano_fiscal && _projetoAtivoParaSituacao(p));
    // Painel B — subgrupo do projeto extraordinário.
    const subExtra = (typeof subgrupoDoProjeto === 'function') ? subgrupoDoProjeto(projAdhoc, agrup) : null;
    const listaSubExtra = listaAF.filter(p => (typeof subgrupoDoProjeto === 'function') && subgrupoDoProjeto(p, agrup) === subExtra);
    // Painel C — por subgrupo distinto dos projetos envolvidos.
    const envolvidos = [projAdhoc, ...decisoes.map(d => projectsData.find(p => p.codigo === d.codigo))].filter(Boolean);
    const subgruposEnvolvidos = [...new Set(envolvidos.map(p => (typeof subgrupoDoProjeto === 'function') ? subgrupoDoProjeto(p, agrup) : null).filter(Boolean))];

    const linhasProjetos = decisoes.map(d => {
        const p = projectsData.find(x => x.codigo === d.codigo);
        const sub = p ? ((typeof subgrupoDoProjeto === 'function') ? (subgrupoDoProjeto(p, agrup) || '-') : '-') : '-';
        const foraEscopo = sub !== subExtra;
        const rotAcao = d.acao === 'CEDER_PARTE' ? `Ceder ${formatCurrency(Number(d.valorParcial) || 0)}` : (d.acao === 'CANCELAR' ? 'Cancelar' : 'HOLD');
        return `<tr>
            <td class="p-2 font-mono font-bold">${escapeHtml(d.codigo)}</td>
            <td class="p-2">${p ? escapeHtml(p.nome) : '<i class="text-gray-400">não encontrado</i>'}</td>
            <td class="p-2">${escapeHtml(sub)} ${foraEscopo ? '<span class="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">FORA</span>' : ''}</td>
            <td class="p-2">${p ? (p.etapa_atual || 'BUSINESS CASE') : '-'}</td>
            <td class="p-2 font-bold">${rotAcao}</td>
        </tr>`;
    }).join('');

    det.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-bold text-gray-800 text-sm uppercase tracking-wider">Trade-off de ${escapeHtml(pend.projeto_adhoc_codigo)}${projAdhoc ? ' — ' + escapeHtml(projAdhoc.nome) : ''}</h4>
                <span class="text-[10px] text-gray-500">Modo: <b>${modo === 'AREA' ? 'Área' : 'Produto'}</b> · Subgrupo do extraordinário: <b>${escapeHtml(subExtra || '-')}</b></span>
            </div>
            <div class="overflow-x-auto mb-4">
                <table class="w-full text-left border-collapse text-xs">
                    <thead><tr class="bg-gray-50 text-gray-700 font-semibold border-b uppercase">
                        <th class="p-2">Projeto</th><th class="p-2">Nome</th><th class="p-2">${modo === 'AREA' ? 'Área' : 'Produto'}</th><th class="p-2">Fase</th><th class="p-2">Ação</th>
                    </tr></thead>
                    <tbody class="divide-y divide-gray-100">${linhasProjetos || `<tr><td colspan="5" class="p-2 text-gray-400">Sem projetos no trade-off.</td></tr>`}</tbody>
                </table>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                ${_painelSituacaoHtml(`Situação — Ano Fiscal ${escapeHtml(pend.ano_fiscal || '-')}`, _situacaoOrcamentaria(listaAF))}
                ${_painelSituacaoHtml(`Situação — ${modo === 'AREA' ? 'Área' : 'Produto'} do extraordinário (${escapeHtml(subExtra || '-')})`, _situacaoOrcamentaria(listaSubExtra))}
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Situação — por ${modo === 'AREA' ? 'área' : 'produto'} envolvido no trade-off</div>
                    ${subgruposEnvolvidos.map(sg => {
                        const s = _situacaoOrcamentaria(listaAF.filter(p => (typeof subgrupoDoProjeto === 'function') && subgrupoDoProjeto(p, agrup) === sg));
                        return `<div class="text-xs border-t pt-1 mt-1 first:border-t-0 first:mt-0 first:pt-0"><b>${escapeHtml(sg)}</b> — Orçado ${formatCurrency(s.orcado)} · Realizado ${formatCurrency(s.realizado)} · Saldo <b class="${s.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}">${formatCurrency(s.saldo)}</b></div>`;
                    }).join('') || '<div class="text-xs text-gray-400">Sem subgrupos.</div>'}
                </div>
            </div>
        </div>`;
}

function abrirModalDecisaoValidacaoTradeoff(id, acao) {
    if (!_podeDecidirValidacaoTradeoff()) return alert('Você não tem permissão para decidir validações de trade-off.');
    const pend = validacaoTradeoffCache.find(p => String(p.id) === String(id));
    if (!pend) return;
    validacaoTradeoffDecisao = { id, acao };
    document.getElementById('valTradeoffModalTitulo').innerText = acao === 'aprovar' ? 'Aprovar Trade-off' : 'Rejeitar Trade-off';
    document.getElementById('valTradeoffModalTexto').innerText = acao === 'aprovar'
        ? `Aprovar aplica os trade-offs de ${pend.projeto_adhoc_codigo} (HOLD/Cancelar/Ceder Parte) e promove o projeto extraordinário para Requerimentos.`
        : `Rejeitar descarta a simulação de ${pend.projeto_adhoc_codigo}. Nada é aplicado aos projetos; o extraordinário continua em Business Case.`;
    document.getElementById('valTradeoffModalMotivo').value = '';
    const btn = document.getElementById('valTradeoffModalConfirmar');
    btn.className = `px-4 py-2 ${acao === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded text-xs font-bold`;
    btn.onclick = confirmarDecisaoValidacaoTradeoff;
    document.getElementById('modalDecisaoValidacaoTradeoff').classList.remove('hidden');
}

function fecharModalDecisaoValidacaoTradeoff() {
    document.getElementById('modalDecisaoValidacaoTradeoff').classList.add('hidden');
    validacaoTradeoffDecisao = { id: null, acao: null };
}

async function confirmarDecisaoValidacaoTradeoff() {
    if (!_podeDecidirValidacaoTradeoff()) return alert('Sem permissão.');
    const { id, acao } = validacaoTradeoffDecisao;
    const pend = validacaoTradeoffCache.find(p => String(p.id) === String(id));
    if (!pend) return;
    const motivo = (document.getElementById('valTradeoffModalMotivo').value || '').trim();
    if (!motivo) return alert('Informe o motivo / justificativa.');

    const quem = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();

    if (acao === 'aprovar') {
        const projAdhoc = projectsData.find(p => p.codigo === pend.projeto_adhoc_codigo);
        if (!projAdhoc) return alert('Projeto extraordinário não encontrado na base atual. Recarregue e tente de novo.');
        if (typeof aplicarTradeoffAprovado !== 'function') return alert('Função de aplicação do trade-off indisponível (js/adhoc/tradeoff.js não carregado).');
        const ok = await aplicarTradeoffAprovado(projAdhoc, pend.simulacao || [], { saldoResultante: pend.saldo_resultante, aprovadoPor: quem });
        if (!ok) return; // aplicarTradeoffAprovado já alertou
    }

    const { error } = await _supabase.from('tradeoff_validacao_pendencias').update({
        status: acao === 'aprovar' ? 'APROVADA' : 'REJEITADA',
        decidido_por: quem,
        decidido_em: agora,
        motivo_decisao: motivo
    }).eq('id', id);
    if (error) return alert('Erro ao registrar a decisão: ' + error.message);

    fecharModalDecisaoValidacaoTradeoff();
    alert(acao === 'aprovar' ? '✅ Trade-off aprovado e aplicado.' : '✅ Trade-off rejeitado. Nada foi aplicado.');
    if (typeof loadProjects === 'function') await loadProjects();
    await renderValidacaoTradeoffView();
}
