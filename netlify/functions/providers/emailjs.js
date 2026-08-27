// =========================================================================
// netlify/functions/providers/emailjs.js
// Implementação do provedor de envio via EmailJS — https://www.emailjs.com
// Diferente do Resend/Brevo, o EmailJS NÃO exige domínio nenhum: ele
// manda o e-mail usando uma conta de e-mail já existente (Gmail,
// Outlook, etc.) que você conecta uma vez no painel deles — sem DNS.
// Gratuito até 200 e-mails/mês.
//
// Mesma assinatura de função que qualquer outro provedor (ver
// resend.js, brevo.js): enviar({ destinatarioEmail, destinatarioNome,
// remetente, assunto, corpo }) -> { sucesso, erro, idExterno }.
//
// PARTICULARIDADE DO EMAILJS: ele é baseado em TEMPLATE — o texto do
// e-mail é montado lá no painel deles, usando variáveis. Este código
// manda o assunto e o corpo (já montados aqui pelo nosso sistema, a
// partir do template cadastrado em Gestão de Templates) como variáveis
// pro template do EmailJS só repassar adiante — então o template lá
// precisa ter estes 4 campos: {{to_email}}, {{to_name}}, {{subject}},
// {{message}}.
// =========================================================================

async function enviar({ destinatarioEmail, destinatarioNome, remetente, assunto, corpo }) {
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;

    if (!publicKey || !privateKey || !serviceId || !templateId) {
        return { sucesso: false, erro: 'Configuração do EmailJS incompleta — verifique EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID e EMAILJS_TEMPLATE_ID nas variáveis de ambiente do Netlify.' };
    }

    const corpoHtml = String(corpo || '').replace(/\n/g, '<br>');

    try {
        const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                accessToken: privateKey,
                template_params: {
                    to_email: destinatarioEmail,
                    to_name: destinatarioNome || destinatarioEmail,
                    subject: assunto,
                    message: corpoHtml,
                    // Alguns templates EmailJS usam "reply_to" pra
                    // permitir responder pro remetente configurado do
                    // fluxo — enviamos por garantia, mesmo que o
                    // template padrão não use.
                    reply_to: remetente || undefined
                }
            })
        });

        const textoResposta = await resposta.text();

        if (!resposta.ok) {
            return { sucesso: false, erro: textoResposta || `Erro HTTP ${resposta.status} do provedor EmailJS.` };
        }

        return { sucesso: true, idExterno: null };
    } catch (err) {
        return { sucesso: false, erro: `Falha de rede ao chamar o EmailJS: ${err.message}` };
    }
}

module.exports = { enviar };
