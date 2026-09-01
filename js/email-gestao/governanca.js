// =========================================================================
// email-gestao/governanca.js
// Governança — Cobrança de Ajustes. Ajustado a pedido do usuário:
//
// Critérios de elegibilidade (qualquer um deles, sobre a etapa CORRENTE
// em andamento de cada projeto):
// 1. Farol crítico (calcularSaudeProjeto)
// 2. 0% de evolução passados 3 dias do início da atividade
// 3. Sem alimentação da evolução do projeto há mais de 3 dias
// 4. Vencido após a data de término planejada da atividade
//
// Fluxo: seleciona projeto(s) na lista -> escolhe um template (só os
// marcados como "de Governança" aparecem) -> envia. Sempre vai pro
// responsável cadastrado da atividade (responsavel_etapa_email).
// =========================================================================

let governancaLinhasCache = [];

async function renderGovernancaView() {
    const { data, error } = await _supabase.from('projeto_etapas').select('*');
    const todasEtapas = error ? [] : (data || []);

    const hojeStr = new Date().toISOString().split('T')[0];
    const hojeMs = new Date(hojeStr + 'T00:00:00').getTime();

    const linhas = [];
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    filtrarProjetosPorArea(projectsData, 'governanca').forEach(p => {
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'CANCELADO' || sub === 'REPROVADO' || sub === 'HOLD') return;
        if (p.projeto_concluido === true) return;

        const resultado = obterEtapaCorrenteEProgresso(p, todasEtapas);
        if (!resultado) return;
        const pe = resultado.pe;

        const motivos = [];

        if (!pe) {
            // CORRIGIDO (bug reportado: projetos em "A Planejar" no
            // Business Case, com SLA vencido no Dashboard, não
            // apareciam de jeito nenhum): esses projetos ainda não têm
            // linha de cronograma (nunca foram planejados), então os
            // critérios 2/3/4 — que dependem de data de início/término
            // planejados — não fazem sentido pra eles. Mas o critério 1
            // (Farol crítico) usa a MESMA lógica de SLA que o Dashboard
            // já usa pra esse caso (calcularSaudeProjeto tem um
            // fallback próprio pra "A Planejar" sem cronograma) — só
            // isso precisa ser checado aqui.
            const saudeSemPe = calcularSaudeProjeto(p, todasEtapas);
            if (saudeSemPe.status !== 'CRITICO') return;

            linhas.push({
                projeto: p,
                etapa: resultado.etapa,
                pe: { responsavel_etapa_nome: null, responsavel_etapa_email: null },
                saude: saudeSemPe,
                motivos: ['Farol crítico (SLA vencido — ainda não planejado)']
            });
            return;
        }

        // CORRIGIDO (bug reportado: projetos com farol crítico não
        // apareciam na lista): o estado real passa por 3 valores —
        // EXECUCAO_A_INICIAR (planejado, nunca teve evolução
        // atualizada) -> EXECUCAO_EM_ANDAMENTO (já teve ao menos 1
        // atualização) -> EXECUCAO_CONCLUIDO. O filtro só aceitava o do
        // meio, descartando projetos planejados e nunca tocados — que é
        // exatamente o caso mais comum do critério "0% de evolução
        // passados 3 dias do início". Agora só exclui quem já concluiu.
        if (pe.situacao === 'EXECUCAO_CONCLUIDO') return;

        // 1. Farol crítico.
        const saude = calcularSaudeProjeto(p, todasEtapas);
        if (saude.status === 'CRITICO') motivos.push('Farol crítico');

        // 2. 0% de evolução passados 3 dias do início da atividade.
        if ((pe.percentual_evolucao || 0) === 0 && pe.data_inicio_planejamento) {
            const diasDesdeInicio = Math.floor((hojeMs - new Date(pe.data_inicio_planejamento + 'T00:00:00').getTime()) / 86400000);
            if (diasDesdeInicio >= 3) motivos.push(`0% de evolução há ${diasDesdeInicio} dias do início`);
        }

        // 3. Sem alimentação da evolução há mais de 3 dias — usa
        // evolucao_atualizada_em (gravado em toda atualização de
        // percentual), com a data de início do planejamento como
        // referência se ainda não teve nenhuma atualização registrada.
        const referenciaAtualizacao = pe.evolucao_atualizada_em
            ? pe.evolucao_atualizada_em.split('T')[0]
            : pe.data_inicio_planejamento;
        if (referenciaAtualizacao) {
            const diasSemAtualizar = Math.floor((hojeMs - new Date(referenciaAtualizacao + 'T00:00:00').getTime()) / 86400000);
            if (diasSemAtualizar > 3) motivos.push(`Sem atualização de evolução há ${diasSemAtualizar} dias`);
        }

        // 4. Vencido após a data de término planejada da atividade.
        if (pe.data_termino_planejamento && hojeStr > pe.data_termino_planejamento) {
            motivos.push(`Vencido desde ${pe.data_termino_planejamento}`);
        }

        if (motivos.length === 0) return; // não se encaixa em nenhum critério

        linhas.push({ projeto: p, etapa: resultado.etapa, pe, saude, motivos });
    });

    governancaLinhasCache = linhas;

    // Popula o seletor só com templates marcados como "de Governança" e
    // ativos — sem isso, não tem template pra escolher.
    const { data: templatesGov } = await _supabase.from('email_templates').select('*').eq('eh_template_governanca', true).eq('ativo', true).order('assunto');
    const selectTemplate = document.getElementById('govTemplateSelect');
    if (selectTemplate) {
        selectTemplate.innerHTML = '<option value="">-- Selecione um template de governança --</option>' +
            (templatesGov || []).map(t => `<option value="${t.id}">${t.assunto}</option>`).join('');
    }

    const tbody = document.getElementById('governancaTableBody');
    if (!tbody) return;

    if (linhas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto se encaixa nos critérios no momento</td></tr>`;
        return;
    }

    // AJUSTADO (a pedido do usuário): mesmo padrão da Gestão do Fluxo de
    // E-mail — cada linha permite escolher entre o Responsável
    // cadastrado da atividade OU digitar um e-mail manualmente. Corrige
    // a situação de projetos ainda não planejados (sem responsável
    // cadastrado) — antes esses ficavam sem destinatário possível.
    tbody.innerHTML = linhas.map((l, idx) => {
        const temResponsavel = !!l.pe.responsavel_etapa_email;
        return `
        <tr>
            <td class="p-3 text-center"><input type="checkbox" class="govLinhaCheck" data-idx="${idx}"></td>
            <td class="p-3 font-mono font-bold text-red-700">${l.projeto.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(l.projeto.nome)}</td>
            <td class="p-3 text-xs">${l.etapa.etapa}</td>
            <td class="p-3">
                <select id="govDestTipo_${idx}" onchange="onChangeTipoDestinatarioGovernanca(${idx})" class="p-1 border border-gray-300 rounded text-[10px] bg-white mb-1 w-full">
                    <option value="RESPONSAVEL_TAREFA" ${temResponsavel ? 'selected' : 'disabled'}>Responsável da tarefa${temResponsavel ? ` (${escapeHtml(l.pe.responsavel_etapa_nome)})` : ' — nenhum cadastrado'}</option>
                    <option value="EMAIL_DIGITADO" ${temResponsavel ? '' : 'selected'}>E-mail digitado</option>
                </select>
                <input type="email" id="govDestDigitado_${idx}" placeholder="e-mail@exemplo.com" class="p-1 border border-gray-300 rounded text-[10px] w-full ${temResponsavel ? 'hidden' : ''}">
            </td>
            <td class="p-3 text-center">${l.saude.html}</td>
            <td class="p-3 text-[11px] text-gray-600">${l.motivos.join('; ')}</td>
        </tr>
    `;
    }).join('');
}

function onChangeTipoDestinatarioGovernanca(idx) {
    const tipo = document.getElementById(`govDestTipo_${idx}`).value;
    document.getElementById(`govDestDigitado_${idx}`).classList.toggle('hidden', tipo !== 'EMAIL_DIGITADO');
}

function alternarSelecaoTodosGovernanca(marcado) {
    document.querySelectorAll('.govLinhaCheck').forEach(cb => { cb.checked = marcado; });
}

async function enviarCobrancaGovernanca() {
    if (!usuarioPodeAlterarTela('governanca')) return alert('Você não tem permissão para enviar cobrança de ajustes.');
    const templateId = document.getElementById('govTemplateSelect').value;
    if (!templateId) {
        return alert('Selecione um template de Governança antes de enviar!');
    }

    // AJUSTADO (a pedido do usuário): mantém o índice de cada linha
    // selecionada, pra ler o destinatário escolhido (Responsável ou
    // E-mail digitado) no momento do envio — mesmo padrão do Fluxo de
    // E-mail.
    const selecionados = [];
    document.querySelectorAll('.govLinhaCheck:checked').forEach(cb => {
        const idx = Number(cb.getAttribute('data-idx'));
        if (governancaLinhasCache[idx]) selecionados.push({ idx, linha: governancaLinhasCache[idx] });
    });

    if (selecionados.length === 0) {
        return alert('Selecione pelo menos um projeto pra enviar a cobrança!');
    }

    // Valida ANTES de enviar qualquer coisa: se escolheu "E-mail
    // digitado" em alguma linha, o campo precisa estar preenchido.
    for (const { idx } of selecionados) {
        const tipo = document.getElementById(`govDestTipo_${idx}`).value;
        if (tipo === 'EMAIL_DIGITADO' && !document.getElementById(`govDestDigitado_${idx}`).value.trim()) {
            return alert(`Preencha o e-mail digitado da linha ${governancaLinhasCache[idx].projeto.codigo} antes de enviar!`);
        }
    }

    const { data: template, error: errorTemplate } = await _supabase.from('email_templates').select('*').eq('id', templateId).maybeSingle();
    if (errorTemplate || !template) {
        return alert('Não foi possível carregar o template selecionado.');
    }

    if (!confirm(`Confirma o envio da cobrança "${template.assunto}" para ${selecionados.length} projeto(s) selecionado(s)?`)) return;

    let enviados = 0, erros = 0;
    for (const { idx, linha: l } of selecionados) {
        const tipo = document.getElementById(`govDestTipo_${idx}`).value;
        const destinatarioEmail = tipo === 'EMAIL_DIGITADO'
            ? document.getElementById(`govDestDigitado_${idx}`).value.trim()
            : l.pe.responsavel_etapa_email;
        const destinatarioNome = tipo === 'EMAIL_DIGITADO' ? destinatarioEmail : l.pe.responsavel_etapa_nome;

        if (!destinatarioEmail) { erros++; continue; }

        const { assunto, corpo } = montarEmailPorTemplate(template, l.projeto, { etapa: l.etapa.etapa, responsavel: destinatarioNome, motivos: l.motivos.join('; ') });
        const resultado = await enfileirarEmail({
            destinatarioEmail,
            destinatarioNome,
            assunto,
            corpo,
            contexto: { codigo_projeto: l.projeto.codigo, etapa: l.etapa.etapa, origem: 'GOVERNANCA_COBRANCA' }
        });
        if (resultado.error) erros++; else enviados++;
    }

    alert(`✅ ${enviados} cobrança(s) enfileirada(s) com sucesso.${erros > 0 ? ` ⚠️ ${erros} não puderam ser enfileiradas (sem e-mail de responsável cadastrado).` : ''}`);
    await renderGovernancaView();
}
