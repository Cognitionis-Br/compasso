// =========================================================================
// approvals/comite.js
// Aprovação individual de cada projeto pelo Comitê: lista projetos com
// orçamento realizado, modal de aprovação (data, comitê, aprovador) e
// reprovação.
//
// GAP JÁ CONHECIDO (ver Auditoria_Tecnica.md): aprovador_nome vem
// de currentUser.nome, mas hoje qualquer usuário loga como "Administrador
// do Sistema" (login não autentica de verdade) — ou seja, o campo "Por"
// não reflete quem de fato aprovou. Preservado como estava; será corrigido
// junto da autenticação real.
// =========================================================================
function renderAprovComiteView() {
    const tbody = document.getElementById('comiteTableBody');
    if (!tbody) return;

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const comiteDemandas = filtrarProjetosPorArea(projectsData.filter(p =>
        p.etapa_atual === 'BUSINESS CASE' &&
        (p.sub_status === 'ORÇAMENTO REALIZADO' || p.sub_status === 'APROVADO' || p.sub_status === 'REPROVADO')
    ), 'aprov_comite').sort((a, b) => {
        // NOVO (item 6, novos ajustes): ordena por Status (sub_status)
        // crescente, depois Código crescente.
        const statusA = (a.sub_status || '').toUpperCase(), statusB = (b.sub_status || '').toUpperCase();
        if (statusA !== statusB) return statusA.localeCompare(statusB, 'pt-BR');
        return (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR');
    });

    if (comiteDemandas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto aguardando aprovação individual do comitê</td></tr>`;
        return;
    }

    tbody.innerHTML = comiteDemandas.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-amber-800">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 font-bold">${p.area || '-'}</td>
            <td class="p-3">${p.tipo_orcamento || 'CAPEX'}</td>
            <td class="p-3 font-mono font-bold text-right text-red-700">R$ ${(Number(p.previsto)||Number(p.val_bc)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="p-3 text-gray-600">
                ${p.dt_aprovacao ? `<b>Aprovado em:</b> ${p.dt_aprovacao}<br><b>Comitê:</b> ${p.dt_comite || '-'}<br><b>Por:</b> ${escapeHtml(p.aprovador_nome) || '-'}` : '<span class="italic text-gray-400">Pendente registro</span>'}
            </td>
            <td class="p-3 text-center space-x-1">
                ${p.sub_status === 'APROVADO' ? '<span class="bg-green-600 text-white font-bold px-2.5 py-1 rounded">APROVADO</span>' :
                  p.sub_status === 'REPROVADO' ? '<span class="bg-red-600 text-white font-bold px-2.5 py-1 rounded">REPROVADO</span>' :
                  // AJUSTADO (Controle de acesso por atividade, Fase 4):
                  // aprovação/reprovação/reavaliação individual de projeto
                  // no comitê -> activity_key "aprov_comite".
                  (botaoSeTemAtividade('aprov_comite',
                    `<button onclick="abrirModalAprovComite('${p.codigo}')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-2.5 py-1 rounded shadow"><i class="fa-solid fa-check"></i> Aprovar</button>
                     <button onclick="abrirModalReprovComite('${p.codigo}')" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-2.5 py-1 rounded shadow"><i class="fa-solid fa-xmark"></i> Reprovar</button>
                     <button onclick="abrirModalReavalComite('${p.codigo}')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-2.5 py-1 rounded shadow"><i class="fa-solid fa-rotate-left"></i> Reavaliar</button>`
                  ) || '<span class="text-gray-400 italic text-[10px]">Sem permissão para aprovar</span>')
                }
            </td>
        </tr>
    `).join('');
}

function abrirModalAprovComite(codigo) {
    abrirModalDecisaoComite(codigo, 'APROVAR');
}

function abrirModalReprovComite(codigo) {
    abrirModalDecisaoComite(codigo, 'REPROVAR');
}

// NOVO (item 2, ajustes solicitados): terceira opção "Reavaliar" — em vez
// de aprovar/reprovar o orçamento definido, devolve o projeto pra 99% de
// evolução em REALIZAR ORÇAMENTO, liberando o valor pra ser reajustado.
// Ver confirmarDecisaoComite (modo REAVALIAR) pro que isso grava de fato.
function abrirModalReavalComite(codigo) {
    abrirModalDecisaoComite(codigo, 'REAVALIAR');
}

// NOVO 10/08/2026 (item 2 do relatório de testes): aprovação e
// reprovação agora usam o MESMO modal, capturando os mesmos dados nos
// dois casos (data, comitê, responsável, observação) — antes, reprovar
// era só um confirm() simples, sem registrar nada disso.
// AJUSTADO (item 2, ajustes solicitados): terceiro modo REAVALIAR,
// reaproveitando o mesmo modal — o campo de Observação vira o "motivo"
// registrado no log desta ocorrência (ver logDecisaoEtapa).
function abrirModalDecisaoComite(codigo, modo) {
    const prj = projectsData.find(p => p.codigo === codigo);
    if (!prj) return;

    document.getElementById('aprovPrjCodigoHidden').value = prj.codigo;
    document.getElementById('aprovPrjModoHidden').value = modo;
    document.getElementById('aprovPrjNomeDisplay').value = `${prj.codigo} - ${prj.nome}`;
    document.getElementById('aprovPrjDtAprov').value = new Date().toISOString().split('T')[0];
    document.getElementById('aprovPrjDtComite').value = new Date().toISOString().split('T')[0];
    document.getElementById('aprovPrjNomeAprovador').value = currentUser ? currentUser.nome : '';
    document.getElementById('aprovPrjObservacao').value = '';

    const ehAprovacao = modo === 'APROVAR';
    const ehReavaliacao = modo === 'REAVALIAR';
    document.getElementById('aprovModalTitulo').innerText = ehAprovacao ? 'Aprovar Projeto (Individual)' : ehReavaliacao ? 'Reavaliar Orçamento do Projeto' : 'Reprovar Projeto (Individual)';
    document.getElementById('aprovLabelData').innerText = ehAprovacao ? 'Data Aprovação *' : ehReavaliacao ? 'Data Reavaliação *' : 'Data Reprovação *';
    document.getElementById('aprovLabelResponsavel').innerText = ehAprovacao ? 'Nome Aprovador *' : ehReavaliacao ? 'Nome de Quem Reavaliou *' : 'Nome de Quem Reprovou *';
    const btn = document.getElementById('aprovBtnConfirmar');
    btn.innerText = ehAprovacao ? 'Confirmar Aprovação' : ehReavaliacao ? 'Confirmar Reavaliação' : 'Confirmar Reprovação';
    btn.className = ehAprovacao
        ? 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition'
        : ehReavaliacao
            ? 'px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition'
            : 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition';

    document.getElementById('modalAprovacaoComite').classList.remove('hidden');
}

function fecharModalAprovComite() {
    document.getElementById('modalAprovacaoComite').classList.add('hidden');
}

async function confirmarDecisaoComite() {
    const codigo = document.getElementById('aprovPrjCodigoHidden').value;
    const modo = document.getElementById('aprovPrjModoHidden').value;
    const dt = document.getElementById('aprovPrjDtAprov').value;
    const dt_comite = document.getElementById('aprovPrjDtComite').value;
    const nomeResponsavel = document.getElementById('aprovPrjNomeAprovador').value.trim().toUpperCase();
    const observacao_comite = document.getElementById('aprovPrjObservacao').value.trim();

    if (!dt || !dt_comite || !nomeResponsavel) {
        return alert("Por favor, preencha todos os campos obrigatórios!");
    }

    // Data do Comitê/decisão não pode ser futura.
    const hojeStr = new Date().toISOString().split('T')[0];
    if (dt_comite > hojeStr) {
        return alert("⛔ A data do Comitê não pode ser maior que a data de hoje!");
    }
    if (dt > hojeStr) {
        return alert("⛔ A data não pode ser maior que a data de hoje!");
    }

    const ehAprovacao = modo === 'APROVAR';
    const ehReavaliacao = modo === 'REAVALIAR';

    // NOVO (item 2, ajustes solicitados): Reavaliar não é uma decisão de
    // comitê como Aprovar/Reprovar — devolve a etapa REALIZAR ORÇAMENTO
    // pra 99% de evolução (em vez de reprovar de vez, ou aprovar sem
    // reajustar), liberando o projeto pra passar de novo pela Evolução
    // genérica (js/phases/generic-workflow-ui.js) e redefinir o valor de
    // orçamento — o mesmo modal de Evolução já permite reajustar
    // classificação/valor/porte a cada nova marcação de 100%.
    if (ehReavaliacao) {
        if (!observacao_comite) {
            return alert('Informe o motivo da reavaliação no campo Observação — ele fica registrado no log desta ocorrência.');
        }
        if (!confirm(`Confirma REAVALIAR o orçamento do projeto ${codigo}?\n\nA evolução de "Realizar Orçamento" volta para 99% e o projeto sai da lista de aprovação do comitê até que o orçamento seja redefinido e marcado 100% novamente.`)) return;

        const etapaOrcamento = obterEtapaPorNome('REALIZAR ORÇAMENTO');
        if (!etapaOrcamento) return alert('Etapa "REALIZAR ORÇAMENTO" não encontrada em fases_etapas.');

        const { error: errorEtapa } = await _supabase.from('projeto_etapas').update({
            percentual_evolucao: 99,
            situacao: 'EXECUCAO_EM_ANDAMENTO'
        }).eq('projeto_codigo', codigo).eq('etapa_id', etapaOrcamento.id);
        if (errorEtapa) return alert('Erro ao reabrir a etapa de orçamento: ' + errorEtapa.message);

        const payloadReaval = { sub_status: 'PLANEJADO', status_comite: 'PENDENTE' };
        const { error: errorProjetoReaval } = await _supabase.from('projetos').update(payloadReaval).eq('codigo', codigo);
        if (errorProjetoReaval) return alert('Erro ao reabrir o projeto para reavaliação: ' + errorProjetoReaval.message);

        const prjReaval = projectsData.find(p => p.codigo === codigo);
        if (prjReaval) Object.assign(prjReaval, payloadReaval);

        // Log persistente da ocorrência (mesma tabela/função usada pelas
        // decisões Aprovado/Reprovado do motor genérico) — marca as
        // situações: quem reavaliou, quando e o motivo informado.
        await logDecisaoEtapa(codigo, 'BUSINESS CASE', 'REALIZAR ORÇAMENTO', 'REAVALIAR', `${nomeResponsavel} (Data: ${dt}, Comitê: ${dt_comite}): ${observacao_comite}`);

        alert(`✅ Projeto ${codigo} devolvido para reavaliação do orçamento (evolução voltou para 99%).`);
        fecharModalAprovComite();
        await loadProjects();
        renderAprovComiteView();
        return;
    }

    // Mesmos campos capturados nos dois casos (item 2 do relatório de
    // testes) — só o nome dos campos de data/responsável muda pra
    // deixar claro qual decisão foi tomada, sem confundir um "aprovador"
    // com quem reprovou.
    const payload = ehAprovacao
        ? { status_comite: 'APROVADO', sub_status: 'APROVADO', dt_aprovacao: dt, dt_comite, aprovador_nome: nomeResponsavel, observacao_comite }
        : { status_comite: 'REPROVADO', sub_status: 'REPROVADO', dt_reprovacao: dt, dt_comite, resp_reprovacao: nomeResponsavel, observacao_comite };

    if (!ehAprovacao && !confirm(`Confirma a REPROVAÇÃO do projeto ${codigo}?`)) return;

    let { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert("Erro ao salvar a decisão: " + error.message);

    const prj = projectsData.find(p => p.codigo === codigo);
    if (prj) Object.assign(prj, payload);

    // NOVO (item 1, novos ajustes): disparo de e-mail — pontos 3/4
    // (aprovar/reprovar Orçamento por Projeto). Essa decisão não tem
    // responsável de etapa próprio (é uma decisão de comitê) — só
    // funciona se a linha do fluxo estiver configurada com e-mail fixo.
    await dispararEmailFluxo('BUSINESS CASE', 'APROVAR ORÇAMENTO POR PROJETO', ehAprovacao ? 'Após aprovar orçamento por projeto' : 'Após reprovar orçamento por projeto', prj, {});

    alert(`✅ Projeto ${codigo} ${ehAprovacao ? 'APROVADO' : 'REPROVADO'} com sucesso no comitê!`);
    fecharModalAprovComite();
    await loadProjects();
    renderAprovComiteView();
}
