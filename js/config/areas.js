// =========================================================================
// config/areas.js
// Cadastro de Áreas Solicitantes (tela de Parâmetros).
//
// CORRIGIDO 10/08/2026 (Especificacao_Workflow_v4.md, seção 4.1): exclusão
// agora é lógica (inativa, não apaga), com log de quem/quando.
//
// AJUSTADO 10/08/2026 (lista de ajustes do usuário, item 1): lista e
// seletor sempre em ordem alfabética por nome; ao editar, a tela rola até
// o formulário.
//
// AJUSTADO (padronização de telas, a pedido do usuário): 2 abas — Cadastrar
// Área / Áreas Cadastradas — mesmo padrão de mudarAbaCargos/mudarAbaUsuarios.
// =========================================================================
function mudarAbaAreas(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`areasBtn-${a}`);
        const painel = document.getElementById(`areasPainel-${a}`);
        if (btn) btn.className = `areas-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('areas', 'areasBtn');
}

async function loadAreas() {
    const { data } = await _supabase.from('areas_solicitantes').select('*').order('nome');
    if (data && data.length > 0) {
        areasData = data;
    } else {
        areasData = [
            { id: 3, nome: 'COMERCIAL', mnemonico: 'COM', ativo: true },
            { id: 2, nome: 'FINANCEIRO', mnemonico: 'FIN', ativo: true },
            { id: 5, nome: 'GESTÃO DE RISCOS', mnemonico: 'RIS', ativo: true },
            { id: 6, nome: 'INOVAÇÃO', mnemonico: 'INO', ativo: true },
            { id: 7, nome: 'JURÍDICO', mnemonico: 'JUR', ativo: true },
            { id: 4, nome: 'OPERAÇÕES', mnemonico: 'OPE', ativo: true },
            { id: 1, nome: 'TECNOLOGIA DA INFORMAÇÃO', mnemonico: 'TII', ativo: true }
        ];
    }
    areasData.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    renderAreasTable();
    populateAreasSelect();
}

function areasAtivas() {
    return areasData.filter(a => a.ativo !== false);
}

function populateAreasSelect() {
    const sel = document.getElementById('bcArea');
    if (sel) {
        const options = ['<option value="" selected disabled>-- SELECIONE A ÁREA --</option>'];
        areasAtivas().forEach(a => {
            const nomeUpper = (a.nome || '').toUpperCase();
            const mnemUpper = (a.mnemonico || '').toUpperCase();
            options.push(`<option value="${nomeUpper}" data-mnem="${mnemUpper}">${nomeUpper} (${mnemUpper})</option>`);
        });
        sel.innerHTML = options.join('');
    }
}

function onAreaChange() {
    atualizarCodigoProjetoAutomatico();
}

function renderAreasTable() {
    const tbody = document.getElementById('tableAreasBody');
    if (tbody) {
        tbody.innerHTML = areasData.map(a => {
            const inativa = a.ativo === false;
            return `
                <tr class="${inativa ? 'bg-gray-50 text-gray-400' : ''}">
                    <td class="p-3 font-bold uppercase">${(a.nome||'').toUpperCase()}</td>
                    <td class="p-3 text-center font-mono font-bold ${inativa ? '' : 'text-indigo-700'} uppercase">${(a.mnemonico||'').toUpperCase()}</td>
                    <td class="p-3">
                        ${inativa
                            ? `<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">INATIVA</span>`
                            : `<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">ATIVA</span>`}
                    </td>
                    <td class="p-3 text-right space-x-2">
                        ${inativa
                            ? `<button onclick="reativarArea(${a.id})" class="text-green-700 hover:text-green-900 text-xs font-bold"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`
                            : `<button onclick="editArea(${a.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                               <button onclick="deleteArea(${a.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash"></i> Excluir</button>`}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function editArea(id) {
    const area = areasData.find(a => a.id === id);
    if (!area) return;
    mudarAbaAreas('criar');
    document.getElementById('areaIdInput').value = area.id;
    document.getElementById('areaNomeInput').value = (area.nome || '').toUpperCase();
    document.getElementById('areaMnemonicoInput').value = (area.mnemonico || '').toUpperCase();
    document.getElementById('btnSalvarArea').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Área';
    document.getElementById('areaNomeInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveAreaSolicitante(e) {
    e.preventDefault();
    const id = document.getElementById('areaIdInput').value;
    const nome = document.getElementById('areaNomeInput').value.trim().toUpperCase();
    let mnemonico = document.getElementById('areaMnemonicoInput').value.trim().toUpperCase();
    if (!mnemonico || mnemonico.length < 3) mnemonico = nome.substring(0, 3).toUpperCase();

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário): mnemônico
    // precisa ser único — não havia checagem nenhuma antes de salvar.
    // AJUSTADO: compara só com áreas ATIVAS — uma área inativada não deve
    // travar ninguém de reusar aquele mnemônico depois (mesma regra do
    // índice único parcial no banco).
    const duplicado = areasAtivas().some(a => (!id || a.id !== Number(id)) && (a.mnemonico || '').toUpperCase() === mnemonico);
    if (duplicado) {
        return alert(`⛔ Já existe uma área usando o mnemônico "${mnemonico}". Escolha outro.`);
    }

    const payload = { nome, mnemonico };

    if (id) {
        const { error } = await _supabase.from('areas_solicitantes').update(payload).eq('id', Number(id));
        if (error) return alert("Erro ao atualizar no banco: " + error.message);
        alert("✅ ÁREA ATUALIZADA COM SUCESSO!");
    } else {
        const { error } = await _supabase.from('areas_solicitantes').insert([payload]);
        if (error) return alert("Erro ao cadastrar no banco: " + error.message);
        alert("✅ ÁREA CADASTRADA COM SUCESSO!");
    }

    document.getElementById('areaIdInput').value = '';
    document.getElementById('areaNomeInput').value = '';
    document.getElementById('areaMnemonicoInput').value = '';
    document.getElementById('btnSalvarArea').innerHTML = '<i class="fa-solid fa-plus"></i> Salvar Área';

    await loadAreas();
    mudarAbaAreas('cadastrados');
}

// Exclusão lógica: inativa e loga quem/quando, em vez de apagar.
async function deleteArea(id) {
    if (!id || !confirm("Deseja realmente inativar esta área? Ela deixará de aparecer para novas demandas.")) return;

    const { error } = await _supabase.from('areas_solicitantes').update({
        ativo: false,
        excluido_por: currentUser ? currentUser.nome : 'desconhecido',
        excluido_em: new Date().toISOString()
    }).eq('id', id);

    if (error) return alert('Erro ao inativar área: ' + error.message);

    await loadAreas();
    await atualizarCodigoProjetoAutomatico();
}

async function reativarArea(id) {
    if (!confirm('Deseja reativar esta área?')) return;
    const { error } = await _supabase.from('areas_solicitantes').update({
        ativo: true,
        excluido_por: null,
        excluido_em: null
    }).eq('id', id);
    if (error) return alert('Erro ao reativar área: ' + error.message);
    await loadAreas();
}
