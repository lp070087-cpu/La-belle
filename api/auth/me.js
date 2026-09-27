/* ==========================================================================
   GET /api/auth/me
   --------------------------------------------------------------------------
   É a PORTA da área da cliente.

   conta.html chama isto antes de mostrar qualquer coisa:
     - 200 -> sessão válida; devolve o cliente e a interface abre
     - 401 -> sem sessão; o navegador manda para login.html

   Esta é a diferença entre "esconder a tela" e "proteger a tela". O arquivo
   conta.html é público e continua sendo — mas ele não contém dado nenhum de
   ninguém. Todo dado pessoal vem daqui, e daqui só sai com sessão válida.
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["GET"])) return;

  /* Sem sessão: 401 e nada mais. Nenhuma pista sobre contas existentes. */
  const linha = await A.exigirCliente(req, res, http);
  if (!linha) return;

  return http.ok(res, {
    ok: true,
    autenticado: true,
    /* clientePublico() é lista de PERMISSÃO: id, nome, e-mail, whatsapp,
       nascimento e desde. passwordHash não passa por lá.                */
    cliente: S.clientePublico(linha),
  });
};
