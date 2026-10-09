// =========================================================================
// config/rate-card.js
// Tela administrativa: Rate Card (Papéis e Valores/Hora).
//
// activity_key: 'rate_card' — leitura liberada a todas as funções;
// edição (criar/alterar/inativar) restrita a ehProprietario.
//
// Tabela: rate_card_papeis (id, papel, valor_hora, ativo,
//                           atualizado_por, atualizado_em)
// Criada em sql/2026-09-25_v4a_rate_card_est01.sql.
// =========================================================================

let _rcPapeis = [];

async function renderRateCardView() {
    const wrapper = document.getElementById('view-rate_card');
    if (!wrapper) return;
    wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Carregando…</p>';
    await _rcCarregar();
    _rcRender(wrapper);
}

async function _rcCarregar() {
    const { data, error } = await _supabase
        .from('rate_card_papeis')
        .select('*')
        .order('papel');
    if (error) { console.error('rate_card_papeis:', error.message); _rcPapeis = []; return; }
    _rcPapeis = data || [];
    // Invalida cache do EST-01 para que ele recarregue na próxima abertura
    if (typeof rateCardData !== 'undefined') rateCardData = [];
}

function _rcRender(wrapper) {
    const podEditar = (typeof ehProprietario !== 'undefined' && ehProprietario);

    const linhas = _rcPapeis.map(r => {
        const inativo = !r.ativo ? 'opacity-50' : '';
        return `
        <tr class="${inativo}">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900">${escapeHtml(r.papel)}</td>
            <td class="px-4 py-2.5 text-sm text-right font-mono tabular-nums">${formatCurrency(Number(r.valor_hora))}<span class="text-gray-400">/h</span></td>
            <td class="px-4 py-2.5 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">
                    ${r.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td class="px-4 py-2.5 text-xs text-gray-400">${r.atualizado_em ? new Date(r.atualizado_em).toLocaleDateString('pt-BR') : '—'}</td>
            ${podEditar ? `
            <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button onclick="_rcAbrirEditar(${r.id})"
                    class="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3">Editar</button>
                <button onclick="_rcToggleAtivo(${r.id}, ${r.ativo})"
                    class="text-xs ${r.ativo ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'} font-medium">
                    ${r.ativo ? 'Inativar' : 'Ativar'}
                </button>
            </td>` : '<td></td>'}
        </tr>`;
    }).join('');

    const semPapeis = _rcPapeis.length === 0
        ? `<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400 italic">
               Nenhum papel cadastrado. ${podEditar ? 'Use o botão acima para adicionar.' : ''}
           </td></tr>`
        : '';

    wrapper.innerHTML = `
<div class="max-w-3xl mx-auto py-6 px-4">

  <!-- Cabeçalho -->
  <div class="flex items-center justify-between mb-5">
    <div>
      <h1 class="text-xl font-bold text-gray-900">Rate Card</h1>
      <p class="text-xs text-gray-500 mt-0.5">Papéis e valores de hora usados nas estimativas (EST-01/02/03)</p>
    </div>
    ${podEditar ? `
    <button onclick="_rcAbrirNovo()"
        class="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
        <i class="fa-solid fa-plus text-xs"></i> Novo Papel
    </button>` : ''}
  </div>

  <!-- Aviso leitura -->
  ${!podEditar ? `
  <div class="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
      <i class="fa-solid fa-lock mr-1"></i> Apenas Proprietários podem editar o Rate Card.
  </div>` : ''}

  <!-- Tabela -->
  <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
    <table class="w-full">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Papel</th>
          <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor/Hora</th>
          <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Atualizado</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        ${semPapeis || linhas}
      </tbody>
    </table>
  </div>

  <p class="mt-3 text-xs text-gray-400">
      ${_rcPapeis.length} papel(is) cadastrado(s) · ${_rcPapeis.filter(r => r.ativo).length} ativo(s)
  </p>
</div>

<!-- Modal criar/editar -->
<div id="rc-modal" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
    <div class="flex justify-between items-center mb-5">
      <h2 id="rc-modal-titulo" class="text-base font-bold text-gray-900">Novo Papel</h2>
      <button onclick="_rcFecharModal()" class="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
    </div>
    <input type="hidden" id="rc-modal-id">
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-600 mb-1">Nome do Papel</label>
        <input id="rc-modal-papel" type="text" placeholder="Ex.: Analista de Negócios"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600 mb-1">Valor por Hora (R$)</label>
        <input id="rc-modal-valor" type="number" min="0" step="0.01" placeholder="0,00"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
      </div>
    </div>
    <div class="flex justify-end gap-3 mt-6">
      <button onclick="_rcFecharModal()"
          class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
      <button onclick="_rcSalvar()"
          class="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Salvar</button>
    </div>
  </div>
</div>`;
}

// ---- Ações ----

function _rcAbrirNovo() {
    document.getElementById('rc-modal-titulo').textContent = 'Novo Papel';
    document.getElementById('rc-modal-id').value = '';
    document.getElementById('rc-modal-papel').value = '';
    document.getElementById('rc-modal-valor').value = '';
    document.getElementById('rc-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('rc-modal-papel').focus(), 50);
}

function _rcAbrirEditar(id) {
    const r = _rcPapeis.find(p => p.id === id);
    if (!r) return;
    document.getElementById('rc-modal-titulo').textContent = 'Editar Papel';
    document.getElementById('rc-modal-id').value = id;
    document.getElementById('rc-modal-papel').value = r.papel;
    document.getElementById('rc-modal-valor').value = Number(r.valor_hora);
    document.getElementById('rc-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('rc-modal-papel').focus(), 50);
}

function _rcFecharModal() {
    document.getElementById('rc-modal').classList.add('hidden');
}

async function _rcSalvar() {
    const id       = document.getElementById('rc-modal-id').value;
    const papel    = document.getElementById('rc-modal-papel').value.trim();
    const valorRaw = document.getElementById('rc-modal-valor').value;
    const valor    = parseFloat(valorRaw);

    if (!papel)           { alert('Informe o nome do papel.'); return; }
    if (isNaN(valor) || valor < 0) { alert('Informe um valor/hora válido.'); return; }

    const payload = {
        papel,
        valor_hora: valor,
        atualizado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString(),
    };

    let error;
    if (id) {
        ({ error } = await _supabase.from('rate_card_papeis').update(payload).eq('id', Number(id)));
    } else {
        ({ error } = await _supabase.from('rate_card_papeis').insert([{ ...payload, ativo: true }]));
    }

    if (error) { alert('Erro: ' + error.message); return; }
    _rcFecharModal();
    const wrapper = document.getElementById('view-rate_card');
    if (wrapper) { await _rcCarregar(); _rcRender(wrapper); }
}

async function _rcToggleAtivo(id, atualAtivo) {
    const acao = atualAtivo ? 'inativar' : 'ativar';
    if (!confirm(`Confirma ${acao} este papel?`)) return;

    const { error } = await _supabase.from('rate_card_papeis')
        .update({ ativo: !atualAtivo, atualizado_em: new Date().toISOString() })
        .eq('id', id);

    if (error) { alert('Erro: ' + error.message); return; }
    const wrapper = document.getElementById('view-rate_card');
    if (wrapper) { await _rcCarregar(); _rcRender(wrapper); }
}
