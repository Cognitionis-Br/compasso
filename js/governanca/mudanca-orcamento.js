// =========================================================================
// governanca/mudanca-orcamento.js
// NOVO (a pedido do usuário 27/08/2026): lista os projetos bloqueados por
// variação de orçamento acima do percentual parametrizado (Administração
// > Percentual de Bloqueio de Orçamento), na conclusão de Requerimentos
// ou de Technical (js/requirements/requirements.js,
// confirmarConclusaoFaseGenerica). Clicar em "Analisar" abre o mesmo zoom
// de projeto do Dashboard/Consultas (abrirDetalheProjeto), que mostra os
// valores originais/novos em destaque e o formulário de aprovação — ver
// renderSecaoMudancaOrcamentoDetalhe/aprovarMudancaOrcamento
// (js/projeto-detalhe/projeto-detalhe.js e abaixo).
// =========================================================================

// Qual par de fases comparar (Business Case→Requerimentos ou
// Requerimentos→Technical) — depende de qual etapa bloqueou o projeto
// (etapa_atual não muda enquanto ele está bloqueado, então ele mesmo
// indica a origem). Compartilhado entre a lista abaixo, o zoom de
// Detalhamento do Projeto (renderSecaoMudancaOrcamentoDetalhe) e o log de
// aprovação, pra não duplicar a mesma lógica em 3 lugares.
function obterValoresMudancaOrcamento(p) {
    const ehTechnical = (p.etapa_atual || '').toUpperCase() === 'TECHNICAL';
    return {
        ehTechnical,
        labelFase: ehTechnical ? 'Requerimentos → Technical' : 'Business Case → Requerimentos',
        valorReferencia: ehTechnical ? (Number(p.val_req) || 0) : (Number(p.val_bc) || 0),
        valorNovo: ehTechnical ? (Number(p.val_tech) || 0) : (Number(p.val_req) || 0),
        horasReferencia: ehTechnical ? (Number(p.horas_req) || 0) : (Number(p.horas_bc) || 0),
        horasNovo: ehTechnical ? (Number(p.horas_tech) || 0) : (Number(p.horas_req) || 0)
    };
}

async function renderMudancaOrcamentoView() {
    const tbody = document.getElementById('mudancaOrcamentoTableBody');
    if (!tbody) return;

    const candidatos = projectsData.filter(p => p.bloqueado_mudanca_orcamento === true);
    // NOVO (Controle de acesso por atividade, Fase 5 — mesmo padrão): restrição de área.
    const pendentes = filtrarProjetosPorArea(candidatos, 'mudanca_orcamento')
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    if (pendentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto aguardando aprovação de mudança de orçamento</td></tr>`;
        return;
    }

    tbody.innerHTML = pendentes.map(p => {
        const valores = obterValoresMudancaOrcamento(p);
        const alerta = calcularAlertaVariacaoOrcamento(valores.valorReferencia, valores.valorNovo);
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs">${p.area || '-'}</td>
                <td class="p-3 text-xs font-bold">${p.etapa_atual || '-'}</td>
                <td class="p-3 text-center font-bold ${alerta.nivel === 'vermelho' ? 'text-red-700' : 'text-amber-700'}">${alerta.percentual}%</td>
                <td class="p-3 text-center">
                    <button onclick="abrirDetalheProjeto('${escapeJsAttr(p.codigo)}', 'mudanca_orcamento')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                        <i class="fa-solid fa-magnifying-glass"></i> Analisar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Chamada a partir do zoom de Detalhamento do Projeto (ver
// renderSecaoMudancaOrcamentoDetalhe, js/projeto-detalhe/projeto-detalhe.js)
// quando o projeto está bloqueado. Libera o projeto pra próxima fase do
// workflow — Requerimentos bloqueado segue pra Technical, Technical
// bloqueado segue pra Execution — dependendo de qual etapa o bloqueou.
async function aprovarMudancaOrcamento(codigo) {
    const motivoInput = document.getElementById('mudancaOrcamentoMotivoInput');
    const motivo = (motivoInput ? motivoInput.value : '').trim();
    if (!motivo) return alert('Informe o motivo da aprovação!');

    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    const etapaBloqueada = (p.etapa_atual || '').toUpperCase();
    const proximaFase = etapaBloqueada === 'REQUIREMENTS' ? 'TECHNICAL'
        : etapaBloqueada === 'TECHNICAL' ? 'EXECUTION'
        : null;
    if (!proximaFase) {
        return alert('⛔ Não foi possível determinar a próxima fase do projeto — verifique a fase atual dele em Detalhamento do Projeto.');
    }

    if (!confirm(`Confirma a aprovação da continuidade de ${codigo}?\n\nMotivo: ${motivo}\n\nO projeto seguirá para a fase ${proximaFase}.`)) return;

    // NOVO (a pedido do usuário 27/08/2026): captura os valores ANTES de
    // atualizar o projeto — depois do update, etapa_atual já mudou e
    // obterValoresMudancaOrcamento não saberia mais dizer qual par de
    // fases foi realmente aprovado aqui.
    const valores = obterValoresMudancaOrcamento(p);
    const agora = new Date().toISOString();
    const aprovadoPor = currentUser ? currentUser.nome : 'desconhecido';

    const payload = {
        bloqueado_mudanca_orcamento: false,
        etapa_atual: proximaFase,
        sub_status: 'A PLANEJAR',
        mudanca_orcamento_aprovado_por: aprovadoPor,
        mudanca_orcamento_aprovado_em: agora,
        mudanca_orcamento_motivo_aprovacao: motivo
    };

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao aprovar a mudança de orçamento: ' + error.message);

    // NOVO (a pedido do usuário 27/08/2026): histórico completo, exibido
    // no zoom de Detalhamento do Projeto — os campos mudanca_orcamento_*
    // em cima só guardam a ÚLTIMA aprovação; esta linha preserva todas
    // (um projeto pode ser bloqueado mais de uma vez: uma em
    // Requerimentos, outra em Technical).
    const { error: errorLog } = await _supabase.from('log_aprovacao_mudanca_orcamento').insert([{
        projeto_codigo: codigo,
        fase_bloqueada: etapaBloqueada,
        valor_referencia: valores.valorReferencia,
        valor_novo: valores.valorNovo,
        horas_referencia: valores.horasReferencia,
        horas_novo: valores.horasNovo,
        motivo,
        aprovado_por: aprovadoPor,
        aprovado_em: agora
    }]);
    if (errorLog) console.error('Erro ao registrar log de aprovação de mudança de orçamento:', errorLog.message);

    alert(`✅ Continuidade aprovada! Projeto migrado para ${proximaFase}.`);
    await loadProjects();
    switchTab('mudanca_orcamento');
}
