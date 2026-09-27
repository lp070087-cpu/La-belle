/* ==========================================================================
   api/_lib/http.js — entrada e saída das funções serverless
   --------------------------------------------------------------------------
   Pequeno de propósito: ler o corpo, responder JSON, guardar o método.
   Nada aqui conhece o banco nem a sessão.

   TODA resposta leva `Cache-Control: no-store`. São dados de pessoa
   autenticada: nada pode ficar em cache de navegador, de CDN ou de proxy.  */

"use strict";

const LIMITE_CORPO = 64 * 1024; // 64 KB: cabe um formulário, não uma carga

/* ------------------------------------------------------------- ler corpo
   Na Vercel, às vezes o corpo já vem pronto em `req.body`. Quando não vem,
   lemos o stream. Devolve sempre um objeto — nunca lança para o chamador
   por JSON malformado, porque isso responderia 500 a uma entrada inválida. */
async function corpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") return req.body;
    try { return JSON.parse(String(req.body)); } catch (e) { return {}; }
  }

  return new Promise((resolve) => {
    let total = 0;
    const pedacos = [];
    let terminado = false;

    const fim = (valor) => { if (!terminado) { terminado = true; resolve(valor); } };

    try {
      req.on("data", (c) => {
        total += c.length;
        if (total > LIMITE_CORPO) { fim({}); if (req.destroy) req.destroy(); return; }
        pedacos.push(c);
      });
      req.on("end", () => {
        const t = Buffer.concat(pedacos).toString("utf8");
        if (!t) return fim({});
        try { fim(JSON.parse(t)); } catch (e) { fim({}); }
      });
      req.on("error", () => fim({}));
    } catch (e) {
      fim({});
    }
  });
}

/* -------------------------------------------------------------- responder */
function enviar(res, status, dados, extras) {
  const cabecalhos = Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Content-Type-Options": "nosniff",
      /* A API nunca deve ser embutida em iframe de outro site. */
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    },
    extras || {}
  );

  res.statusCode = status;
  for (const k of Object.keys(cabecalhos)) {
    try { res.setHeader(k, cabecalhos[k]); } catch (e) { /* segue */ }
  }
  res.end(JSON.stringify(dados === undefined ? {} : dados));
}

/* Todas as respostas de erro têm o mesmo formato: { erro: "texto" }.
   O navegador mostra `erro` direto. `campo` (opcional) diz ao formulário
   qual input destacar.                                                    */
/* `extras` existe para o Set-Cookie. Sem repassar o terceiro argumento, o
   cookie era SILENCIOSAMENTE descartado: o login respondia "ok" e nunca
   criava sessão. Foi a bancada que pegou — não mude isto sem rodar a bancada. */
function ok(res, dados, extras) { return enviar(res, 200, dados || {}, extras); }

function criado(res, dados, extras) { return enviar(res, 201, dados || {}, extras); }

function erro(res, status, mensagem, campo) {
  const corpo = { erro: mensagem };
  if (campo) corpo.campo = campo;
  return enviar(res, status, corpo);
}

/* 405 — método não permitido. Sempre manda o header Allow. */
function metodoNaoPermitido(res, permitidos) {
  return enviar(res, 405, { erro: "Método não permitido." }, { Allow: permitidos.join(", ") });
}

/* Guarda de método. Devolve true quando a requisição deve SEGUIR.
   Devolve false quando já respondeu 405 e o handler deve parar.           */
function permitir(req, res, metodos) {
  const m = String((req.method || "GET")).toUpperCase();
  if (metodos.indexOf(m) === -1) { metodoNaoPermitido(res, metodos); return false; }
  return true;
}

module.exports = { corpo, enviar, ok, criado, erro, permitir, metodoNaoPermitido, LIMITE_CORPO };
