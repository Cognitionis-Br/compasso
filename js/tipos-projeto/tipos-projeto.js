// =========================================================================
// tipos-projeto/tipos-projeto.js
// Item 0 (Fase 1): Cadastro de Tipo de Projeto. Código de 5 letras,
// descrição de até 80 caracteres, auditoria de criação (quem/quando).
// NÃO permite edição depois de criado — só ativar/inativar. Inativar só
// bloqueia uso NOVO; projetos que já usam o tipo continuam intactos
// (confirmado com o usuário).
// =========================================================================

let tiposProjetoCache = [];

// AJUSTADO (padronização de telas, a pedido do usuário): 2 abas — Cadastrar
// Tipo de Projeto / Tipos de Projeto Cadastrados — mesmo padrão de mudarAbaCargos.
function mudarAbaTiposProjeto(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`tiposProjetoBtn-${a}`);
        const painel = document.getElementById(`tiposProjetoPainel-${a}`);
        if (btn) btn.className = `tipos-projeto-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('tipos_projeto', 'tiposProjetoBtn');
}

async function renderTiposProjetoView() {
    const { data, error } = await _supabase.from('tipos_projeto').select('*').order('codigo');
    tiposProjetoCache = error ? [] : (data || []);

    const tbody = document.getElementById('tiposProjetoTableBody');
    if (!tbody) return;

    if (tiposProjetoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum tipo de projeto cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = tiposProjetoCache.map(t => `
        <tr class="${!t.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-mono font-bold">${t.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(t.descricao)}</td>
            <td class="p-3 text-[10px] text-gray-400">${escapeHtml(t.criado_por) || '-'} · ${t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-3 text-center">${t.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center">
                <button onclick="alternarAtivoTipoProjeto(${t.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i> ${t.ativo ? 'Inativar' : 'Reativar'}</button>
            </td>
        </tr>
    `).join('');
}

async function salvarTipoProjeto() {
    const codigo = document.getElementById('tipoProjetoCodigoInput').value.trim().toUpperCase();
    const descricao = document.getElementById('tipoProjetoDescricaoInput').value.trim();

    if (!codigo || !descricao) {
        return alert('Preencha o código e a descrição!');
    }
    if (!/^[A-Z]{5}$/.test(codigo)) {
        return alert('O código precisa ter exatamente 5 letras!');
    }
    if (descricao.length > 80) {
        return alert('A descrição precisa ter no máximo 80 caracteres!');
    }
    if (tiposProjetoCache.some(t => t.codigo === codigo)) {
        return alert(`⛔ Já existe um Tipo de Projeto com o código "${codigo}".`);
    }

    const payload = {
        codigo, descricao,
        criado_por: currentUser ? currentUser.nome : 'desconhecido',
        criado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('tipos_projeto').insert([payload]);
    if (error) return alert('Erro ao criar o Tipo de Projeto: ' + error.message);

    alert('✅ Tipo de Projeto criado com sucesso!');
    document.getElementById('tipoProjetoCodigoInput').value = '';
    document.getElementById('tipoProjetoDescricaoInput').value = '';
    await renderTiposProjetoView();
    mudarAbaTiposProjeto('cadastrados');
}

async function alternarAtivoTipoProjeto(id) {
    const t = tiposProjetoCache.find(x => x.id === id);
    if (!t) return;

    const acao = t.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Confirma ${acao} o Tipo de Projeto "${t.codigo} - ${t.descricao}"?${t.ativo ? ' Projetos que já usam esse tipo continuam normalmente — só bloqueia escolher esse tipo em demandas novas.' : ''}`)) return;

    const { error } = await _supabase.from('tipos_projeto').update({ ativo: !t.ativo }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderTiposProjetoView();
}
