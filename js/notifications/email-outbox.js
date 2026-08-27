// =========================================================================
// notifications/email-outbox.js
// Padrão outbox: enfileira e-mails no banco (tabela emails_pendentes) em
// vez de enviar diretamente do frontend. Nenhum envio real acontece aqui
// — só o registro do que precisa ser enviado.
//
// Um processo separado (Supabase Edge Function + cron, a implementar
// quando o provedor de e-mail for escolhido) vai ler as linhas com
// enviado = false e processá-las. Até lá, chamar enfileirarEmail()
// é seguro e não tem efeito colateral externo nenhum — só grava uma
// linha na fila, que fica parada esperando o processador ser ligado.
// =========================================================================

async function enfileirarEmail({ destinatarioEmail, destinatarioNome, assunto, corpo, contexto, remetente }) {
    if (!destinatarioEmail || !assunto || !corpo) {
        console.error('enfileirarEmail: destinatarioEmail, assunto e corpo são obrigatórios.', { destinatarioEmail, assunto });
        return { error: 'Parâmetros obrigatórios ausentes' };
    }

    const { error } = await _supabase.from('emails_pendentes').insert([{
        destinatario_email: destinatarioEmail,
        destinatario_nome: destinatarioNome || null,
        assunto,
        corpo,
        contexto: contexto || null,
        // NOVO (envio real de e-mail): guarda o remetente configurado
        // pra linha do fluxo — sem isso, o envio real não sabia de qual
        // endereço disparar.
        remetente: remetente || null
    }]);

    if (error) {
        console.error('Erro ao enfileirar e-mail:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

// Monta o corpo do e-mail de aviso de planejamento de etapa, conforme o
// texto padrão da Especificação_Workflow_v2.md, seção 4.
function montarEmailAvisoPlanejamento({ nomeDestinatario, nomeProjeto, nomeFase, nomeEtapa, dataLimite }) {
    const assunto = `[Compasso] Planejamento pendente — ${nomeProjeto} (${nomeEtapa})`;
    const corpo =
        `Sr(a) ${nomeDestinatario},\n\n` +
        `O Projeto ${nomeProjeto} está com a fase ${nomeFase} na etapa de planejamento ` +
        `da atividade ${nomeEtapa}, para a qual o(a) sr(a) está cadastrado(a) como responsável.\n\n` +
        `Solicitamos que seja efetuado o planejamento dessa atividade, que conforme o SLA ` +
        `proposto deverá ocorrer até ${dataLimite}.\n\n` +
        `Área de Governança`;
    return { assunto, corpo };
}
