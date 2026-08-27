// =========================================================================
// adhoc/retomar-hold.js
// NOVO (a pedido do usuário 24/08/2026): tela "Retomar Projetos em Hold"
// (dentro da aba Governança) — até agora não existia NENHUM jeito de
// tirar um projeto do HOLD depois que um trade-off Extraordinário o
// colocava lá (achado na exploração: zero função/botão em todo o
// código). Lista projetos em HOLD, mostra a situação de quando foram
// parados (reaproveitando tradeoff_por/tradeoff_em/tradeoff_observacao,
// já gravados por aprovarSimulacaoAdhoc em js/adhoc/tradeoff.js), e
// retoma sempre pra "A PLANEJAR" — nunca restaura o sub_status literal
// de antes do hold (decisão explícita do usuário) nem o orçamento
// cedido (o trade-off já aprovado é tratado como definitivo).
// =========================================================================

let projetoSelecionadoRetomada = null;

function renderRetomarHoldView() {
    const tbody = document.getElementById('retomarHoldTableBody');
    if (!tbody) return;
    fecharPainelRetomadaHold();

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const projetosHold = filtrarProjetosPorArea((projectsData || [])
        .filter(p => (p.sub_status || '').toUpperCase() === 'HOLD')
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR')), 'retomar_hold');

    if (projetosHold.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em Hold no momento</td></tr>`;
        return;
    }

    tbody.innerHTML = projetosHold.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-purple-700">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3">${p.area || '-'}</td>
            <td class="p-3 font-mono">${p.tradeoff_em ? p.tradeoff_em.split('T')[0] : '-'}</td>
            <td class="p-3 uppercase">${p.tradeoff_por || '-'}</td>
            <td class="p-3 text-center">
                <button onclick="selecionarProjetoRetomada('${p.codigo}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                    <i class="fa-solid fa-play"></i> Retomar
                </button>
            </td>
        </tr>
    `).join('');
}

function selecionarProjetoRetomada(codigo) {
    const p = (projectsData || []).find(x => x.codigo === codigo);
    if (!p) return;
    projetoSelecionadoRetomada = p;

    document.getElementById('retomarHoldCodigoHidden').value = codigo;
    document.getElementById('retomarHoldCodigo').innerText = p.codigo;
    document.getElementById('retomarHoldNome').innerText = p.nome;
    document.getElementById('retomarHoldEtapa').innerText = p.etapa_atual || 'BUSINESS CASE';
    document.getElementById('retomarHoldSituacaoAnterior').innerText = p.sub_status_antes_hold || '(não registrado)';
    document.getElementById('retomarHoldDetalheHold').innerText =
        `${p.tradeoff_por || '-'} em ${p.tradeoff_em ? p.tradeoff_em.split('T')[0] : '-'}` +
        (p.tradeoff_observacao ? ` — ${p.tradeoff_observacao}` : '');

    document.getElementById('retomarHoldPainelConfirmacao').classList.remove('hidden');
}

function fecharPainelRetomadaHold() {
    projetoSelecionadoRetomada = null;
    const painel = document.getElementById('retomarHoldPainelConfirmacao');
    if (painel) painel.classList.add('hidden');
}

async function confirmarRetomadaHold() {
    if (!projetoSelecionadoRetomada) return;
    const p = projetoSelecionadoRetomada;

    if (!confirm(`Confirma a retomada de ${p.codigo} - ${p.nome}?\n\nEle voltará pra fase ${p.etapa_atual || 'BUSINESS CASE'} com o status "A Planejar". O orçamento já cedido no trade-off NÃO é devolvido.`)) {
        return;
    }

    const agora = new Date().toISOString();
    const responsavel = currentUser ? currentUser.nome : 'desconhecido';
    const subStatusAnterior = p.sub_status_antes_hold || null;

    const { error } = await _supabase.from('projetos').update({ sub_status: 'A PLANEJAR' }).eq('codigo', p.codigo);
    if (error) return alert('Erro ao retomar o projeto: ' + error.message);

    p.sub_status = 'A PLANEJAR';

    const { error: errorLog } = await _supabase.from('log_retomada_hold').insert([{
        projeto_codigo: p.codigo,
        etapa_atual: p.etapa_atual || 'BUSINESS CASE',
        sub_status_anterior: subStatusAnterior,
        retomado_por: responsavel,
        retomado_em: agora
    }]);
    if (errorLog) console.error('Retomada concluída, mas houve erro ao gravar o log:', errorLog.message);

    alert(`✅ ${p.codigo} retomado com sucesso — voltou pra "A Planejar" na fase ${p.etapa_atual || 'BUSINESS CASE'}.`);
    renderRetomarHoldView();
}
