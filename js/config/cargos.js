// =========================================================================
// config/cargos.js
// NOVO (evolução de RLS — pré-requisito de controle hierárquico de dados,
// a pedido do usuário 27/08/2026): catálogo de Cargos, mesmo modelo usado
// em Empresas Terceirizadas/Usuários — 2 abas (Cadastrar Cargo / Cargos
// Cadastrados). Só nome + ativo/inativo; não editável depois de criado —
// mesma regra de Tipos de Projeto (só ativar/inativar).
//
// perfis_usuarios.cargo_id passou a ser obrigatório (ver
// schema_cargos.sql) — por isso este catálogo precisa estar populado
// antes de qualquer cadastro/edição de usuário funcionar.
// =========================================================================

function mudarAbaCargos(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`cargosBtn-${a}`);
        const painel = document.getElementById(`cargosPainel-${a}`);
        if (btn) btn.className = `cargos-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('cargos', 'cargosBtn');
}

// Separado de renderCargosView pra poder ser chamado por outras telas
// (Usuários & Perfis) que só precisam dos dados, sem montar a tabela
// desta tela — mesmo padrão de loadAreas()/loadPortes().
async function carregarCargosData() {
    const { data, error } = await _supabase.from('cargos').select('*').order('nome');
    cargosData = error ? [] : (data || []);
}

async function renderCargosView() {
    await carregarCargosData();
    renderCargosTable();
}

function renderCargosTable() {
    const tbody = document.getElementById('cargosTableBody');
    if (!tbody) return;

    if (cargosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum cargo cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = cargosData.map(c => `
        <tr class="${!c.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-semibold">${escapeHtml(c.nome)}</td>
            <td class="p-3 text-[10px] text-gray-400">${escapeHtml(c.criado_por) || '-'} · ${c.criado_em ? new Date(c.criado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-3 text-center">${c.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center">
                ${botaoSePodeAtivarInativar('cargos', `<button onclick="alternarAtivoCargo(${c.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i> ${c.ativo ? 'Inativar' : 'Reativar'}</button>`)}
            </td>
        </tr>
    `).join('');
}

// Usada pelos selects de Cargo do cadastro/edição de usuário — sempre só
// os ativos, mais o já selecionado (caso tenha sido inativado depois).
function cargosAtivos() {
    return cargosData.filter(c => c.ativo);
}

async function salvarCargo() {
    if (!usuarioPodeIncluirTela('cargos')) return alert('Você não tem permissão para incluir cargos.');
    const nome = document.getElementById('cargoNomeInput').value.trim().toUpperCase();

    if (!nome) {
        return alert('Preencha o nome do cargo!');
    }
    if (cargosData.some(c => c.nome === nome)) {
        return alert(`⛔ Já existe um cargo chamado "${nome}".`);
    }

    const payload = {
        nome,
        criado_por: currentUser ? currentUser.nome : 'desconhecido',
        criado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('cargos').insert([payload]);
    if (error) return alert('Erro ao criar o cargo: ' + error.message);

    alert('✅ Cargo criado com sucesso!');
    document.getElementById('cargoNomeInput').value = '';
    mudarAbaCargos('cadastrados');
    await renderCargosView();
}

async function alternarAtivoCargo(id) {
    const c = cargosData.find(x => x.id === id);
    if (!c) return;
    if (c.ativo && !usuarioPodeDeletarTela('cargos')) return alert('Você não tem permissão para inativar cargos.');
    if (!c.ativo && !usuarioPodeAlterarTela('cargos')) return alert('Você não tem permissão para reativar cargos.');

    const acao = c.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Confirma ${acao} o cargo "${c.nome}"?${c.ativo ? ' Usuários que já têm esse cargo continuam com ele — só bloqueia escolher esse cargo em cadastros/edições novas.' : ''}`)) return;

    const { error } = await _supabase.from('cargos').update({ ativo: !c.ativo, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderCargosView();
}
