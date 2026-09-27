/* ==========================================================================
   POST /api/cliente/senha — troca de senha
   --------------------------------------------------------------------------
   Fluxo:
     sessão -> valida o corpo -> confere a SENHA ATUAL com bcrypt ->
     gera hash da nova -> grava -> DERRUBA TODAS AS SESSÕES -> cria uma nova
     -> responde com o cookie novo

   Por que derrubar todas as sessões: se alguém entrou na conta com a senha
   antiga, trocar a senha precisa expulsar essa pessoa. Manter as sessões
   antigas vivas deixaria o invasor conectado depois da troca.

   Por que criar uma sessão nova em seguida: quem trocou a senha é a dona da
   conta e está ali na tela. Expulsar ela também seria hostil — o certo é
   derrubar todo mundo e reconectar só quem pediu a troca.

   NUNCA: logar a senha, devolver o hash, ou aceitar um id de cliente vindo
   do navegador (a conta é decidida pela sessão).
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const V = require("../_lib/validar");
const db = require("../_lib/db");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["POST"])) return;

  const linha = await A.exigirCliente(req, res, http);
  if (!linha) return;

  let corpo;
  try {
    corpo = await http.corpo(req);
  } catch (e) {
    return http.erro(res, 400, "Não consegui ler os dados enviados.");
  }

  /* O formulário usa os nomes "atual", "nova" e "confirmar". */
  const v = V.validarTrocaSenha({
    atual: corpo && corpo.atual,
    nova: corpo && corpo.nova,
    confirmar: corpo && (corpo.confirmar !== undefined ? corpo.confirmar : corpo.nova2),
  });
  if (!v.ok) return http.erro(res, 400, v.erro);

  try {
    /* Buscamos o hash atual. Ele NÃO sai daqui para lugar nenhum. */
    const registro = await db.um('SELECT "passwordHash" FROM customers WHERE id = $1', [linha.id]);
    if (!registro) return http.erro(res, 401, "A sua sessão expirou. Entre de novo, por favor.");

    const confere = await A.conferirSenha(v.dados.atual, registro["passwordHash"]);
    if (!confere) {
      /* 401 não: a sessão é válida, o que está errado é a senha digitada.
         400 com campo = "atual" faz o formulário destacar o campo certo. */
      return http.erro(res, 400, "A senha atual não confere.", "atual");
    }

    const novoHash = await A.hashSenha(v.dados.nova);

    await db.consulta(
      'UPDATE customers SET "passwordHash" = $1, "updatedAt" = now() WHERE id = $2',
      [novoHash, linha.id]
    );

    /* Derruba tudo e reconecta só quem pediu a troca. */
    await A.derrubarTodasSessoes(linha.id);
    const sess = await A.criarSessao(linha.id, true, req);

    return http.ok(res, { ok: true }, {
      "Set-Cookie": S.serializarCookie(sess.token, sess.expiraEm, sess.persistente),
    });
  } catch (e) {
    if (e && e.codigo === "SEM_BANCO") {
      return http.erro(res, 503, "O servidor ainda não está ligado ao banco de dados.");
    }
    return http.erro(res, 500, "Não consegui alterar a senha agora. Tente de novo em instantes.");
  }
};
