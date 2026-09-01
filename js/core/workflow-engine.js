// =========================================================================
// core/workflow-engine.js
// Camada de dados do motor de workflow genérico: sequência de fases/
// etapas (fases_etapas), SLA por porte (sla_etapa_porte), e as funções
// auxiliares que as telas genéricas de Planejamento/Evolução vão usar.
//
// CORRIGIDO 10/08/2026 (Especificacao_Workflow_v4.md, seção 4.2): exclusão
// de etapa agora é lógica (inativa, não apaga), com log de quem/quando.
// O recálculo de sequência ("próxima etapa") passa a considerar só
// etapas ATIVAS — uma etapa inativada some do encadeamento de novos
// projetos, mas projetos que já passaram por ela mantêm o histórico
// intacto (a linha continua existindo, só marcada inativa).
// =========================================================================

async function loadFasesEtapas() {
    const [fasesRes, slaRes] = await Promise.all([
        _supabase.from('fases_etapas').select('*').order('ordem'),
        _supabase.from('sla_etapa_porte').select('*')
    ]);

    fasesEtapasData = fasesRes.data || [];
    slaEtapaPorteData = slaRes.data || [];

    renderFasesEtapasTable();
    if (typeof renderPrazosTable === 'function') renderPrazosTable(); // config/prazos.js — tela de consulta consolidada
}

function obterEtapaPorNome(nomeEtapa) {
    return fasesEtapasData.find(e => e.etapa === nomeEtapa) || null;
}

function obterProximaEtapa(nomeEtapaAtual) {
    const atual = obterEtapaPorNome(nomeEtapaAtual);
    if (!atual || !atual.proxima_etapa_id) return null;
    return fasesEtapasData.find(e => e.id === atual.proxima_etapa_id) || null;
}

// Lista as etapas de uma FASE (ex.: 'REQUERIMENTS'), em ordem — usada
// pelo motor genérico "consciente de fase" (Especificacao_Workflow_v4.md,
// seção 13, opção (a)) para navegar dentro de fases com múltiplas etapas
// (Requerimentos, Technical), em vez de assumir 1 fase = 1 etapa.
function obterEtapasDaFase(nomeFase) {
    return fasesEtapasData
        .filter(e => e.fase === nomeFase && e.ativo !== false)
        .sort((a, b) => a.ordem - b.ordem);
}

// -------------------------------------------------------------------------
// Alerta de variação de orçamento na conclusão de fase (Requerimentos e
// Technical — Especificacao_Workflow_v4.md, seções 5.2/5.3): compara o
// valor revisado contra o valor anterior. Variação acima de 30% = alerta
// vermelho; entre 10% e 30% = amarelo; abaixo de 10% = sem alerta.
// -------------------------------------------------------------------------
function calcularAlertaVariacaoOrcamento(valorAnterior, valorNovo) {
    const anterior = Number(valorAnterior) || 0;
    const novo = Number(valorNovo) || 0;

    if (anterior === 0) return { nivel: 'ok', percentual: 0 };

    const percentual = Math.abs(((novo - anterior) / anterior) * 100);

    if (percentual > 30) return { nivel: 'vermelho', percentual: Math.round(percentual) };
    if (percentual >= 10) return { nivel: 'amarelo', percentual: Math.round(percentual) };
    return { nivel: 'ok', percentual: Math.round(percentual) };
}

function obterSlaEtapaPorte(etapaId, porte) {
    const linha = slaEtapaPorteData.find(s => s.etapa_id === etapaId && s.porte === (porte || 'M'));
    return linha ? linha.dias_uteis : 5; // fallback conservador se ainda não parametrizado
}

// NOVO (a pedido do usuário 24/08/2026): porte deixou de ser escolhido
// manualmente e validado contra o VALOR do orçamento — passa a ser
// calculado a partir da quantidade de HORAS do projeto, contra as faixas
// cadastradas em Administração → Cadastro de Porte (portes.horas_minimo/
// horas_maximo). Centraliza aqui o que antes estava duplicado (e
// contra valor) em requirements.js e generic-workflow-ui.js.
function obterPortePorHoras(horas) {
    return (portesData || []).find(p => horas >= Number(p.horas_minimo) && horas <= Number(p.horas_maximo)) || null;
}

// Resolve "quantas horas esse projeto tem hoje" pela mais recente já
// definida (Technical > Requerimentos > Business Case) — mesmo critério
// informal já usado em vários lugares pro valor de orçamento
// (val_tech || val_req || val_bc), agora nomeado explicitamente pra
// horas e reutilizável em qualquer tela que precise exibir o total.
function horasAtuaisDoProjeto(p) {
    return Number(p.horas_tech) || Number(p.horas_req) || Number(p.horas_bc) || 0;
}

// -------------------------------------------------------------------------
// CRUD de fases_etapas
// -------------------------------------------------------------------------

function renderFasesEtapasTable() {
    const tbody = document.getElementById('tableFasesEtapasBody');
    if (!tbody) return;

    if (fasesEtapasData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhuma fase/etapa cadastrada — rode schema_motor_workflow.sql</td></tr>`;
        return;
    }

    tbody.innerHTML = fasesEtapasData.map(e => {
        const proxima = e.proxima_etapa_id ? fasesEtapasData.find(x => x.id === e.proxima_etapa_id) : null;
        const inativa = e.ativo === false;
        return `
            <tr class="${inativa ? 'bg-gray-50 text-gray-400' : ''}">
                <td class="p-2 text-center font-mono text-xs">${e.ordem}</td>
                <td class="p-2 text-xs font-bold">${e.fase}</td>
                <td class="p-2 text-xs">${e.etapa}</td>
                <td class="p-2 text-xs text-gray-500">${proxima ? proxima.etapa : '<span class="italic">— última etapa —</span>'}</td>
                <td class="p-2 text-xs text-gray-500">${e.gerente_fase_nome || '<span class="italic text-gray-400">não definido</span>'}</td>
                <td class="p-2 text-xs">
                    ${inativa
                        ? `<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">INATIVA</span>`
                        : `<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">ATIVA</span>`}
                </td>
                <td class="p-2 text-right space-x-2 whitespace-nowrap">
                    ${inativa
                        ? botaoSePodeAlterar('workflow_etapas', `<button onclick="reativarEtapa(${e.id})" class="text-green-700 hover:text-green-900 text-xs font-bold"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`)
                        : botaoSePodeAlterar('workflow_etapas', `<button onclick="editEtapa(${e.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                           <button onclick="toggleSlaEtapa(${e.id})" class="text-amber-600 hover:text-amber-800 text-xs font-bold"><i class="fa-solid fa-clock"></i> SLA</button>`)
                          + botaoSePodeDeletar('workflow_etapas', `<button onclick="deleteEtapa(${e.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash"></i></button>`)}
                </td>
            </tr>
            <tr id="slaEtapa_${e.id}" class="hidden">
                <td colspan="7" class="p-3 bg-gray-50">${renderSlaEtapaHtml(e.id)}</td>
            </tr>
        `;
    }).join('');
}

function renderSlaEtapaHtml(etapaId) {
    // CORRIGIDO 10/08/2026: usava lista fixa ['P','M','G','GG'] — não
    // deixava cadastrar SLA de PP/EG (os 2 portes novos do Cadastro de
    // Porte). Agora usa portesData, ordenado por horas mínimo (AJUSTADO
    // 24/08/2026 — era valor mínimo, porte passou a ser por horas).
    const portesOrdenados = [...(portesData || [])].sort((a, b) => a.horas_minimo - b.horas_minimo);
    const campos = portesOrdenados.map(p => {
        const linha = slaEtapaPorteData.find(s => s.etapa_id === etapaId && s.porte === p.codigo);
        const valor = linha ? linha.dias_uteis : '';
        return `
            <div>
                <label class="block text-[10px] font-bold uppercase text-gray-500">Porte ${p.codigo}</label>
                <input type="number" min="0" class="sla-etapa-input w-20 p-1 border border-gray-300 rounded text-sm" data-etapa="${etapaId}" data-porte="${p.codigo}" value="${valor}" placeholder="dias">
            </div>
        `;
    }).join('');

    return `
        <div class="flex items-end gap-4 flex-wrap">
            ${campos}
            <button onclick="salvarSlaEtapa(${etapaId})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                <i class="fa-solid fa-floppy-disk"></i> Salvar SLA
            </button>
        </div>
    `;
}

function toggleSlaEtapa(etapaId) {
    const row = document.getElementById(`slaEtapa_${etapaId}`);
    if (row) row.classList.toggle('hidden');
}

async function salvarSlaEtapa(etapaId) {
    if (!usuarioPodeAlterarTela('workflow_etapas')) return alert('Você não tem permissão para alterar o SLA das etapas.');
    const inputs = document.querySelectorAll(`.sla-etapa-input[data-etapa="${etapaId}"]`);
    const linhas = Array.from(inputs)
        .filter(i => i.value !== '')
        .map(i => ({ etapa_id: etapaId, porte: i.getAttribute('data-porte'), dias_uteis: parseInt(i.value) || 0 }));

    for (const linha of linhas) {
        const { error } = await _supabase.from('sla_etapa_porte').upsert(linha, { onConflict: 'etapa_id,porte' });
        if (error) return alert('Erro ao salvar SLA: ' + error.message);
    }

    alert('✅ SLA da etapa atualizado!');
    await loadFasesEtapas();
}

// AJUSTADO 10/08/2026 (lista de ajustes do usuário, item 3): criação de
// novas etapas e alteração de sequência ("ordem") ficam bloqueadas pela
// UI — workflow dinâmico exigiria parametrização adicional (ações por
// etapa) que ainda não existe. Só nome/e-mail do gerente e SLA continuam
// editáveis por aqui; fase/etapa/ordem só mudam por ajuste direto de
// código/banco. Exclusão continua lógica (inativa), sem mudança.
function editEtapa(id) {
    const etapa = fasesEtapasData.find(e => e.id === id);
    if (!etapa) return;
    document.getElementById('etapaIdInput').value = etapa.id;
    document.getElementById('etapaFaseInput').value = etapa.fase;
    document.getElementById('etapaNomeInput').value = etapa.etapa;
    document.getElementById('etapaOrdemInput').value = etapa.ordem;
    document.getElementById('etapaGerenteNomeInput').value = etapa.gerente_fase_nome || '';
    document.getElementById('etapaGerenteEmailInput').value = etapa.gerente_fase_email || '';
    document.getElementById('etapaRequerDecisaoInput').checked = !!etapa.requer_decisao_aprovacao;
    document.getElementById('etapaRequerOrcamentoInput').checked = !!etapa.requer_definicao_orcamento;
    document.getElementById('btnSalvarEtapa').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Etapa';
    document.getElementById('btnSalvarEtapa').classList.remove('hidden');
    const msg = document.getElementById('etapaNenhumaSelecionadaMsg');
    if (msg) msg.classList.add('hidden');
    document.getElementById('etapaGerenteNomeInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveEtapa(e) {
    e.preventDefault();
    if (!usuarioPodeAlterarTela('workflow_etapas')) return alert('Você não tem permissão para alterar fases e etapas do workflow.');
    const id = document.getElementById('etapaIdInput').value;

    if (!id) {
        return alert('⛔ A criação de novas etapas está bloqueada nesta tela — o workflow dinâmico exige parametrização adicional que ainda não existe. Etapas novas são criadas por ajuste direto de código. Você pode editar o gerente/e-mail e o SLA das etapas já existentes.');
    }

    const gerente_fase_nome = document.getElementById('etapaGerenteNomeInput').value.trim();
    const gerente_fase_email = document.getElementById('etapaGerenteEmailInput').value.trim();
    const requer_decisao_aprovacao = document.getElementById('etapaRequerDecisaoInput').checked;
    const requer_definicao_orcamento = document.getElementById('etapaRequerOrcamentoInput').checked;

    // Só estes três campos são alteráveis por aqui — fase/etapa/ordem
    // ficam travados (readonly no formulário), não fazem parte do payload.
    const payload = { gerente_fase_nome: gerente_fase_nome || null, gerente_fase_email: gerente_fase_email || null, requer_decisao_aprovacao, requer_definicao_orcamento };

    const { error } = await _supabase.from('fases_etapas').update(payload).eq('id', Number(id));
    if (error) return alert('Erro ao atualizar etapa: ' + error.message);

    document.getElementById('etapaIdInput').value = '';
    document.getElementById('etapaFaseInput').value = '';
    document.getElementById('etapaNomeInput').value = '';
    document.getElementById('etapaOrdemInput').value = '';
    document.getElementById('etapaGerenteNomeInput').value = '';
    document.getElementById('etapaGerenteEmailInput').value = '';
    document.getElementById('etapaRequerDecisaoInput').checked = false;
    document.getElementById('etapaRequerOrcamentoInput').checked = false;
    document.getElementById('btnSalvarEtapa').classList.add('hidden');
    const msg = document.getElementById('etapaNenhumaSelecionadaMsg');
    if (msg) msg.classList.remove('hidden');

    alert('✅ Etapa atualizada!');
    await loadFasesEtapas();
}

async function deleteEtapa(id) {
    if (!usuarioPodeDeletarTela('workflow_etapas')) return alert('Você não tem permissão para inativar etapas do workflow.');
    if (!confirm('Deseja realmente inativar esta etapa? Ela sairá do encadeamento do workflow para novos projetos (o histórico de projetos que já passaram por ela não é afetado).')) return;

    const { error } = await _supabase.from('fases_etapas').update({
        ativo: false,
        excluido_por: currentUser ? currentUser.nome : 'desconhecido',
        excluido_em: new Date().toISOString()
    }).eq('id', id);

    if (error) return alert('Erro ao inativar etapa: ' + error.message);

    await recalcularSequenciaEtapas();
    await loadFasesEtapas();
}

async function reativarEtapa(id) {
    if (!usuarioPodeAlterarTela('workflow_etapas')) return alert('Você não tem permissão para reativar etapas do workflow.');
    if (!confirm('Deseja reativar esta etapa? Ela volta a fazer parte do encadeamento do workflow.')) return;
    const { error } = await _supabase.from('fases_etapas').update({
        ativo: true,
        excluido_por: null,
        excluido_em: null
    }).eq('id', id);
    if (error) return alert('Erro ao reativar etapa: ' + error.message);
    await recalcularSequenciaEtapas();
    await loadFasesEtapas();
}

// Recalcula proxima_etapa_id com base na ordem atual, considerando SÓ
// etapas ativas — uma etapa inativa some do encadeamento (a próxima
// etapa ativa "pula" ela), mas continua existindo no banco para não
// quebrar o histórico de projetos que já passaram por ela. Roda depois
// de qualquer criação/edição/exclusão/reativação que possa ter mudado a
// sequência. Só escreve nas linhas cujo proxima_etapa_id realmente mudou.
async function recalcularSequenciaEtapas() {
    const { data } = await _supabase.from('fases_etapas').select('*').order('ordem');
    const ordenadas = (data || []).filter(e => e.ativo !== false);

    for (let i = 0; i < ordenadas.length; i++) {
        const proximaIdCorreta = (i + 1 < ordenadas.length) ? ordenadas[i + 1].id : null;
        if (ordenadas[i].proxima_etapa_id !== proximaIdCorreta) {
            await _supabase.from('fases_etapas').update({ proxima_etapa_id: proximaIdCorreta }).eq('id', ordenadas[i].id);
        }
    }
}
