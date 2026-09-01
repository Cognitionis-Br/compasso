// =========================================================================
// pessoas/pessoas-solicitantes.js
// Cadastro de Pessoas Solicitantes (item 1-b da lista de ajustes do
// usuário, 10/08/2026): nome, e-mail (opcional), área — em ordem
// alfabética, exclusão lógica. Usado para popular o seletor de
// "Pessoa Solicitante" na tela de Nova Demanda, filtrado pela área
// escolhida.
//
// AJUSTADO (padronização de telas, a pedido do usuário): 2 abas — Cadastrar
// Pessoa Solicitante / Pessoas Solicitantes Cadastradas.
// =========================================================================

function mudarAbaPessoasSolicitantes(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`pessoasSolicitantesBtn-${a}`);
        const painel = document.getElementById(`pessoasSolicitantesPainel-${a}`);
        if (btn) btn.className = `pessoas-solicitantes-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('pessoas_solicitantes', 'pessoasSolicitantesBtn');
}

async function loadPessoasSolicitantes() {
    const { data, error } = await _supabase.from('pessoas_solicitantes').select('*').order('nome');
    pessoasSolicitantesData = error ? [] : (data || []);
    // NOVO (item 4 do relatório de melhorias): ordem alfabética de nome
    // e área — o banco já ordena por nome, isso garante área como
    // critério de desempate (dois nomes iguais em áreas diferentes).
    pessoasSolicitantesData.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR') || (a.area || '').localeCompare(b.area || '', 'pt-BR'));
    renderPessoasSolicitantesTable();
    popularAreaSelectPessoa();
}

function pessoasSolicitantesAtivas() {
    return pessoasSolicitantesData.filter(p => p.ativo !== false);
}

function popularAreaSelectPessoa() {
    const sel = document.getElementById('pessoaAreaInput');
    if (!sel) return;
    const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
    areasAtivas().forEach(a => {
        const nomeUpper = (a.nome || '').toUpperCase();
        options.push(`<option value="${nomeUpper}">${nomeUpper}</option>`);
    });
    sel.innerHTML = options.join('');
}

function renderPessoasSolicitantesTable() {
    const tbody = document.getElementById('tablePessoasSolicitantesBody');
    if (!tbody) return;

    if (pessoasSolicitantesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhuma pessoa solicitante cadastrada</td></tr>`;
        return;
    }

    tbody.innerHTML = pessoasSolicitantesData.map(p => {
        const inativo = p.ativo === false;
        return `
            <tr class="${inativo ? 'bg-gray-50 text-gray-400' : ''}">
                <td class="p-3 font-bold uppercase">${escapeHtml(p.nome)}</td>
                <td class="p-3">${escapeHtml(p.email) || '-'}</td>
                <td class="p-3 text-xs">${p.area}</td>
                <td class="p-3">
                    ${inativo
                        ? `<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">INATIVA</span>`
                        : `<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">ATIVA</span>`}
                </td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    ${inativo
                        ? botaoSePodeAlterar('pessoas_solicitantes', `<button onclick="reativarPessoaSolicitante(${p.id})" class="text-green-700 hover:text-green-900 text-xs font-bold"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`)
                        : botaoSePodeAlterar('pessoas_solicitantes', `<button onclick="editPessoaSolicitante(${p.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`)
                          + botaoSePodeDeletar('pessoas_solicitantes', `<button onclick="inativarPessoaSolicitante(${p.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-user-slash"></i> Inativar</button>`)}
                </td>
            </tr>
        `;
    }).join('');
}

function editPessoaSolicitante(id) {
    const p = pessoasSolicitantesData.find(x => x.id === id);
    if (!p) return;
    mudarAbaPessoasSolicitantes('criar');
    document.getElementById('pessoaIdInput').value = p.id;
    document.getElementById('pessoaNomeInput').value = p.nome;
    document.getElementById('pessoaEmailInput').value = p.email || '';
    document.getElementById('pessoaAreaInput').value = p.area;
    document.getElementById('btnSalvarPessoa').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Pessoa';
    document.getElementById('pessoaNomeInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function savePessoaSolicitante(e) {
    e.preventDefault();
    const id = document.getElementById('pessoaIdInput').value;
    if (!id && !usuarioPodeIncluirTela('pessoas_solicitantes')) return alert('Você não tem permissão para incluir pessoas solicitantes.');
    if (id && !usuarioPodeAlterarTela('pessoas_solicitantes')) return alert('Você não tem permissão para alterar pessoas solicitantes.');
    const nome = document.getElementById('pessoaNomeInput').value.trim().toUpperCase();
    const email = document.getElementById('pessoaEmailInput').value.trim();
    const area = document.getElementById('pessoaAreaInput').value;

    if (!nome || !area) {
        return alert('Preencha nome e área!');
    }

    const payload = { nome, email: email || null, area };

    if (id) {
        const { error } = await _supabase.from('pessoas_solicitantes').update(payload).eq('id', Number(id));
        if (error) return alert('Erro ao atualizar pessoa: ' + error.message);
        alert('✅ Pessoa atualizada!');
    } else {
        const { error } = await _supabase.from('pessoas_solicitantes').insert([payload]);
        if (error) return alert('Erro ao cadastrar pessoa: ' + error.message);
        alert('✅ Pessoa cadastrada!');
    }

    document.getElementById('pessoaIdInput').value = '';
    document.getElementById('pessoaNomeInput').value = '';
    document.getElementById('pessoaEmailInput').value = '';
    document.getElementById('pessoaAreaInput').value = '';
    document.getElementById('btnSalvarPessoa').innerHTML = '<i class="fa-solid fa-plus"></i> Salvar Pessoa';

    await loadPessoasSolicitantes();
    mudarAbaPessoasSolicitantes('cadastrados');
}

async function inativarPessoaSolicitante(id) {
    if (!confirm('Deseja realmente inativar esta pessoa solicitante?')) return;
    const { error } = await _supabase.from('pessoas_solicitantes').update({
        ativo: false,
        excluido_por: currentUser ? currentUser.nome : 'desconhecido',
        excluido_em: new Date().toISOString()
    }).eq('id', id);
    if (error) return alert('Erro ao inativar: ' + error.message);
    await loadPessoasSolicitantes();
}

async function reativarPessoaSolicitante(id) {
    if (!confirm('Deseja reativar esta pessoa solicitante?')) return;
    const { error } = await _supabase.from('pessoas_solicitantes').update({ ativo: true, excluido_por: null, excluido_em: null }).eq('id', id);
    if (error) return alert('Erro ao reativar: ' + error.message);
    await loadPessoasSolicitantes();
}

// -------------------------------------------------------------------------
// Integração com a tela de Nova Demanda: filtra as pessoas solicitantes
// pela área escolhida, em ordem alfabética. Chamado pelo onchange de
// bcArea (junto com onAreaChange, que já existe).
// -------------------------------------------------------------------------
function popularPessoaSolicitantePorArea() {
    const areaSelect = document.getElementById('bcArea');
    const pessoaSelect = document.getElementById('bcPessoaResp');
    if (!areaSelect || !pessoaSelect) return;

    const areaEscolhida = areaSelect.value;
    const options = ['<option value="" selected disabled>-- SELECIONE A ÁREA PRIMEIRO --</option>'];

    if (areaEscolhida) {
        const pessoasDaArea = pessoasSolicitantesAtivas().filter(p => (p.area || '').toUpperCase() === areaEscolhida.toUpperCase());
        if (pessoasDaArea.length === 0) {
            options[0] = '<option value="" selected disabled>-- NENHUMA PESSOA CADASTRADA PARA ESTA ÁREA --</option>';
        } else {
            options[0] = '<option value="" selected disabled>-- SELECIONE --</option>';
            pessoasDaArea.forEach(p => {
                options.push(`<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`);
            });
        }
    }

    pessoaSelect.innerHTML = options.join('');
}
