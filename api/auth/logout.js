/* ==========================================================================
   POST /api/auth/logout
   --------------------------------------------------------------------------
   Logout de verdade, em duas partes:

   1. Apaga a linha da sessão no banco  -> o token morre no SERVIDOR.
   2. Manda Set-Cookie vazio com Max-Age=0 -> o navegador esquece.

   Só a parte 2 seria um logout de fachada: o cookie sumiria do navegador,
   mas o token continuaria valendo para quem tivesse uma cópia dele. Por
   isso a ordem: primeiro o banco, depois o cookie.

   Responde 200 mesmo sem sessão. Logout é idempotente — sair duas vezes não
   é erro, e responder 401 aqui só faria o botão parecer quebrado.
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["POST"])) return;

  try {
    await A.derrubarSessao(req);
  } catch (e) {
    /* Mesmo sem conseguir falar com o banco, limpamos o cookie. Não dá para
       deixar a pessoa presa numa sessão que ela quer encerrar.           */
  }

  return http.ok(res, { ok: true }, { "Set-Cookie": S.cookieDeSaida() });
};
