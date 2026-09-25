// =========================================================================
// rate-card/rate-card.js
// Compasso 2.0 — V4 (Estimation). Tela "Rate Card": papéis e valor/hora
// usados pela Estimativa (EST-01) do Business Case
// (js/workspace-projeto/financeiro-projeto.js). Edição restrita a
// ehProprietario (mesmo padrão de js/dev-tools/) — leitura livre pra quem
// acessa a tela (catálogo 'rate_card', concedido a todas as funções).
// =========================================================================

async function renderRateCardView() {
    const { data, error } = await _supabase.from('rate_card_papeis').select('*').order('papel');
    if (error) { console.error('Erro ao carregar Rate Card:', error.message); rateCardData = []; }
    else rateCardData = data || [];

    const podeEditar = ehProprietario === true;
    const boxNovo = document.getElementById('rateCardBoxNovo');
    if (boxNovo) boxNovo.classList.toggle('hidden', !podeEditar);

    const tbody = document.getElementById('rateCardTableBody');
    if (!tbody) return;

    if (rateCardData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum papel cadastrado no Rate Card.</td></tr>`;
        return;
    }

    tbody.innerHTML = rateCardData.map(r => `
        <tr class="${r.ativo === false ? 'bg-gray-50 text-gray-400' : ''}">
            <td class="p-3 font-bold uppercase">${escapeHtml(r.papel)}</td>
            <td class="p-3 font-mono font-bold text-right">${formatCurrency(Number(r.valor_hora) || 0)}</td>
            <td class="p-3">${r.ativo === false ? renderBadgeStatus('gray', null, 'Inativo') : renderBadgeStatus('emerald', 'fa-circle-check', 'Ativo')}</td>
            <td class="p-3 text-right space-x-2 whitespace-nowrap">
                ${podeEditar ? `
                    <button onclick="editRateCardPapel(${r.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button onclick="alternarAtivoRateCardPapel(${r.id}, ${r.ativo === false})" class="text-xs font-bold ${r.ativo === false ? 'text-emerald-700 hover:text-emerald-900' : 'text-danger-600 hover:text-danger-800'}">
                        ${r.ativo === false ? '<i class="fa-solid fa-rotate-left"></i> Reativar' : '<i class="fa-solid fa-ban"></i> Inativar'}
                    </button>` : ''}
            </td>
        </tr>
    `).join('');
}

function editRateCardPapel(id) {
    const r = rateCardData.find(x => x.id === id);
    if (!r) return;
    document.getElementById('rateCardIdInput').value = r.id;
    document.getElementById('rateCardPapelInput').value = r.papel;
    document.getElementById('rateCardValorHoraInput').value = r.valor_hora;
    document.getElementById('btnSalvarRateCardPapel').innerText = 'Atualizar Papel';
}

function limparFormularioRateCardPapel() {
    document.getElementById('rateCardIdInput').value = '';
    document.getElementById('rateCardPapelInput').value = '';
    document.getElementById('rateCardValorHoraInput').value = '';
    document.getElementById('btnSalvarRateCardPapel').innerText = 'Salvar Papel';
}

async function saveRateCardPapel(e) {
    e.preventDefault();
    if (!ehProprietario) return alert('Apenas o PROPRIETÁRIO pode alterar o Rate Card.');

    const id = document.getElementById('rateCardIdInput').value;
    const papel = document.getElementById('rateCardPapelInput').value.trim();
    const valorHora = Number(document.getElementById('rateCardValorHoraInput').value);

    if (!papel) return alert('Informe o nome do papel!');
    if (!valorHora || valorHora <= 0) return alert('Informe um valor/hora válido!');

    const payload = { papel, valor_hora: valorHora, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() };

    const { error } = id
        ? await _supabase.from('rate_card_papeis').update(payload).eq('id', Number(id))
        : await _supabase.from('rate_card_papeis').insert([payload]);

    if (error) return alert('Erro ao salvar papel: ' + error.message);

    alert(id ? '✅ PAPEL ATUALIZADO COM SUCESSO!' : '✅ PAPEL CADASTRADO COM SUCESSO!');
    limparFormularioRateCardPapel();
    await renderRateCardView();
}

async function alternarAtivoRateCardPapel(id, novoAtivo) {
    if (!ehProprietario) return alert('Apenas o PROPRIETÁRIO pode alterar o Rate Card.');
    const { error } = await _supabase.from('rate_card_papeis').update({ ativo: novoAtivo }).eq('id', id);
    if (error) return alert('Erro ao atualizar papel: ' + error.message);
    await renderRateCardView();
}
