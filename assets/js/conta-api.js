/* ==========================================================================
   conta-api.js — ponte entre a interface e o servidor
   --------------------------------------------------------------------------
   ESTE ARQUIVO SUBSTITUI O CONTA_MOCK PARA TUDO QUE É AUTENTICAÇÃO.

   Antes, a interface conversava com CONTA_MOCK. Agora ela conversa com
   CONTA_API, que fala HTTP com as funções serverless em /api.

   DUAS SEPARAÇÕES QUE IMPORTAM:

   1. AUTENTICAÇÃO e DADOS PESSOAIS são REAIS. Vêm do servidor, com sessão
      em cookie HttpOnly. Nada de senha no navegador, nada em localStorage.
      O JavaScript da página NÃO tem acesso ao token da sessão — é o
      navegador que guarda e envia o cookie sozinho.

   2. PEDIDOS e ENDEREÇOS continuam DEMONSTRATIVOS nesta fase (o escopo
      desta rodada é autenticação). Eles vêm do CONTA_MOCK, continuam
      claramente marcados como mock, e serão trocados por HTTP depois.

   POR QUE O COOKIE VAI COM credentials: "same-origin"
   Sem isso, o navegador não envia o cookie de sessão e toda chamada voltaria
   401. "same-origin" (e não "include") é o suficiente porque a API mora no
   mesmo domínio do site — e é mais restritivo, o que é correto.
   ========================================================================== */

var CONTA_API = (function () {
  "use strict";

  var BASE = "/api";

  /* Erro de rede/servidor com uma mensagem que a interface pode mostrar. */
  function Falha(mensagem, campo, status) {
    var e = new Error(mensagem);
    e.campo = campo || null;
    e.status = status || 0;
    e.ehFalhaApi = true;
    return e;
  }

  /* ------------------------------------------------------------ pedido
     Devolve SEMPRE uma Promise. Nunca lança de forma síncrona, para quem
     chama poder usar .then().catch() sem try/catch em volta.            */
  function pedir(caminho, opcoes) {
    var cfg = opcoes || {};
    return new Promise(function (resolve, reject) {
      var init = {
        method: cfg.metodo || "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      };
      if (cfg.corpo !== undefined) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(cfg.corpo);
      }

      fetch(BASE + caminho, init)
        .then(function (r) {
          /* Lê o corpo mesmo em erro: a API sempre manda { erro }. */
          return r.text().then(function (texto) {
            var dados = {};
            try { dados = texto ? JSON.parse(texto) : {}; } catch (e) { dados = {}; }

            if (r.ok) return resolve({ status: r.status, dados: dados });

            var msg = dados.erro || "Não foi possível concluir agora.";
            reject(Falha(msg, dados.campo, r.status));
          });
        })
        .catch(function () {
          /* Só cai aqui quando o fetch em si falhou: sem rede, ou a API não
             respondeu. A mensagem é honesta sobre isso.                  */
          reject(Falha("Não consegui falar com o servidor. Confira a sua conexão e tente de novo."));
        });
    });
  }

  /* ================================================== AUTENTICAÇÃO (real) */
  var AUTH = {
    /* Cria a conta e já abre a sessão. */
    criarConta: function (dados) {
      return pedir("/auth/cadastro", {
        metodo: "POST",
        corpo: {
          nome: dados.nome,
          email: dados.email,
          whatsapp: dados.whatsapp,
          senha: dados.senha,
          confirmar: dados.confirmar,
          aceite: dados.aceite
        }
      }).then(function (r) { return r.dados.cliente; });
    },

    entrar: function (email, senha, manter) {
      return pedir("/auth/login", {
        metodo: "POST",
        corpo: { email: email, senha: senha, manter: !!manter }
      }).then(function (r) { return r.dados.cliente; });
    },

    sair: function () {
      return pedir("/auth/logout", { metodo: "POST" }).then(function () { return true; });
    },

    /* Quem está conectado agora. 401 -> rejeita com status 401. */
    eu: function () {
      return pedir("/auth/me").then(function (r) { return r.dados.cliente; });
    },

    /* Recuperação de senha: o servidor responde sempre a mesma coisa. */
    recuperar: function (email) {
      return pedir("/auth/recuperar", { metodo: "POST", corpo: { email: email } })
        .then(function (r) { return r.dados; });
    },

    redefinir: function (token, nova, confirmar) {
      return pedir("/auth/redefinir", {
        metodo: "POST",
        corpo: { token: token, nova: nova, confirmar: confirmar }
      }).then(function (r) { return r.dados; });
    }
  };

  /* ================================================ DADOS PESSOAIS (real) */
  var CONTA = {
    cliente: function () {
      return pedir("/cliente").then(function (r) { return r.dados.cliente; });
    },
    /* Só nome, WhatsApp e nascimento. O e-mail é somente leitura nesta fase. */
    atualizarCliente: function (dados) {
      return pedir("/cliente", {
        metodo: "PATCH",
        corpo: {
          nome: dados.nome,
          whatsapp: dados.whatsapp,
          nascimento: dados.nascimento
        }
      }).then(function (r) { return r.dados.cliente; });
    },
    trocarSenha: function (dados) {
      return pedir("/cliente/senha", {
        metodo: "POST",
        corpo: { atual: dados.atual, nova: dados.nova, confirmar: dados.confirmar }
      }).then(function (r) { return r.dados; });
    }
  };

  /* ===================================== PEDIDOS/ENDEREÇOS (MOCK, por ora)
     Marcados como mock DE PROPÓSITO, com `ehMock: true`. Assim fica óbvio no
     código — e para quem ler depois — que isto ainda não é dado persistido.
     Quando existir backend de pedidos, basta trocar estas funções por HTTP;
     a interface não muda.                                                */
  var DEMO = {
    ehMock: true,
    pedidos: function () { return CONTA_MOCK.API.pedidos(); },
    pedido: function (id) { return CONTA_MOCK.API.pedido(id); },
    enderecos: function () { return CONTA_MOCK.API.enderecos(); },
    salvarEndereco: function (e) { return CONTA_MOCK.API.salvarEndereco(e); },
    excluirEndereco: function (id) { return CONTA_MOCK.API.excluirEndereco(id); },
    definirPrincipal: function (id) { return CONTA_MOCK.API.definirPrincipal(id); }
  };

  return { AUTH: AUTH, CONTA: CONTA, DEMO: DEMO, pedir: pedir };
})();
