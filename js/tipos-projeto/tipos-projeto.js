// =========================================================================
// tipos-projeto/tipos-projeto.js
// Item 0 (Fase 1): Cadastro de Tipo de Projeto. Código de 5 letras,
// descrição de até 80 caracteres, auditoria de criação (quem/quando).
// Inativar só bloqueia uso NOVO; projetos que já usam o tipo continuam
// intactos (confirmado com o usuário).
//
// AJUSTADO (a pedido do usuário): a descrição pode ser alterada enquanto
// o tipo ainda não estiver em uso por nenhum projeto (mesmo critério de
// "em uso" de Cadastro de Porte/Produtos). Uma vez usado por pelo menos
// um projeto, fica travado — só ativar/inativar. O código nunca muda
// depois de criado, em uso ou não.
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
                ${botaoSePodeAlterar('tipos_projeto', `<button onclick="editarTipoProjeto(${t.id})" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs mr-2"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`)}
                ${botaoSePodeAtivarInativar('tipos_projeto', `<button onclick="alternarAtivoTipoProjeto(${t.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i> ${t.ativo ? 'Inativar' : 'Reativar'}</button>`)}
            </td>
        </tr>
    `).join('');
}

// Em uso = pelo menos um projeto já aponta pro tipo (projetos.tipo_projeto_id).
async function tipoProjetoEstaEmUso(id) {
    const { count, error } = await _supabase.from('projetos').select('id', { count: 'exact', head: true }).eq('tipo_projeto_id', id);
    if (error) return true; // se a checagem falhar, bloqueia por segurança
    return (count || 0) > 0;
}

async function editarTipoProjeto(id) {
    const t = tiposProjetoCache.find(x => x.id === id);
    if (!t) return;
    if (!usuarioPodeAlterarTela('tipos_projeto')) return alert('Você não tem permissão para alterar tipos de projeto.');

    if (await tipoProjetoEstaEmUso(id)) {
        return alert('⛔ Este Tipo de Projeto já está em uso por pelo menos um projeto e não pode mais ser alterado. Só é possível editar tipos que ainda não foram usados em nenhuma demanda — use Inativar se quiser tirá-lo de circulação.');
    }

    mudarAbaTiposProjeto('criar');
    document.getElementById('tipoProjetoIdInput').value = t.id;
    document.getElementById('tipoProjetoCodigoInput').value = t.codigo;
    document.getElementById('tipoProjetoCodigoInput').disabled = true; // código nunca muda depois de criado
    document.getElementById('tipoProjetoDescricaoInput').value = t.descricao;
    document.getElementById('btnSalvarTipoProjeto').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Tipo';
    document.getElementById('tipoProjetoDescricaoInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparFormularioTipoProjeto() {
    document.getElementById('tipoProjetoIdInput').value = '';
    document.getElementById('tipoProjetoCodigoInput').value = '';
    document.getElementById('tipoProjetoCodigoInput').disabled = false;
    document.getElementById('tipoProjetoDescricaoInput').value = '';
    document.getElementById('btnSalvarTipoProjeto').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Criar Tipo';
}

async function salvarTipoProjeto() {
    const id = document.getElementById('tipoProjetoIdInput').value;
    if (!id && !usuarioPodeIncluirTela('tipos_projeto')) return alert('Você não tem permissão para incluir tipos de projeto.');
    if (id && !usuarioPodeAlterarTela('tipos_projeto')) return alert('Você não tem permissão para alterar tipos de projeto.');

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

    if (id) {
        // Reconfere no momento de salvar — pode ter entrado em uso enquanto
        // o formulário estava aberto.
        if (await tipoProjetoEstaEmUso(Number(id))) {
            limparFormularioTipoProjeto();
            await renderTiposProjetoView();
            return alert('⛔ Este Tipo de Projeto passou a ser usado por um projeto enquanto você editava e não pode mais ser alterado.');
        }
        const { error } = await _supabase.from('tipos_projeto').update({ descricao }).eq('id', Number(id));
        if (error) return alert('Erro ao atualizar o Tipo de Projeto: ' + error.message);
        alert('✅ Tipo de Projeto atualizado com sucesso!');
    } else {
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
    }

    limparFormularioTipoProjeto();
    await renderTiposProjetoView();
    mudarAbaTiposProjeto('cadastrados');
}

async function alternarAtivoTipoProjeto(id) {
    const t = tiposProjetoCache.find(x => x.id === id);
    if (!t) return;
    if (t.ativo && !usuarioPodeDeletarTela('tipos_projeto')) return alert('Você não tem permissão para inativar tipos de projeto.');
    if (!t.ativo && !usuarioPodeAlterarTela('tipos_projeto')) return alert('Você não tem permissão para reativar tipos de projeto.');

    const acao = t.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Confirma ${acao} o Tipo de Projeto "${t.codigo} - ${t.descricao}"?${t.ativo ? ' Projetos que já usam esse tipo continuam normalmente — só bloqueia escolher esse tipo em demandas novas.' : ''}`)) return;

    const { error } = await _supabase.from('tipos_projeto').update({ ativo: !t.ativo }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderTiposProjetoView();
}
