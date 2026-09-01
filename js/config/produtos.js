// =========================================================================
// config/produtos.js
// Cadastro de Produtos (Agrupamento de Orçamento por Produto — item 3).
// Mesmo padrão CRUD simples de Tipos de Projeto: Código + Nome +
// Ativo/Inativo. Não editável depois de criado — só ativar/inativar.
// Inativar só bloqueia uso NOVO; projetos que já usam o produto continuam.
//
// O produto sentinela NAO_CLASSIFICADO ("Não Classificado") é valor
// histórico dos projetos antigos — aparece na lista aqui (pra visibilidade)
// mas NÃO é oferecido no formulário de Formalizar Demanda
// (ver produtosSelecionaveis()).
// =========================================================================

let produtosCache = [];

function mudarAbaProdutos(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`produtosBtn-${a}`);
        const painel = document.getElementById(`produtosPainel-${a}`);
        if (btn) btn.className = `produtos-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('produtos', 'produtosBtn');
}

// Separado de renderProdutosView pra ser chamado por outras telas
// (Formalizar Demanda) que só precisam dos dados — mesmo padrão de
// carregarCargosData().
async function carregarProdutosData() {
    const { data, error } = await _supabase.from('produtos').select('*').order('nome');
    produtosCache = error ? [] : (data || []);
}

// Produtos oferecíveis num formulário de demanda: ativos e != sentinela.
function produtosSelecionaveis() {
    return produtosCache.filter(p => p.ativo && p.codigo !== 'NAO_CLASSIFICADO');
}

async function renderProdutosView() {
    await carregarProdutosData();

    const tbody = document.getElementById('produtosTableBody');
    if (!tbody) return;

    if (produtosCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum produto cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = produtosCache.map(p => {
        const sentinela = p.codigo === 'NAO_CLASSIFICADO';
        return `
        <tr class="${!p.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-mono font-bold">${escapeHtml(p.codigo)}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}${sentinela ? ' <span class="text-[9px] bg-gray-200 text-gray-500 px-1 rounded uppercase">sentinela</span>' : ''}</td>
            <td class="p-3 text-[10px] text-gray-400">${escapeHtml(p.criado_por) || '-'} · ${p.criado_em ? new Date(p.criado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-3 text-center">${p.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center">
                ${sentinela ? '<span class="text-gray-300 text-[10px]">—</span>' : botaoSePodeAtivarInativar('produtos', `<button onclick="alternarAtivoProduto(${p.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i> ${p.ativo ? 'Inativar' : 'Reativar'}</button>`)}
            </td>
        </tr>`;
    }).join('');
}

async function salvarProduto() {
    if (!usuarioPodeIncluirTela('produtos')) return alert('Você não tem permissão para incluir produtos.');
    const codigo = document.getElementById('produtoCodigoInput').value.trim().toUpperCase();
    const nome = document.getElementById('produtoNomeInput').value.trim();

    if (!codigo || !nome) return alert('Preencha o código e o nome do produto!');
    if (codigo.length > 20) return alert('O código precisa ter no máximo 20 caracteres!');
    if (nome.length > 80) return alert('O nome precisa ter no máximo 80 caracteres!');
    if (codigo === 'NAO_CLASSIFICADO') return alert('Código reservado pelo sistema.');
    if (produtosCache.some(p => p.codigo === codigo)) {
        return alert(`⛔ Já existe um produto com o código "${codigo}".`);
    }

    const payload = {
        codigo, nome,
        criado_por: currentUser ? currentUser.nome : 'desconhecido',
        criado_em: new Date().toISOString()
    };
    const { error } = await _supabase.from('produtos').insert([payload]);
    if (error) return alert('Erro ao criar o produto: ' + error.message);

    alert('✅ Produto criado com sucesso!');
    document.getElementById('produtoCodigoInput').value = '';
    document.getElementById('produtoNomeInput').value = '';
    await renderProdutosView();
    mudarAbaProdutos('cadastrados');
}

async function alternarAtivoProduto(id) {
    const p = produtosCache.find(x => x.id === id);
    if (!p) return;
    if (p.codigo === 'NAO_CLASSIFICADO') return alert('O produto sentinela não pode ser inativado.');
    if (p.ativo && !usuarioPodeDeletarTela('produtos')) return alert('Você não tem permissão para inativar produtos.');
    if (!p.ativo && !usuarioPodeAlterarTela('produtos')) return alert('Você não tem permissão para reativar produtos.');

    const acao = p.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Confirma ${acao} o produto "${p.codigo} - ${p.nome}"?${p.ativo ? ' Projetos que já usam esse produto continuam normalmente — só bloqueia escolher em demandas novas.' : ''}`)) return;

    const { error } = await _supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderProdutosView();
}
