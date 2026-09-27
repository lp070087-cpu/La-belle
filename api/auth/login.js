/* ==========================================================================
   POST /api/auth/login
   --------------------------------------------------------------------------
   Fluxo: le corpo -> valida -> busca cliente pelo e-mail normalizado ->
   compara com bcrypt -> cria sessão -> responde com cookie.

   DUAS COISAS QUE ESTE ARQUIVO FAZ DE PROPÓSITO:

   1. Resposta SEMPRE genérica no erro: "E-mail ou senha incorretos."
      Nunca "este e-mail não existe". Descobrir quais e-mails têm conta aqui
      é o primeiro passo de qualquer ataque direcionado.

   2. Gasta o mesmo tempo com e-mail que não existe e com senha errada.
      Sem isso, a resposta volta rápido demais quando o e-mail não existe, e
      o TEMPO denuncia o que a mensagem esconde. Fazemos um hash descartável
      nesse caso para igualar o custo.
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const V = require("../_lib/validar");
const db = require("../_lib/db");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

/* Hash descartável, gerado uma vez por processo. Serve só para gastar o
   mesmo tempo quando o e-mail não existe. Nunca é comparado com nada real. */
const HASH_ISCA = "$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU";

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["POST"])) return;

  let corpo;
  try {
    corpo = await http.corpo(req);
  } catch (e) {
    return http.erro(res, 400, "Não consegui ler os dados enviados.");
  }

  const v = V.validarLogin(corpo);
  if (!v.ok) return http.erro(res, 401, A.ERRO_LOGIN);

  const { email, senha } = v.dados;
  const manter = !!(corpo && corpo.manter);

  try {
    const linha = await db.um(
      "SELECT id, name, email, whatsapp, birth_date, \"createdAt\", \"passwordHash\" " +
      "FROM customers WHERE email = $1",
      [email]
    );

    /* E-mail não existe: gasta o mesmo tempo e responde o mesmo erro. */
    if (!linha) {
      await A.conferirSenha(senha, HASH_ISCA);
      return http.erro(res, 401, A.ERRO_LOGIN);
    }

    const confere = await A.conferirSenha(senha, linha["passwordHash"]);
    if (!confere) return http.erro(res, 401, A.ERRO_LOGIN);

    const sess = await A.criarSessao(linha.id, manter, req);

    /* Faxina oportunista: sessões vencidas não precisam ficar no banco. */
    await A.limparSessoesVencidas();

    return http.ok(res, {
      ok: true,
      cliente: S.clientePublico(linha),
    }, {
      "Set-Cookie": S.serializarCookie(sess.token, sess.expiraEm, sess.persistente),
    });
  } catch (e) {
    if (e && e.codigo === "SEM_BANCO") {
      return http.erro(res, 503, "O servidor ainda não está ligado ao banco de dados.");
    }
    return http.erro(res, 500, "Não consegui entrar agora. Tente de novo em instantes.");
  }
};
