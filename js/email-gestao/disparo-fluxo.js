// =========================================================================
// email-gestao/disparo-fluxo.js
// Item 12 (relatório de melhorias): novo processo de envio de e-mail,
// atrelado à ação final de CADA atividade específica (Fase + Etapa +
// Quando Dispara). Antes de enfileirar qualquer coisa, checa o cadastro
// em Gestão do Fluxo de E-mail — só dispara se aquela linha estiver
// ATIVA, com template também ativo.
//
// Escopo desta etapa (item 14): implementado primeiro só no ponto de
// disparo #1 (Formalizar Demanda → "Após salvar a demanda"), testado, e
// depois replicado pros demais pontos da lista fixa.
// =========================================================================

async function dispararEmailFluxo(fase, etapa, quandoDispara, projeto, dadosExtras) {
    dadosExtras = dadosExtras || {};

    // NOVO (chave geral de envio de e-mail): suplanta o "ativo" de cada
    // linha — desligada, nem chega a consultar email_fluxo. Consulta
    // direto no banco (não usa o cache configEmailGeralAtivo) pra não
    // disparar com um valor desatualizado numa sessão aberta há muito
    // tempo, do mesmo jeito que a linha do Fluxo já é lida ao vivo abaixo.
    const { data: configGeral } = await _supabase.from('config_email_geral').select('envio_ativo').eq('id', 1).maybeSingle();
    if (configGeral && configGeral.envio_ativo === false) return;

    const { data: linhaFluxo, error: errorFluxo } = await _supabase
        .from('email_fluxo')
        .select('*')
        .eq('fase', fase)
        .eq('etapa', etapa)
        .eq('quando_dispara', quandoDispara)
        .maybeSingle();

    if (errorFluxo || !linhaFluxo) return; // ponto não cadastrado — não faz nada
    if (!linhaFluxo.ativo) return; // cadastrado, mas desligado — não faz nada
    if (!linhaFluxo.template_id) return; // ativo mas sem template selecionado — não dispara

    const { data: template } = await _supabase.from('email_templates').select('*').eq('id', linhaFluxo.template_id).eq('ativo', true).maybeSingle();
    if (!template) return; // template foi inativado depois de configurado — não dispara

    let destinatarioEmail, destinatarioNome;
    if (linhaFluxo.tipo_destinatario === 'EMAIL_FIXO') {
        destinatarioEmail = linhaFluxo.email_destinatario_fixo;
        destinatarioNome = null;
    } else {
        // Responsável da tarefa — quem chamou essa função já sabe quem é
        // o responsável daquela ação específica.
        destinatarioEmail = dadosExtras.responsavelEmail;
        destinatarioNome = dadosExtras.responsavelNome;
    }
    if (!destinatarioEmail) return; // sem e-mail de destino — não dispara

    const { assunto, corpo } = montarEmailPorTemplate(template, projeto, dadosExtras);

    await enfileirarEmail({
        destinatarioEmail,
        destinatarioNome,
        assunto,
        corpo,
        contexto: { codigo_projeto: projeto ? projeto.codigo : null, fase, etapa, quando_dispara: quandoDispara },
        remetente: linhaFluxo.remetente || null
    });
}
