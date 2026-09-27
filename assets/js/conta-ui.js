/* ==========================================================================
   conta-ui.js — pecas de formulario reaproveitadas por login, cadastro e
   area do cliente.
   --------------------------------------------------------------------------
   Nao cria identidade nova: usa as classes que o site ja tem
   (.campo, .rotulo, .entrada, .aviso-erro, .escolha, .lk) e o ICO do ui.js.

   REGRA: este arquivo NAO guarda senha, nem em memoria, nem em lugar nenhum.
   As funcoes de senha apenas leem o campo e devolvem o valor para quem
   chamou, que o descarta em seguida.
   ========================================================================== */

var CONTA_UI = (function () {

  "use strict";

  var OLHO_ABERTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  var OLHO_FECHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 3.8"/><path d="M6.4 7.9A17 17 0 0 0 2 12s3.6 6 10 6a9.9 9.9 0 0 0 4-.8"/><path d="M9.6 9.7a3 3 0 0 0 4.2 4.2"/></svg>';

  /* ---------------------------------------------------------- icones
     O HTML carrega <span data-ico="nome"></span> em vez de repetir SVG
     grande no meio da marcacao. Pinta com o mesmo ICO do ui.js, para a
     area do cliente usar exatamente os icones do site publico.            */
  var FALLBACK = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };
  /* fonte unica do icone: procura no ICO do site e, se nao houver, no
     FALLBACK. Assim nunca aparece um buraco onde devia haver um icone.  */
  function svg(nome) {
    var base = (typeof LB !== "undefined" && LB.ICO) ? LB.ICO : {};
    return base[nome] || FALLBACK[nome] || "";
  }

  function pintarIcones(raiz) {
    var alvos = (raiz || document).querySelectorAll("[data-ico]");
    Array.prototype.forEach.call(alvos, function (el) {
      if (el.dataset.icoPintado) return;
      el.innerHTML = svg(el.getAttribute("data-ico"));
      el.dataset.icoPintado = "1";
    });
  }

  /* ------------------------------------------------------- olho da senha */
  function prepararSenhas(raiz) {
    var alvos = (raiz || document).querySelectorAll('input[type="password"]');
    Array.prototype.forEach.call(alvos, function (inp) {
      var campo = inp.closest(".campo");
      if (!campo || campo.classList.contains("campo--senha")) return;
      campo.classList.add("campo--senha");

      var bt = document.createElement("button");
      bt.type = "button";
      bt.className = "olho-bt";
      bt.setAttribute("aria-label", "Mostrar a senha");
      bt.setAttribute("aria-pressed", "false");
      bt.innerHTML = OLHO_ABERTO;
      campo.appendChild(bt);

      bt.addEventListener("click", function () {
        var mostrando = inp.type === "text";
        inp.type = mostrando ? "password" : "text";
        bt.setAttribute("aria-pressed", mostrando ? "false" : "true");
        bt.setAttribute("aria-label", mostrando ? "Mostrar a senha" : "Ocultar a senha");
        bt.innerHTML = mostrando ? OLHO_ABERTO : OLHO_FECHADO;
        /* devolve o foco ao campo, sem mover o cursor para o inicio */
        var fim = inp.value.length;
        inp.focus();
        try { inp.setSelectionRange(fim, fim); } catch (e) {}
      });
    });
  }

  /* ----------------------------------------------------- erros visiveis
     O CSS do site ja define: .campo.tem-erro .aviso-erro { display:block } */
  function marcarErro(inp, mensagem) {
    var campo = inp.closest(".campo");
    if (!campo) return;
    campo.classList.add("tem-erro");
    inp.classList.add("entrada--erro");
    inp.setAttribute("aria-invalid", "true");
    var av = campo.querySelector(".aviso-erro");
    if (!av) {
      av = document.createElement("span");
      av.className = "aviso-erro";
      campo.appendChild(av);
    }
    av.textContent = mensagem;
    var id = campo.dataset.erroId || (campo.dataset.erroId = "err-" + Math.random().toString(36).slice(2, 8));
    av.id = id;
    inp.setAttribute("aria-describedby", id);
  }

  function limparErro(inp) {
    var campo = inp.closest(".campo");
    if (!campo) return;
    campo.classList.remove("tem-erro");
    inp.classList.remove("entrada--erro");
    inp.removeAttribute("aria-invalid");
    inp.removeAttribute("aria-describedby");
  }

  function limparTudo(raiz) {
    var alvos = (raiz || document).querySelectorAll(".campo");
    Array.prototype.forEach.call(alvos, function (c) {
      c.classList.remove("tem-erro");
    });
    Array.prototype.forEach.call((raiz || document).querySelectorAll(".entrada"), function (i) {
      i.classList.remove("entrada--erro");
      i.removeAttribute("aria-invalid");
      i.removeAttribute("aria-describedby");
    });
  }

  /* foca o primeiro campo com erro — no celular isso rola ate ele */
  function focarPrimeiroErro(raiz) {
    var p = (raiz || document).querySelector(".campo.tem-erro .entrada, .campo.tem-erro input");
    if (p) { try { p.focus({ preventScroll: false }); } catch (e) { p.focus(); } }
    return !!p;
  }

  /* ------------------------------------------------------------ mascara
     Formata enquanto digita, sem nunca brigar com o cursor: so reescreve
     quando o texto formatado e diferente do que esta no campo.            */
  function mascaraTelefone(inp) {
    function aplica() {
      var d = inp.value.replace(/\D/g, "").slice(0, 11);
      var saida = d;
      if (d.length > 2) saida = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 7) saida = "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
      if (saida !== inp.value) inp.value = saida;
    }
    inp.addEventListener("input", aplica);
    aplica();
  }

  /* ------------------------------------------------------------ validacao */
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function ehEmail(v) { return RE_EMAIL.test(String(v || "").trim()); }
  function digitos(v) { return String(v || "").replace(/\D/g, ""); }

  /* 0 a 10. Letra, numero e simbolo. Nao exige nada que nao seja justo. */
  function forcaSenha(s) {
    s = String(s || "");
    if (!s) return { nivel: 0, rotulo: "—", fraca: true };
    var p = 0;
    if (s.length >= 6) p++;
    if (s.length >= 10) p++;
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++;
    if (/\d/.test(s)) p++;
    if (/[^A-Za-z0-9]/.test(s)) p++;
    var nivel = Math.min(4, p);
    var rotulos = ["Muito fraca", "Fraca", "Razoavel", "Boa", "Forte"];
    return { nivel: nivel, rotulo: rotulos[nivel], fraca: nivel < 2 || s.length < 8 };
  }

  /* -------------------------------------------------- data em pt-BR
     Aceita "AAAA-MM-DD" (valor do input type=date) e devolve "12/04/1996".
     Nao usa new Date() para nao escorregar de fuso.                       */
  function dataBR(iso) {
    if (!iso) return "";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(iso);
    return m[3] + "/" + m[2] + "/" + m[1];
  }

  /* ----------------------------------------------- rotulos amigaveis
     Usados so na exibicao, para nao mostrar "Cartao de credito" cru.     */
  var PAGAMENTO_BONITO = {
    "Pix": "Pix",
    "Cartao de credito": "Cartao de credito",
    "Cartao de debito": "Cartao de debito",
    "Dinheiro na entrega local": "Dinheiro na entrega"
  };
  function pagamentoBonito(p) { return PAGAMENTO_BONITO[p] || p || "—"; }

  function iniciais(nome) {
    var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "LB";
    var a = partes[0].charAt(0);
    var b = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
    return (a + b).toUpperCase();
  }

  function primeiroNome(nome) {
    return String(nome || "").trim().split(/\s+/)[0] || "";
  }

  return {
    svg: svg,
    pintarIcones: pintarIcones,
    prepararSenhas: prepararSenhas,
    marcarErro: marcarErro,
    limparErro: limparErro,
    limparTudo: limparTudo,
    focarPrimeiroErro: focarPrimeiroErro,
    mascaraTelefone: mascaraTelefone,
    ehEmail: ehEmail,
    digitos: digitos,
    forcaSenha: forcaSenha,
    dataBR: dataBR,
    pagamentoBonito: pagamentoBonito,
    iniciais: iniciais,
    primeiroNome: primeiroNome
  };
})();
