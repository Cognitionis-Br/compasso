// =========================================================================
// tipos-projeto/return-benefit.js
// Cadastro de Return / Benefit — Tabela 1 usada pelo quadro "Benefit
// Results" da demanda (Business Case). Nome editável, ativo/inativo, e o
// parâmetro "permite_valor": controla se, ao escolher esse tipo no quadro
// da demanda, é possível informar um valor de NPV ou ROI (ver
// js/projects/core.js — onChangeBenefitTipoDemanda).
// =========================================================================

let returnBenefitCache = [];

// AJUSTADO (padronização de telas, a pedido do usuário): 2 abas — Cadastrar
// Return / Benefit / Return / Benefit Cadastrados — mesmo padrão de mudarAbaCargos.
function mudarAbaReturnBenefit(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`returnBenefitBtn-${a}`);
        const painel = document.getElementById(`returnBenefitPainel-${a}`);
        if (btn) btn.className = `return-benefit-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('return_benefit', 'returnBenefitBtn');
}

async function renderReturnBenefitView() {
    const { data, error } = await _supabase.from('tipos_return_benefit').select('*').order('nome');
    returnBenefitCache = error ? [] : (data || []);

    const tbody = document.getElementById('returnBenefitTableBody');
    if (!tbody) return;

    if (returnBenefitCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum Return / Benefit cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = returnBenefitCache.map(rb => `
        <tr class="${!rb.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-semibold">${escapeHtml(rb.nome)}</td>
            <td class="p-3 text-center">${rb.permite_valor ? '<span class="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Sim</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Não</span>'}</td>
            <td class="p-3 text-[10px] text-gray-400">${rb.atualizado_por || rb.criado_por || '-'} · ${(rb.atualizado_em || rb.criado_em) ? new Date(rb.atualizado_em || rb.criado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-3 text-center">${rb.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center space-x-2">
                ${botaoSePodeAlterar('return_benefit', `<button onclick="editarReturnBenefit(${rb.id})" class="text-indigo-600 hover:text-indigo-800 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>`)}
                ${botaoSePodeAtivarInativar('return_benefit', `<button onclick="alternarAtivoReturnBenefit(${rb.id})" class="text-amber-600 hover:text-amber-800 font-bold"><i class="fa-solid fa-power-off"></i></button>`)}
            </td>
        </tr>
    `).join('');
}

function limparFormReturnBenefit() {
    document.getElementById('rbIdHidden').value = '';
    document.getElementById('rbNomeInput').value = '';
    const radioSim = document.querySelector('input[name="rbPermiteValor"][value="sim"]');
    if (radioSim) radioSim.checked = true;
}

function editarReturnBenefit(id) {
    const rb = returnBenefitCache.find(x => x.id === id);
    if (!rb) return;
    mudarAbaReturnBenefit('criar');
    document.getElementById('rbIdHidden').value = rb.id;
    document.getElementById('rbNomeInput').value = rb.nome;
    const radio = document.querySelector(`input[name="rbPermiteValor"][value="${rb.permite_valor ? 'sim' : 'nao'}"]`);
    if (radio) radio.checked = true;
}

async function salvarReturnBenefit() {
    const id = document.getElementById('rbIdHidden').value;
    if (!id && !usuarioPodeIncluirTela('return_benefit')) return alert('Você não tem permissão para incluir Return / Benefit.');
    if (id && !usuarioPodeAlterarTela('return_benefit')) return alert('Você não tem permissão para alterar Return / Benefit.');
    const nome = document.getElementById('rbNomeInput').value.trim();
    const radioPermite = document.querySelector('input[name="rbPermiteValor"]:checked');
    const permiteValor = !radioPermite || radioPermite.value === 'sim';

    if (!nome) {
        return alert('Informe o nome do Return / Benefit!');
    }
    if (nome.length > 80) {
        return alert('O nome precisa ter no máximo 80 caracteres!');
    }

    const duplicado = returnBenefitCache.some(rb => (!id || rb.id !== Number(id)) && rb.nome.toUpperCase() === nome.toUpperCase());
    if (duplicado) {
        return alert(`⛔ Já existe um Return / Benefit chamado "${nome}".`);
    }

    const agora = new Date().toISOString();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const payload = { nome, permite_valor: permiteValor, atualizado_por: quem, atualizado_em: agora };

    let error;
    if (id) {
        ({ error } = await _supabase.from('tipos_return_benefit').update(payload).eq('id', id));
    } else {
        payload.criado_por = quem;
        payload.criado_em = agora;
        ({ error } = await _supabase.from('tipos_return_benefit').insert([payload]));
    }
    if (error) return alert('Erro ao salvar o Return / Benefit: ' + error.message);

    alert('✅ Return / Benefit salvo com sucesso!');
    limparFormReturnBenefit();
    await renderReturnBenefitView();
    mudarAbaReturnBenefit('cadastrados');
}

async function alternarAtivoReturnBenefit(id) {
    const rb = returnBenefitCache.find(x => x.id === id);
    if (!rb) return;
    if (rb.ativo && !usuarioPodeDeletarTela('return_benefit')) return alert('Você não tem permissão para inativar Return / Benefit.');
    if (!rb.ativo && !usuarioPodeAlterarTela('return_benefit')) return alert('Você não tem permissão para reativar Return / Benefit.');

    if (rb.ativo) {
        // Só pode inativar se ainda não estiver em uso — mesmo padrão do
        // Pilar Estratégico (planejamento-estrategico.js).
        const { count: emUsoCount, error: errorUso } = await _supabase.from('projeto_benefit_results').select('id', { count: 'exact', head: true }).eq('tipo_return_benefit_id', id);
        if (errorUso) return alert('Erro ao checar o uso do Return / Benefit: ' + errorUso.message);
        if (emUsoCount > 0) {
            return alert(`⛔ Este Return / Benefit já está em uso por ${emUsoCount} demanda(s) — não pode ser inativado.`);
        }
        if (!confirm(`Confirma a inativação do Return / Benefit "${rb.nome}"?`)) return;
    }

    const payload = { ativo: !rb.ativo, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() };
    const { error } = await _supabase.from('tipos_return_benefit').update(payload).eq('id', id);
    if (error) return alert('Erro ao atualizar o Return / Benefit: ' + error.message);
    await renderReturnBenefitView();
}
