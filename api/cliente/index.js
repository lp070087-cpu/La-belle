/* ==========================================================================
   GET   /api/cliente   -> dados da cliente autenticada
   PATCH /api/cliente   -> atualiza nome, WhatsApp e data de nascimento
   --------------------------------------------------------------------------
   Todas as duas exigem sessão.

   PONTO CENTRAL DE SEGURANÇA: o id NUNCA vem do navegador. O corpo da
   requisição pode até trazer {"id": "..."}, e ele é ignorado — quem é a
   cliente é decidido pela sessão do cookie. Sem isso, bastaria trocar o id
   no corpo para editar a conta de outra pessoa.

   O E-MAIL NÃO É ALTERÁVEL nesta fase. Trocar o e-mail é trocar o
   identificador de acesso: exige confirmar que o endereço novo existe
   (link de verificação) e avisar o antigo. Sem serviço de e-mail
   configurado, isso não dá para fazer com segurança — então o campo fica
   somente leitura em vez de virar um furo. O valor enviado é simplesmente
   descartado aqui.
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const V = require("../_lib/validar");
const db = require("../_lib/db");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["GET", "PATCH"])) return;

  const linha = await A.exigirCliente(req, res, http);
  if (!linha) return;

  /* -------------------------------------------------------------- GET */
  if (String(req.method).toUpperCase() === "GET") {
    return http.ok(res, { ok: true, cliente: S.clientePublico(linha) });
  }

  /* ------------------------------------------------------------ PATCH */
  let corpo;
  try {
    corpo = await http.corpo(req);
  } catch (e) {
    return http.erro(res, 400, "Não consegui ler os dados enviados.");
  }

  const v = V.validarDados(corpo);
  if (!v.ok) return http.erro(res, 400, v.erro);

  const { nome, whatsapp, nascimento } = v.dados;

  try {
    /* Só as colunas permitidas. O e-mail ficou de fora de propósito.
       Os valores vão como parâmetro: nada de concatenar texto em SQL.  */
    const atual = await db.um(
      "UPDATE customers SET name = $1, whatsapp = $2, birth_date = $3, \"updatedAt\" = now() " +
      "WHERE id = $4 " +
      "RETURNING id, name, email, whatsapp, birth_date, \"createdAt\"",
      [nome, whatsapp, nascimento, linha.id]
    );

    if (!atual) {
      /* A conta sumiu entre a checagem da sessão e o UPDATE. */
      return http.erro(res, 401, "A sua sessão expirou. Entre de novo, por favor.");
    }

    return http.ok(res, { ok: true, cliente: S.clientePublico(atual) });
  } catch (e) {
    if (e && e.codigo === "SEM_BANCO") {
      return http.erro(res, 503, "O servidor ainda não está ligado ao banco de dados.");
    }
    return http.erro(res, 500, "Não consegui salvar os seus dados agora. Tente de novo em instantes.");
  }
};
