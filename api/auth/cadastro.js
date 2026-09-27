/* ==========================================================================
   POST /api/auth/cadastro
   --------------------------------------------------------------------------
   Cria a conta de verdade, grava no Neon e já abre a sessão.

   Ordem exata:
     le corpo -> valida no servidor -> normaliza -> checa se o e-mail existe
     -> hash da senha -> INSERT -> cria sessão -> responde com cookie

   O navegador NUNCA manda id de cliente: quem é o cliente nasce aqui.
   ========================================================================== */

"use strict";

const http = require("../_lib/http");
const V = require("../_lib/validar");
const db = require("../_lib/db");
const S = require("../_lib/sessao");
const A = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (!http.permitir(req, res, ["POST"])) return;

  let corpo;
  try {
    corpo = await http.corpo(req);
  } catch (e) {
    return http.erro(res, 400, "Não consegui ler os dados enviados.");
  }

  /* ------------------------------------------------ validação server-side
     O navegador também valida, mas isso é conveniência para a pessoa. O
     que vale é esta checagem: nunca confiar no que chega.                */
  const v = V.validarCadastro(corpo);
  if (!v.ok) return http.erro(res, 400, v.erro);

  const { nome, email, whatsapp, senha } = v.dados;

  try {
    /* ------------------------------------------- e-mail já existe?
       Checamos antes para dar a mensagem amigável. O UNIQUE do banco
       continua sendo a garantia final (ver o catch de duplicado abaixo):
       entre a checagem e o INSERT cabe outra requisição.                */
    const existente = await db.um("SELECT id FROM customers WHERE email = $1", [email]);
    if (existente) {
      return http.erro(res, 409, "Já existe uma conta com este e-mail. Tente entrar.", "email");
    }

    const hash = await A.hashSenha(senha);

    let linha;
    try {
      linha = await db.um(
        "INSERT INTO customers (name, email, whatsapp, \"passwordHash\") " +
        "VALUES ($1, $2, $3, $4) " +
        "RETURNING id, name, email, whatsapp, birth_date, \"createdAt\"",
        [nome, email, whatsapp, hash]
      );
    } catch (e) {
      /* Corrida: outra requisição criou o mesmo e-mail no meio do caminho.
         O UNIQUE do banco guarda o portão; aqui só traduzimos o erro.    */
      if (db.ehEmailDuplicado(e)) {
        return http.erro(res, 409, "Já existe uma conta com este e-mail. Tente entrar.", "email");
      }
      throw e;
    }

    /* ------------------------------------------------------- sessão
       Cadastro já entra conectado, como pedido no fluxo.               */
    const sess = await A.criarSessao(linha.id, true, req);

    return http.criado(res, {
      ok: true,
      cliente: S.clientePublico(linha),
    }, {
      "Set-Cookie": S.serializarCookie(sess.token, sess.expiraEm, sess.persistente),
    });
  } catch (e) {
    if (e && e.codigo === "SEM_BANCO") {
      return http.erro(res, 503, "O servidor ainda não está ligado ao banco de dados.");
    }
    /* Mensagem genérica: o detalhe do banco não vai para o navegador.   */
    return http.erro(res, 500, "Não consegui criar a conta agora. Tente de novo em instantes.");
  }
};
