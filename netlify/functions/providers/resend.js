// =========================================================================
// netlify/functions/providers/resend.js
// Implementação do provedor de envio via Resend (https://resend.com) —
// gratuito até 3.000 e-mails/mês, 100/dia, sem cartão de crédito.
//
// Esse arquivo é a ÚNICA peça que precisa ser trocada pra usar outro
// provedor de e-mail no futuro (SMTP próprio, SendGrid, Amazon SES,
// etc.) — a função enviar-email.js não sabe (nem precisa saber) qual
// provedor está por trás. Basta criar um arquivo novo com a mesma
// assinatura de função (enviar({ destinatarioEmail, destinatarioNome,
// remetente, assunto, corpo }) -> { sucesso, erro, idExterno }) e trocar
// o require() em enviar-email.js.
// =========================================================================

async function enviar({ destinatarioEmail, destinatarioNome, remetente, assunto, corpo }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { sucesso: false, erro: 'RESEND_API_KEY não configurada nas variáveis de ambiente do Netlify.' };
    }

    // Enquanto o domínio do remetente não estiver verificado no Resend,
    // só é permitido enviar usando onboarding@resend.dev — e só PARA o
    // e-mail cadastrado na conta Resend (limitação do modo de teste
    // deles, não nossa). Depois de verificar um domínio próprio, o
    // remetente configurado em Gestão do Fluxo de E-mail passa a valer
    // de verdade.
    const remetenteFinal = process.env.RESEND_REMETENTE_VERIFICADO || remetente || 'onboarding@resend.dev';

    const corpoHtml = String(corpo || '').replace(/\n/g, '<br>');

    try {
        const resposta = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: remetenteFinal,
                to: [destinatarioEmail],
                subject: assunto,
                html: corpoHtml
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            return { sucesso: false, erro: dados.message || `Erro HTTP ${resposta.status} do provedor Resend.` };
        }

        return { sucesso: true, idExterno: dados.id || null };
    } catch (err) {
        return { sucesso: false, erro: `Falha de rede ao chamar o Resend: ${err.message}` };
    }
}

module.exports = { enviar };
