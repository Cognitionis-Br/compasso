// =========================================================================
// dev-tools/limpeza-contratos.js   (Release 1)
// Ferramenta de desenvolvimento — zera TODO o módulo "Contratos e
// Fornecedores" para uma nova rodada de testes, sem tocar em projetos nem
// no cadastro de Fornecedores.
//
// Apaga fisicamente (nesta ordem, respeitando as FKs):
//   contratos_pagamentos_anexos / _itens  -> cascade de contratos_pagamentos
//   contratos_pagamentos
//   contratos_pendencias_anexos / _itens  -> cascade de contratos_pendencias
//   log_contratos_pendencias              (sem cascade — apaga explícito)
//   contratos_pendencias
//   contratos_propostas
//   log_alteracao_vinculo_contrato
//   contratos_vinculos_projeto
//   contratos_projeto
//   contadores_contrato_af                (numeração de contrato zera)
// Depois: recalcula projetos.realizado (sem os vínculos, sobra só o
// valor_gasto_execucao das etapas) e tenta varrer o bucket
// contratos-anexos (best-effort — arquivo órfão em bucket privado é
// inofensivo).
//
// MANTÉM: projetos, projeto_etapas, empresas_terceirizadas (Fornecedores),
// e todo o resto fora do módulo de contratos.
//
// Restrito ao PROPRIETÁRIO (mesma camada dupla das outras ferramentas —
// visibilidade em js/ui/navigation.js e re-checagem aqui).
// =========================================================================

// Usado pelas ferramentas de reset/limpeza POR PROJETO (reset.js,
// limpeza-base.js) — remove o que o Release 1 acrescentou ao módulo de
// contratos e que referencia um projeto sendo apagado/resetado:
// pendências (com itens/anexos por cascade), a trilha de auditoria delas
// (sem cascade) e as propostas. Best-effort — é ferramenta de dev.
async function _limparPendenciasPropostasDeProjetos(codigos) {
    if (!codigos || !codigos.length) return;
    try {
        const { data: pends } = await _supabase.from('contratos_pendencias').select('id').in('projeto_codigo', codigos);
        const ids = (pends || []).map(p => p.id);
        if (ids.length) {
            await _supabase.from('log_contratos_pendencias').delete().in('pendencia_id', ids);
            await _supabase.from('contratos_pendencias').delete().in('id', ids);
        }
        await _supabase.from('contratos_propostas').delete().in('projeto_codigo', codigos);
    } catch (e) {
        console.warn('Limpeza por projeto: pendências/propostas de contrato —', e && e.message);
    }
}

async function _limparStorageContratosAnexos() {
    // Sweep de 2 níveis: pendencias/<id>/<arquivo> e pagamentos/<id>/<arquivo>.
    try {
        for (const raiz of ['pendencias', 'pagamentos']) {
            const { data: pastas, error } = await _supabase.storage.from('contratos-anexos').list(raiz, { limit: 1000 });
            if (error || !pastas) continue;
            for (const pasta of pastas) {
                const prefixo = `${raiz}/${pasta.name}`;
                const { data: arquivos } = await _supabase.storage.from('contratos-anexos').list(prefixo, { limit: 1000 });
                const caminhos = (arquivos || []).filter(a => a.name).map(a => `${prefixo}/${a.name}`);
                if (caminhos.length) await _supabase.storage.from('contratos-anexos').remove(caminhos);
            }
        }
    } catch (e) {
        console.warn('Limpeza de contratos: varredura do Storage falhou (ignorável):', e && e.message);
    }
}

async function limparBaseContratosFornecedores() {
    if (!ehProprietario) {
        return alert('⛔ Esta ferramenta é restrita ao PROPRIETÁRIO do sistema.');
    }

    if (!confirm(
        `⚠️ LIMPEZA DO MÓDULO CONTRATOS E FORNECEDORES\n\n` +
        `Isso vai APAGAR PERMANENTEMENTE, para começar novos testes:\n` +
        `- Todos os contratos cadastrados (contratos_projeto) e a numeração automática\n` +
        `- Todos os vínculos Projeto × Contrato e o log de alterações\n` +
        `- Todas as pendências de contrato (manual / Excel / e-mail), seus itens de rateio, anexos de NF e a trilha de auditoria\n` +
        `- Todas as propostas e todos os pagamentos por NF (cabeçalho + itens + anexos)\n` +
        `- Os anexos no Storage (bucket contratos-anexos)\n\n` +
        `NÃO mexe em: projetos, etapas e o cadastro de Fornecedores.\n` +
        `O "realizado" de cada projeto é recalculado só com o gasto das etapas.\n\n` +
        `Esta ação grava direto no Supabase e NÃO pode ser desfeita. Continuar?`
    )) return;

    const passos = [
        ['contratos_pagamentos', q => q.neq('id', 0)],
        ['contratos_pendencias', q => q.neq('id', 0)],
        ['log_contratos_pendencias', q => q.neq('id', 0)],
        ['contratos_propostas', q => q.neq('id', 0)],
        ['log_alteracao_vinculo_contrato', q => q.neq('id', 0)],
        ['contratos_vinculos_projeto', q => q.neq('id', 0)],
        ['contratos_projeto', q => q.neq('id', 0)],
        ['contadores_contrato_af', q => q.neq('ano_fiscal', '')]
    ];

    const erros = [];
    for (const [tabela, filtro] of passos) {
        const { error } = await filtro(_supabase.from(tabela).delete());
        if (error) {
            // "tabela não existe" (SQL do Release 1 ainda não rodou) não é fatal
            if (/does not exist|not find the table|schema cache/i.test(error.message || '')) {
                console.warn(`Limpeza de contratos: ${tabela} inexistente — pulado.`);
            } else {
                erros.push(`${tabela}: ${error.message}`);
            }
        }
    }

    if (erros.length) {
        alert('❌ A limpeza teve erros:\n\n' + erros.join('\n'));
        return;
    }

    await _limparStorageContratosAnexos();

    // realizado dos projetos volta a ser só o gasto das etapas
    let recalc = 0;
    if (typeof recalcularRealizadoProjeto === 'function') {
        for (const p of (projectsData || [])) {
            try { await recalcularRealizadoProjeto(p.codigo); recalc++; } catch (_) {}
        }
    }

    // zera os caches em memória do módulo de contratos (se a tela estiver aberta)
    try { if (typeof contratosProjetoCache !== 'undefined') contratosProjetoCache = []; } catch (_) {}
    try { if (typeof pendenciasContratosCache !== 'undefined') pendenciasContratosCache = []; } catch (_) {}
    if (typeof loadProjects === 'function') await loadProjects();

    alert(`✅ Módulo Contratos e Fornecedores zerado. ${recalc} projeto(s) tiveram o realizado recalculado. Numeração de contrato reiniciada. Fornecedores e projetos foram mantidos.`);
}
