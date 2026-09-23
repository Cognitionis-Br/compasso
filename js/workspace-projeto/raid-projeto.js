// =========================================================================
// workspace-projeto/raid-projeto.js
// Compasso 2.0 — Release 3, aba Riscos e Ocorrências do Workspace (RAID:
// Risco/Problema/Impedimento/Decisão). Backed pela tabela `raid_items`
// (sql/2026-09-23_r3_raid.sql), RLS por acesso ao projeto (Release 2).
// =========================================================================

const RAID_TIPO_LABELS = { RISCO: 'Risco', PROBLEMA: 'Problema', IMPEDIMENTO: 'Impedimento', DECISAO: 'Decisão' };
const RAID_TIPO_CORES = { RISCO: 'amber', PROBLEMA: 'danger', IMPEDIMENTO: 'orange', DECISAO: 'blue' };
const RAID_STATUS_LABELS = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', RESOLVIDO: 'Resolvido', CANCELADO: 'Cancelado' };

let _raidProjetoCodigo = null;

async function renderRaidProjeto(projetoCodigo, wrapperElId) {
    _raidProjetoCodigo = projetoCodigo;
    await _raidRenderLista(wrapperElId);
}

async function _raidRenderLista(wrapperElId) {
    const wrapper = document.getElementById(wrapperElId || 'wsRaidBody');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const { data: itens, error } = await _supabase.from('raid_items').select('*').eq('projeto_codigo', _raidProjetoCodigo).order('criado_em', { ascending: false });
    if (error) { wrapper.innerHTML = `<p class="text-xs text-danger-600 py-4 text-center">Erro ao carregar: ${escapeHtml(error.message)}</p>`; return; }

    const lista = itens || [];
    wrapper.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-black uppercase text-gray-500">Riscos, Problemas, Impedimentos e Decisões</h4>
            <button onclick="abrirModalRaid()" class="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded"><i class="fa-solid fa-plus"></i> Novo Item</button>
        </div>
        <div class="space-y-2">
            ${lista.length === 0 ? '<p class="text-xs text-gray-400 italic py-6 text-center">Nenhum item registrado ainda.</p>' : lista.map(i => `
                <div class="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer" onclick="abrirModalRaid(${i.id})">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-0.5">
                            ${renderBadgeStatus(RAID_TIPO_CORES[i.tipo] || 'gray', null, RAID_TIPO_LABELS[i.tipo] || i.tipo)}
                            ${i.impacto ? renderBadgeStatus(i.impacto === 'ALTA' ? 'danger' : (i.impacto === 'MEDIA' ? 'amber' : 'gray'), null, 'Impacto ' + i.impacto) : ''}
                        </div>
                        <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(i.titulo)}</div>
                        <div class="text-[10px] text-gray-400">${i.prazo ? formatDate(i.prazo) : 'Sem prazo'}</div>
                    </div>
                    ${renderBadgeStatus(i.status === 'RESOLVIDO' ? 'emerald' : (i.status === 'CANCELADO' ? 'gray' : 'blue'), null, RAID_STATUS_LABELS[i.status] || i.status)}
                </div>
            `).join('')}
        </div>
    `;
}

let _raidEditandoId = null;

function abrirModalRaid(id) {
    _raidEditandoId = id || null;
    const item = id ? null : null; // preenchido abaixo se editando
    document.getElementById('raidModalTitulo').innerText = id ? 'Editar Item RAID' : 'Novo Item RAID';
    if (id) {
        _supabase.from('raid_items').select('*').eq('id', id).maybeSingle().then(({ data }) => {
            if (!data) return;
            document.getElementById('raidTipoInput').value = data.tipo;
            document.getElementById('raidTituloInput').value = data.titulo;
            document.getElementById('raidDescricaoInput').value = data.descricao || '';
            document.getElementById('raidProbabilidadeInput').value = data.probabilidade || '';
            document.getElementById('raidImpactoInput').value = data.impacto || '';
            document.getElementById('raidStatusInput').value = data.status;
            document.getElementById('raidPrazoInput').value = data.prazo || '';
        });
    } else {
        document.getElementById('raidTipoInput').value = 'RISCO';
        document.getElementById('raidTituloInput').value = '';
        document.getElementById('raidDescricaoInput').value = '';
        document.getElementById('raidProbabilidadeInput').value = '';
        document.getElementById('raidImpactoInput').value = '';
        document.getElementById('raidStatusInput').value = 'ABERTO';
        document.getElementById('raidPrazoInput').value = '';
    }
    document.getElementById('modalRaid').classList.remove('hidden');
}

function fecharModalRaid() {
    document.getElementById('modalRaid').classList.add('hidden');
}

async function salvarRaid() {
    const titulo = document.getElementById('raidTituloInput').value.trim();
    if (!titulo) return alert('Informe o título.');

    const payload = {
        projeto_codigo: _raidProjetoCodigo,
        tipo: document.getElementById('raidTipoInput').value,
        titulo,
        descricao: document.getElementById('raidDescricaoInput').value.trim() || null,
        probabilidade: document.getElementById('raidProbabilidadeInput').value || null,
        impacto: document.getElementById('raidImpactoInput').value || null,
        status: document.getElementById('raidStatusInput').value,
        prazo: document.getElementById('raidPrazoInput').value || null
    };
    if (payload.status === 'RESOLVIDO') payload.resolvido_em = new Date().toISOString();

    let error;
    if (_raidEditandoId) {
        ({ error } = await _supabase.from('raid_items').update(payload).eq('id', _raidEditandoId));
    } else {
        payload.criado_por = currentUser.id;
        ({ error } = await _supabase.from('raid_items').insert([payload]));
    }
    if (error) return alert('Erro ao salvar: ' + error.message);
    fecharModalRaid();
    await _raidRenderLista();
}
