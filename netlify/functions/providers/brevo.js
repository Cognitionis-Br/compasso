// =========================================================================
// netlify/functions/providers/brevo.js
// Implementação do provedor de envio via Brevo — https://www.brevo.com
// (antigo Sendinblue) — gratuito até 300 e-mails/dia, sem cartão de
// crédito.
//
// Mesma assinatura de função que qualquer outro provedor (ver
// resend.js): enviar({ destinatarioEmail, destinatarioNome, remetente,
// assunto, corpo }) -> { sucesso, erro, idExterno }. Pra trocar de
// provedor de novo no futuro, é só criar outro arquivo com essa mesma
// assinatura e apontar o require() em enviar-email.js pra ele.
// =========================================================================

async function enviar({ destinatarioEmail, destinatarioNome, remetente, assunto, corpo }) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        return { sucesso: false, erro: 'BREVO_API_KEY não configurada nas variáveis de ambiente do Netlify.' };
    }

    // O Brevo exige que o e-mail do remetente esteja verificado na conta
    // (Settings → Senders). Se REMETENTE_VERIFICADO estiver configurado,
    // usa ele; senão tenta o remetente vindo do cadastro do fluxo.
    const remetenteFinal = process.env.BREVO_REMETENTE_VERIFICADO || remetente;
    if (!remetenteFinal) {
        return { sucesso: false, erro: 'Nenhum remetente configurado (nem BREVO_REMETENTE_VERIFICADO, nem o cadastro do fluxo).' };
    }

    const corpoHtml = String(corpo || '').replace(/\n/g, '<br>');

    try {
        const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: remetenteFinal },
                to: [{ email: destinatarioEmail, name: destinatarioNome || undefined }],
                subject: assunto,
                htmlContent: corpoHtml
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            return { sucesso: false, erro: dados.message || `Erro HTTP ${resposta.status} do provedor Brevo.` };
        }

        return { sucesso: true, idExterno: dados.messageId || null };
    } catch (err) {
        return { sucesso: false, erro: `Falha de rede ao chamar o Brevo: ${err.message}` };
    }
}

module.exports = { enviar };
