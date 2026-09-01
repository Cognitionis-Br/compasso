// =========================================================================
// ano-fiscal/ajuste-orcamento.js
// Item 8 — tela "Ajuste de Orçamento" (menu ANO FISCAL). Registra a
// autorização especial para mover orçamento entre subgrupos diferentes
// (áreas ou produtos distintos) nos processos de Carryover e Demanda
// Extraordinária, com log completo, e lista todas as concedidas.
//
// A validação de "mesmo subgrupo" acontece nos fluxos de origem
// (Carryover / trade-off da Extraordinária) — ver mesmoSubgrupoOrcamento()
// em js/core/filtro-agrupamento-orcamento.js. Esta tela é o caminho da
// autorização quando é preciso furar essa regra.
// =========================================================================

let ajusteOrcamentoCache = [];

async function renderAjusteOrcamentoView() {
    const restrito = document.getElementById('ajusteOrcamentoRestrito');
    const conteudo = document.getElementById('ajusteOrcamentoConteudo');
    const podeVer = ehAdministrador || ehProprietario || usuarioTemAtividade('ajuste_orcamento');
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    const { data, error } = await _supabase
        .from('ajuste_orcamento_autorizacoes')
        .select('*')
        .order('autorizado_em', { ascending: false });
    ajusteOrcamentoCache = error ? [] : (data || []);

    const tbody = document.getElementById('ajusteOrcamentoTableBody');
    if (!tbody) return;
    if (ajusteOrcamentoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Nenhuma autorização concedida ainda</td></tr>`;
        return;
    }
    tbody.innerHTML = ajusteOrcamentoCache.map(a => `
        <tr>
            <td class="p-2 whitespace-nowrap">${a.autorizado_em ? new Date(a.autorizado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-2">${escapeHtml(a.tipo_processo)}</td>
            <td class="p-2">${escapeHtml(a.agrupamento)}</td>
            <td class="p-2 font-mono">${escapeHtml(a.projeto_origem_codigo)}${a.subgrupo_origem ? `<span class="block text-[9px] text-gray-400">${escapeHtml(a.subgrupo_origem)}</span>` : ''}</td>
            <td class="p-2 font-mono">${escapeHtml(a.projeto_destino_codigo)}${a.subgrupo_destino ? `<span class="block text-[9px] text-gray-400">${escapeHtml(a.subgrupo_destino)}</span>` : ''}</td>
            <td class="p-2 text-right font-mono">R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-2 uppercase font-bold">${escapeHtml(a.autorizado_por)}</td>
            <td class="p-2 text-gray-500">${escapeHtml(a.justificativa)}</td>
        </tr>
    `).join('');
}

// Deriva o rótulo do subgrupo (nome da área / código-nome do produto) de
// um projeto já carregado em projectsData.
function subgrupoDoProjeto(projeto, agrupamento) {
    if (!projeto) return null;
    if (agrupamento === 'AREA') return (projeto.area || '').toUpperCase() || null;
    if (agrupamento === 'PRODUTO') {
        const p = (typeof produtosCache !== 'undefined' ? produtosCache : []).find(x => String(x.id) === String(projeto.produto_id));
        return p ? `${p.codigo} - ${p.nome}` : (projeto.produto_id ? `Produto #${projeto.produto_id}` : null);
    }
    return null;
}

async function salvarAjusteOrcamento() {
    if (!usuarioPodeIncluirTela('ajuste_orcamento')) return alert('Você não tem permissão para registrar ajustes de orçamento.');

    const tipo_processo = document.getElementById('ajusteProcessoInput').value;
    const agrupamento = document.getElementById('ajusteAgrupamentoInput').value;
    const origem = document.getElementById('ajusteOrigemInput').value.trim().toUpperCase();
    const destino = document.getElementById('ajusteDestinoInput').value.trim().toUpperCase();
    const valor = Number(document.getElementById('ajusteValorInput').value);
    const justificativa = document.getElementById('ajusteJustificativaInput').value.trim();

    if (!tipo_processo || !agrupamento || !origem || !destino || !justificativa) {
        return alert('Preencha processo, agrupamento, projeto origem, projeto destino e justificativa.');
    }
    if (!(valor > 0)) return alert('Informe um valor maior que zero.');
    if (origem === destino) return alert('Projeto origem e destino não podem ser o mesmo.');

    const projOrigem = (typeof projectsData !== 'undefined' ? projectsData : []).find(p => (p.codigo || '').toUpperCase() === origem);
    const projDestino = (typeof projectsData !== 'undefined' ? projectsData : []).find(p => (p.codigo || '').toUpperCase() === destino);
    if (!projOrigem) return alert(`Projeto origem "${origem}" não encontrado.`);
    if (!projDestino) return alert(`Projeto destino "${destino}" não encontrado.`);

    const subOrigem = subgrupoDoProjeto(projOrigem, agrupamento);
    const subDestino = subgrupoDoProjeto(projDestino, agrupamento);

    const payload = {
        tipo_processo, agrupamento,
        projeto_origem_codigo: origem, projeto_destino_codigo: destino,
        subgrupo_origem: subOrigem, subgrupo_destino: subDestino,
        valor, justificativa,
        autorizado_por: currentUser ? currentUser.nome : 'desconhecido'
    };
    const { error } = await _supabase.from('ajuste_orcamento_autorizacoes').insert([payload]);
    if (error) return alert('Erro ao registrar a autorização: ' + error.message);

    alert('✅ Autorização registrada.');
    ['ajusteProcessoInput', 'ajusteAgrupamentoInput'].forEach(id => document.getElementById(id).selectedIndex = 0);
    ['ajusteOrigemInput', 'ajusteDestinoInput', 'ajusteValorInput', 'ajusteJustificativaInput'].forEach(id => document.getElementById(id).value = '');
    await renderAjusteOrcamentoView();
}

// Consulta: existe autorização registrada movendo orçamento origem->destino?
// Usada pelos fluxos de Carryover / Extraordinária pra liberar a operação
// entre subgrupos diferentes (item 7).
function temAutorizacaoAjuste(origemCodigo, destinoCodigo) {
    const o = (origemCodigo || '').toUpperCase(), d = (destinoCodigo || '').toUpperCase();
    return (ajusteOrcamentoCache || []).some(a =>
        (a.projeto_origem_codigo || '').toUpperCase() === o &&
        (a.projeto_destino_codigo || '').toUpperCase() === d);
}

// Carrega o cache de autorizações sem montar a tela (pros fluxos que só
// precisam checar).
async function carregarAutorizacoesAjuste() {
    const { data } = await _supabase.from('ajuste_orcamento_autorizacoes').select('*');
    ajusteOrcamentoCache = data || [];
}
