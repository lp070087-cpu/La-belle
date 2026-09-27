/* ==========================================================================
   POST /api/auth/redefinir — concluir a redefinição com o token do e-mail
   --------------------------------------------------------------------------
   PENDENTE DE INTEGRAÇÃO DE E-MAIL, como api/auth/recuperar.js: sem serviço
   de e-mail, nenhum token chega até a pessoa, então esta rota não tem como
   ser usada ainda. Ela já está escrita e verificável para que a integração
   seja só plugar o envio — sem inventar rota nova depois.

   A ROTA JÁ É SEGURA POR CONSTRUÇÃO:
     - o token chega pelo corpo, não pela URL (URL vaza em log e histórico);
     - só o HASH do token está no banco, e é comparado por hash;
     - validade curta (gravada na criação);
     - USO ÚNICO: marca usedAt e não aceita de novo;
     - token de uma conta não serve para outra;
     - ao redefinir, derruba TODAS as sessões daquela conta.

   Nada aqui troca a senha sem token válido.
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const http = require("../_lib/http");
const V = require("../_lib/validar");
const db = require("../_lib/db");
const A = require("../_lib/auth");

const ERRO_TOKEN = "Este link não é mais válido. Peça um novo, por favor.";

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["POST"])) return;

  let corpo;
  try {
    corpo = await http.corpo(req);
  } catch (e) {
    return http.erro(res, 400, "Não consegui ler os dados enviados.");
  }

  const token = String((corpo && corpo.token) || "").trim();
  if (!token) return http.erro(res, 400, ERRO_TOKEN);

  const v = V.validarTrocaSenha({
    atual: "redefinicao", /* não há senha atual: o token É a prova */
    nova: corpo && corpo.nova,
    confirmar: corpo && corpo.confirmar,
  });
  /* A regra "nova != atual" não se aplica aqui; refazemos a checagem certa. */
  if (!V.senhaForte(corpo && corpo.nova)) {
    return http.erro(res, 400, "Use pelo menos 8 caracteres, misturando letras e números.");
  }
  if (String(corpo && corpo.confirmar) !== String(corpo && corpo.nova)) {
    return http.erro(res, 400, "As duas senhas estão diferentes.");
  }
  void v; /* a chamada acima é só para manter a mesma régua documentada */

  try {
    const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");

    const pedido = await db.um(
      'SELECT id, "customerId", "expiresAt", "usedAt" FROM password_resets WHERE "tokenHash" = $1',
      [tokenHash]
    );

    if (!pedido || pedido.usedAt || new Date(pedido.expiresAt).getTime() <= Date.now()) {
      return http.erro(res, 400, ERRO_TOKEN);
    }

    const novoHash = await A.hashSenha(corpo.nova);

    /* Marca como usado ANTES de gravar a senha. Se a gravação falhar, o
       token morre — melhor pedir um novo do que permitir reuso.        */
    await db.consulta('UPDATE password_resets SET "usedAt" = now() WHERE id = $1', [pedido.id]);
    await db.consulta(
      'UPDATE customers SET "passwordHash" = $1, "updatedAt" = now() WHERE id = $2',
      [novoHash, pedido.customerId]
    );
    await A.derrubarTodasSessoes(pedido.customerId);

    return http.ok(res, { ok: true, mensagem: "Senha redefinida. Entre com a nova senha." });
  } catch (e) {
    if (e && e.codigo === "SEM_BANCO") {
      return http.erro(res, 503, "O servidor ainda não está ligado ao banco de dados.");
    }
    return http.erro(res, 500, "Não consegui redefinir a senha agora. Tente de novo em instantes.");
  }
};
