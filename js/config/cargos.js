// =========================================================================
// config/cargos.js
// NOVO (evolução de RLS — pré-requisito de controle hierárquico de dados,
// a pedido do usuário 27/08/2026): catálogo de Cargos, mesmo modelo usado
// em Empresas Terceirizadas/Usuários — 2 abas (Cadastrar Cargo / Cargos
// Cadastrados). Só nome + ativo/inativo.
//
// AJUSTADO (a pedido do usuário): o nome pode ser alterado enquanto o
// cargo ainda não estiver em uso por nenhum usuário (mesmo critério de
// Produtos/Tipos de Projeto — perfis_usuarios.cargo_id). Uma vez usado,
// fica travado — só ativar/inativar. O cargo 'ANALISTA DE TECNOLOGIA'
// nunca pode ser renomeado: o trigger handle_new_user procura o cargo
// por esse nome exato pra todo usuário novo.
//
// perfis_usuarios.cargo_id passou a ser obrigatório (ver
// schema_cargos.sql) — por isso este catálogo precisa estar populado
// antes de qualquer cadastro/edição de usuário funcionar.
// =========================================================================

const CARGO_RESERVADO_TRIGGER = 'ANALISTA DE TECNOLOGIA';

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

    tbody.innerHTML = cargosData.map(c => {
        const reservado = (c.nome || '').trim().toUpperCase() === CARGO_RESERVADO_TRIGGER;
        return `
        <tr class="${!c.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-semibold">${escapeHtml(c.nome)}${reservado ? ' <span class="text-[9px] bg-gray-200 text-gray-500 px-1 rounded uppercase">reservado</span>' : ''}</td>
            <td class="p-3 text-[10px] text-gray-400">${escapeHtml(c.criado_por) || '-'} · ${formatDateTime(c.criado_em)}</td>
            <td class="p-3 text-center">${c.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center">
                ${reservado ? '' : botaoSePodeAlterar('cargos', `<button onclick="editarCargo(${c.id})" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs mr-2"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`)}
                ${botaoSePodeAtivarInativar('cargos', `<button onclick="alternarAtivoCargo(${c.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i> ${c.ativo ? 'Inativar' : 'Reativar'}</button>`)}
            </td>
        </tr>`;
    }).join('');
}

// Usada pelos selects de Cargo do cadastro/edição de usuário — sempre só
// os ativos, mais o já selecionado (caso tenha sido inativado depois).
function cargosAtivos() {
    return cargosData.filter(c => c.ativo);
}

// Em uso = pelo menos um usuário tem esse cargo (perfis_usuarios.cargo_id).
async function cargoEstaEmUso(id) {
    const { count, error } = await _supabase.from('perfis_usuarios').select('id', { count: 'exact', head: true }).eq('cargo_id', id);
    if (error) return true; // se a checagem falhar, bloqueia por segurança
    return (count || 0) > 0;
}

async function editarCargo(id) {
    const c = cargosData.find(x => x.id === id);
    if (!c) return;
    if (!usuarioPodeAlterarTela('cargos')) return alert('Você não tem permissão para alterar cargos.');
    if ((c.nome || '').trim().toUpperCase() === CARGO_RESERVADO_TRIGGER) {
        return alert(`⛔ O cargo "${CARGO_RESERVADO_TRIGGER}" é reservado do sistema (usado no cadastro automático de todo usuário novo) e não pode ser renomeado.`);
    }
    if (await cargoEstaEmUso(id)) {
        return alert('⛔ Este cargo já está em uso por pelo menos um usuário e não pode mais ser alterado. Só é possível editar cargos que ainda não foram atribuídos a ninguém — use Inativar se quiser tirá-lo de circulação.');
    }

    mudarAbaCargos('criar');
    document.getElementById('cargoIdInput').value = c.id;
    document.getElementById('cargoNomeInput').value = c.nome;
    document.getElementById('btnSalvarCargo').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Cargo';
    document.getElementById('cargoNomeInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparFormularioCargo() {
    document.getElementById('cargoIdInput').value = '';
    document.getElementById('cargoNomeInput').value = '';
    document.getElementById('btnSalvarCargo').innerHTML = '<i class="fa-solid fa-plus"></i> Criar Cargo';
}

async function salvarCargo() {
    const id = document.getElementById('cargoIdInput').value;
    if (!id && !usuarioPodeIncluirTela('cargos')) return alert('Você não tem permissão para incluir cargos.');
    if (id && !usuarioPodeAlterarTela('cargos')) return alert('Você não tem permissão para alterar cargos.');
    const nome = document.getElementById('cargoNomeInput').value.trim().toUpperCase();

    if (!nome) {
        return alert('Preencha o nome do cargo!');
    }
    if (nome === CARGO_RESERVADO_TRIGGER && !(id && cargosData.find(c => c.id === Number(id) && (c.nome || '').trim().toUpperCase() === CARGO_RESERVADO_TRIGGER))) {
        return alert(`⛔ "${CARGO_RESERVADO_TRIGGER}" é um nome reservado do sistema.`);
    }
    if (cargosData.some(c => c.nome === nome && (!id || c.id !== Number(id)))) {
        return alert(`⛔ Já existe um cargo chamado "${nome}".`);
    }

    if (id) {
        if (await cargoEstaEmUso(Number(id))) {
            limparFormularioCargo();
            await renderCargosView();
            return alert('⛔ Este cargo passou a ser usado por um usuário enquanto você editava e não pode mais ser alterado.');
        }
        const { error } = await _supabase.from('cargos').update({
            nome,
            atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
            atualizado_em: new Date().toISOString()
        }).eq('id', Number(id));
        if (error) return alert('Erro ao atualizar o cargo: ' + error.message);
        alert('✅ Cargo atualizado com sucesso!');
    } else {
        const { error } = await _supabase.from('cargos').insert([{
            nome,
            criado_por: currentUser ? currentUser.nome : 'desconhecido',
            criado_em: new Date().toISOString()
        }]);
        if (error) return alert('Erro ao criar o cargo: ' + error.message);
        alert('✅ Cargo criado com sucesso!');
    }

    limparFormularioCargo();
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
