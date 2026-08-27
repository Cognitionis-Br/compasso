// =========================================================================
// email-gestao/envio-email.js
// Envio REAL de e-mail — chama a função serverless do Netlify
// (/.netlify/functions/enviar-email), que por sua vez chama o provedor
// configurado (hoje: Resend). O front-end nunca fala direto com o
// provedor — só com a nossa própria função, que pode trocar de provedor
// por trás sem o front-end mudar nada.
//
// SÓ FUNCIONA quando a aplicação está rodando via Netlify (produção, ou
// `netlify dev` localmente) — em file:// ou um servidor local simples,
// a função serverless não existe, e o envio falha com uma mensagem
// explicando isso, sem quebrar o resto da tela.
// =========================================================================

async function enviarEmailIndividual(emailPendente) {
    let resposta;
    try {
        resposta = await fetch('/.netlify/functions/enviar-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinatarioEmail: emailPendente.destinatario_email,
                destinatarioNome: emailPendente.destinatario_nome,
                remetente: emailPendente.remetente,
                assunto: emailPendente.assunto,
                corpo: emailPendente.corpo
            })
        });
    } catch (err) {
        // Falha de rede — normalmente significa que a função serverless
        // não está disponível (rodando fora do Netlify/netlify dev).
        return { sucesso: false, erro: 'Não foi possível contatar o serviço de envio. Isso é esperado se o sistema estiver rodando localmente sem "netlify dev" — o envio real só funciona quando publicado no Netlify (ou testado com netlify dev).' };
    }

    let corpoResposta;
    try {
        corpoResposta = await resposta.json();
    } catch (e) {
        corpoResposta = { sucesso: false, erro: `Resposta inesperada do servidor (status ${resposta.status}).` };
    }

    return corpoResposta;
}

// Processa toda a fila de pendentes — um a um, registrando sucesso ou
// erro de cada envio. Não interrompe no primeiro erro, pra não travar
// os demais e-mails da fila por causa de um só com problema.
async function processarFilaEmailPendente() {
    // NOVO (chave geral de envio de e-mail): recusa processar a fila
    // enquanto a chave geral estiver desligada, mesmo que já existam
    // e-mails enfileirados de antes de ela ser desligada.
    const { data: configGeral } = await _supabase.from('config_email_geral').select('envio_ativo').eq('id', 1).maybeSingle();
    if (configGeral && configGeral.envio_ativo === false) {
        alert('⛔ A Chave Geral de Envio de E-mail está desligada (Gestão do Fluxo de E-mail). Ligue-a antes de processar a fila.');
        return;
    }

    const { data, error } = await _supabase.from('emails_pendentes').select('*').eq('enviado', false).order('created_at');
    if (error) {
        alert('Erro ao buscar a fila de e-mails: ' + error.message);
        return;
    }

    const pendentes = data || [];
    if (pendentes.length === 0) {
        alert('Nenhum e-mail pendente na fila.');
        return;
    }

    if (!confirm(`Isso vai tentar enviar ${pendentes.length} e-mail(s) de verdade. Confirma?`)) return;

    let enviados = 0, falhas = 0;
    for (const email of pendentes) {
        const resultado = await enviarEmailIndividual(email);

        if (resultado.sucesso) {
            enviados++;
            await _supabase.from('emails_pendentes').update({
                enviado: true,
                enviado_at: new Date().toISOString(),
                tentativas: (email.tentativas || 0) + 1
            }).eq('id', email.id);
        } else {
            falhas++;
            await _supabase.from('emails_pendentes').update({
                tentativas: (email.tentativas || 0) + 1,
                erro_ultima_tentativa: resultado.erro || 'Erro desconhecido'
            }).eq('id', email.id);
        }
    }

    alert(`Processamento concluído.\n\n✅ Enviados: ${enviados}\n❌ Falhas: ${falhas}${falhas > 0 ? '\n\nConfira a coluna de status na Fila de E-mail pra ver o motivo de cada falha.' : ''}`);
    await renderFilaEmailPendentes();
}
