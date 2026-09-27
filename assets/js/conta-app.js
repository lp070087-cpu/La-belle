/* ==========================================================================
   conta-app.js — motor da AREA DO CLIENTE
   --------------------------------------------------------------------------
   Monta as secoes dentro de #painelConta e cuida da navegacao por hash.

   POR QUE O MODO DEMONSTRACAO EXISTE:
   o projeto nao tem servidor de login. Sem isso, a area do cliente seria
   impossivel de ver — e ela precisa ser vista para ser aprovada. Entao a
   sessao demo e um interruptor explicito, com faixa de aviso no topo,
   ativado apenas quando a pessoa pede por ele.

   O QUE A SESSAO DEMO **NAO** FAZ:
   - nao guarda senha (nenhum campo de senha passa por aqui);
   - nao escreve nada em localStorage;
   - nao finge autenticacao: na recarga da pagina ela volta ao login.

   CONTRATO DO BACKEND: tudo vem de CONTA_MOCK.API (ver conta-mock.js).
   Trocar o mock por fetch() liga a area do cliente de verdade.
   ========================================================================== */

var CONTA_APP = (function () {

  "use strict";

  /* ------------------------------------------------------------- estado */
  var S = {
    cliente: null,
    pedidos: [],
    enderecos: [],
    etapas: [],
    secao: "visao",
    pedidoAberto: null,
    demo: false
  };

  var R = {}; /* referencias do DOM */

  /* ---------------------------------------------------------- utilitarios */
  function escapa(t) { return LB.escapa(t); }

  function sel(raiz, s) { return (raiz || document).querySelector(s); }
  function todos(raiz, s) { return Array.prototype.slice.call((raiz || document).querySelectorAll(s)); }

  function icone(nome, cls) {
    return '<span class="' + (cls || "cx-ic") + '" aria-hidden="true">' + CONTA_UI.svg(nome) + "</span>";
  }

  /* O projeto nao inventa preco: os materiais da La Belle nao trazem valor.
     Onde o site publico escreve "Valor sob consulta", a area do cliente
     escreve o mesmo — em vez de somar numeros que ninguem informou.        */
  function valorHTML() {
    return '<span class="consulta">Valor sob consulta</span>';
  }

  function statusDe(p) { return CONTA_MOCK.STATUS[p.status] || { nome: p.status, tipo: "" }; }

  function seloStatus(p) {
    var st = statusDe(p);
    return '<span class="cx-selo cx-selo--' + st.tipo + '">' + escapa(st.nome) + "</span>";
  }

  function qtdItens(p) {
    return p.itens.reduce(function (s, i) { return s + i.qtd; }, 0);
  }

  function resumoPecas(p) {
    var n = qtdItens(p);
    return n === 1 ? "1 peça" : n + " peças";
  }

  /* nomes longos nao podem quebrar o cartao no celular */
  function tituloItens(p) {
    var nomes = p.itens.map(function (i) { return i.nome; });
    if (nomes.length === 1) return nomes[0];
    if (nomes.length === 2) return nomes[0] + " e " + nomes[1];
    return nomes[0] + " e mais " + (nomes.length - 1) + " peças";
  }

  function enderecoPorId(id) {
    var achou = null;
    S.enderecos.forEach(function (e) { if (e.id === id) achou = e; });
    return achou;
  }

  function enderecoLinha(e) {
    if (!e) return "—";
    var partes = [e.rua + ", " + e.numero];
    if (e.complemento) partes.push(e.complemento);
    partes.push(e.bairro);
    partes.push(e.cidade + "/" + e.uf);
    if (e.cep) partes.push("CEP " + e.cep);
    return partes.join(" · ");
  }

  /* ============================================================ 1. VISAO */
  function secaoVisao() {
    var primeiro = CONTA_UI.primeiroNome(S.cliente.nome);
    var ativos = S.pedidos.filter(function (p) { return p.status !== "entregue" && p.status !== "cancelado"; });
    var andamento = ativos.length ? ativos[0] : null;
    var est = statusDe(andamento || S.pedidos[0] || { status: "" });

    var h = '<section aria-labelledby="t-visao">' +
      '<div class="cx-cabeca">' +
        '<div><h1 id="t-visao" class="cx-titulo">Olá, ' + escapa(primeiro) + '</h1>' +
        '<p>Este é o resumo da sua conta na La Belle.</p></div>' +
      '</div>';

    h += '<div class="cx-grade">';
    h += '<div class="cx-cartao"><span>Pedidos</span><b>' + S.pedidos.length + '</b>' +
         '<small>desde ' + escapa(CONTA_UI.dataBR(S.cliente.desde)) + '</small></div>';
    h += '<div class="cx-cartao"><span>Em andamento</span><b>' + ativos.length + '</b>' +
         '<small>' + (ativos.length ? "a caminho da sua casa" : "nenhum pedido aberto") + '</small></div>';
    h += '<div class="cx-cartao"><span>Endereços</span><b>' + S.enderecos.length + '</b>' +
         '<small>' + (S.enderecos.length ? escapa((S.enderecos.filter(function (e) { return e.principal; })[0] || {}).cidade || "") : "cadastre um endereço") + '</small></div>';
    h += '</div>';

    if (andamento) {
      h += '<div class="cx-cartao cx-cartao--fita" style="margin-top:1rem">' +
        '<img src="' + escapa(LB.img("card", andamento.itens[0].foto.split("/")[1])) + '" alt="" width="54" height="68" loading="lazy">' +
        '<div><span>Último pedido · ' + escapa(andamento.id) + '</span>' +
        '<b>' + escapa(est.nome) + '</b>' +
        '<small>' + escapa(resumoPecas(andamento)) + ' · ' + escapa(tituloItens(andamento)) + '</small></div>' +
        '<button class="bt bt--vazio bt--pequeno" type="button" data-ir="pedido/' + escapa(andamento.id) + '" style="margin-left:auto">Ver pedido</button>' +
        '</div>';
    }

    h += '<div class="cx-atalhos">' +
      atalho("pedidos", "caixa", "Meus pedidos", S.pedidos.length + " no histórico") +
      atalho("enderecos", "local", "Endereços", S.enderecos.length + " cadastrados") +
      atalho("dados", "conta", "Meus dados", "nome, e-mail e WhatsApp") +
      atalho("seguranca", "escudo", "Segurança", "alterar a sua senha") +
      '</div>';

    h += "</section>";
    return h;
  }

  function atalho(secao, ico, titulo, sub) {
    return '<button class="cx-atalho" type="button" data-ir="' + secao + '">' +
      icone(ico) + '<span><b>' + escapa(titulo) + '</b><small>' + escapa(sub) + '</small></span></button>';
  }

  /* ========================================================= 2. PEDIDOS */
  function secaoPedidos() {
    var h = '<section aria-labelledby="t-pedidos">' +
      '<div class="cx-cabeca"><div>' +
      '<h1 id="t-pedidos" class="cx-titulo">Meus pedidos</h1>' +
      '<p>Toque em um pedido para ver as peças, o pagamento e a entrega.</p></div></div>';

    if (!S.pedidos.length) {
      h += "<p>Você ainda não fez nenhum pedido na La Belle.</p>";
      h += '<a class="bt bt--rosa" href="loja.html">Ver a loja</a></section>';
      return h;
    }

    h += '<div class="cx-pedidos">';
    S.pedidos.forEach(function (p) {
      var fotos = p.itens.slice(0, 3).map(function (i) {
        return '<img src="' + escapa(LB.img("card", i.foto.split("/")[1])) + '" alt="" width="54" height="68" loading="lazy">';
      }).join("");
      if (p.itens.length > 3) fotos += '<span class="cx-mais">+' + (p.itens.length - 3) + "</span>";

      h += '<article class="cx-pedido">' +
        '<div class="cx-pedido__topo">' +
          '<span class="cx-pedido__num">' + escapa(p.id) + '</span>' +
          '<span class="cx-pedido__data">' + escapa(CONTA_UI.dataBR(p.data)) + '</span>' +
          seloStatus(p) +
        '</div>' +
        '<div class="cx-pedido__corpo">' +
          '<div class="cx-pedido__fotos">' + fotos + '</div>' +
          '<div class="cx-pedido__info">' +
            '<b>' + escapa(tituloItens(p)) + '</b>' +
            '<span>' + escapa(resumoPecas(p)) + ' · ' + escapa(CONTA_UI.pagamentoBonito(p.pagamento)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="cx-pedido__pe">' +
          '<span class="cx-pedido__data">' + valorHTML() + '</span>' +
          '<button class="bt bt--vazio bt--pequeno" type="button" data-ir="pedido/' + escapa(p.id) + '">Ver pedido</button>' +
        '</div>' +
      '</article>';
    });
    h += "</div></section>";
    return h;
  }

  /* ================================================= 3. DETALHE PEDIDO */
  function secaoPedido(id) {
    var p = null;
    S.pedidos.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return secaoPedidos();

    var end = enderecoPorId(p.enderecoId);
    var cancelado = p.status === "cancelado";

    var h = '<section aria-labelledby="t-detalhe">' +
      '<button class="cx-voltar" type="button" data-ir="pedidos">' +
        '<span class="cx-ic" aria-hidden="true">' + CONTA_UI.svg("setaEsq") + "</span>" +
        "Voltar para os pedidos</button>" +
      '<div class="cx-detalhe__topo">' +
        '<h2 id="t-detalhe" class="cx-titulo" style="font-size:clamp(1.4rem,3vw,1.95rem)">Pedido ' + escapa(p.id) + '</h2>' +
        seloStatus(p) +
      '</div>' +
      '<p class="cx-sub" style="margin-bottom:1.2rem">Feito em ' + escapa(CONTA_UI.dataBR(p.data)) + '</p>';

    h += cancelado ? avisoCancelado() : linhaDoTempo(p.etapa);

    h += '<h3 class="cx-bloco" style="border:0;padding:0;margin-bottom:.7rem">Peças do pedido</h3>';
    h += '<div class="cx-itens">';
    p.itens.forEach(function (i) {
      h += '<div class="cx-item">' +
        '<img src="' + escapa(LB.img("card", i.foto.split("/")[1])) + '" alt="" width="66" height="84" loading="lazy">' +
        '<div class="cx-item__txt"><b>' + escapa(i.nome) + '</b>' +
        '<span>Tamanho ' + escapa(i.tam) + ' · Quantidade ' + i.qtd + '</span></div>' +
        '<div class="cx-item__preco">' + valorHTML() + '</div>' +
        '</div>';
    });
    h += "</div>";

    /* resumo: sem preco real, nenhuma linha soma dinheiro */
    h += '<div class="cx-resumo">' +
      '<dl>' +
        linhaResumo("Subtotal", valorHTML()) +
        linhaResumo("Frete", escapa(p.frete)) +
        linhaResumo("Forma de pagamento", escapa(CONTA_UI.pagamentoBonito(p.pagamento))) +
        '<div class="cx-total"><dt>Total</dt><dd>' + valorHTML() + "</dd></div>" +
      "</dl></div>";

    h += '<div class="cx-blocos">' +
      '<div class="cx-bloco"><h3>Endereço de entrega</h3>' +
        (end ? "<p><b>" + escapa(end.destinatario) + "</b><br>" + escapa(enderecoLinha(end)) + "</p>"
             : "<p>Endereço não informado.</p>") +
      "</div>" +
      '<div class="cx-bloco"><h3>Entrega</h3><p>' +
        "<b>" + escapa(p.frete) + "</b><br>" + escapa(p.prazo) +
        (p.rastreio ? '<br><span class="cx-rastreio">Código de rastreio ' + escapa(p.rastreio) + "</span>" : "") +
      "</p></div>" +
      '<div class="cx-bloco"><h3>Status atual</h3><p><b>' + escapa(statusDe(p).nome) + "</b></p>" +
        '<p style="margin-top:.5rem"><a class="lk" href="' + escapa(LB.LOJA.whatsapp) + '" target="_blank" rel="noopener">Falar com a loja sobre este pedido</a></p>' +
      "</div>" +
    "</div>";

    h += "</section>";
    return h;
  }

  function linhaResumo(rotulo, valor) {
    return "<div><dt>" + escapa(rotulo) + "</dt><dd>" + valor + "</dd></div>";
  }

  function linhaDoTempo(atual) {
    var h = '<div class="cx-linha"><div class="cx-linha__trilho">';
    S.etapas.forEach(function (e, i) {
      var cls = i < atual ? "feita" : (i === atual ? "atual" : "");
      h += '<div class="cx-linha__etapa ' + cls + '">' +
        '<span class="cx-linha__marca" aria-hidden="true"></span>' +
        '<span class="cx-linha__pt" aria-hidden="true"></span>' +
        '<span class="cx-linha__nome">' + escapa(e.nome) + "</span></div>";
    });
    h += "</div></div>";
    return h;
  }

  function avisoCancelado() {
    return '<div class="cx-cancelado">' + icone("info") +
      "<p><b>Este pedido foi cancelado.</b> Se ficou alguma dúvida sobre o cancelamento ou sobre " +
      "um possível reembolso, fale direto com a loja pelo WhatsApp — a La Belle responde por lá.</p></div>";
  }

  /* ======================================================= 4. ENDERECOS */
  function secaoEnderecos() {
    var h = '<section aria-labelledby="t-end">' +
      '<div class="cx-cabeca"><div>' +
      '<h1 id="t-end" class="cx-titulo">Endereços</h1>' +
      '<p>O endereço principal é o que vem sugerido nas próximas compras.</p></div></div>';

    h += '<div class="cx-enderecos">';
    S.enderecos.forEach(function (e) {
      h += '<article class="cx-endereco' + (e.principal ? " cx-endereco--principal" : "") + '">' +
        '<div class="cx-endereco__topo"><b>' + escapa(e.rotulo || "Endereço") + "</b>" +
          (e.principal ? '<span class="cx-tag">Principal</span>' : "") + "</div>" +
        "<p>" + escapa(e.destinatario) + "<br>" + escapa(enderecoLinha(e)) + "</p>" +
        '<div class="cx-endereco__acoes">' +
          '<button class="cx-bt-mini" type="button" data-editar="' + escapa(e.id) + '">' + icone("documento") + "Editar</button>" +
          (e.principal ? "" : '<button class="cx-bt-mini" type="button" data-principal="' + escapa(e.id) + '">' + icone("check") + "Definir principal</button>") +
          '<button class="cx-bt-mini cx-bt-mini--perigo" type="button" data-excluir="' + escapa(e.id) + '">' + icone("lixo") + "Excluir</button>" +
        "</div></article>";
    });

    h += '<button class="cx-endereco cx-endereco--novo" type="button" data-editar="">' +
      icone("mais") + "<b>Adicionar endereço</b></button>";
    h += "</div></section>";
    return h;
  }

  /* formulario de endereco — reaproveita .campo/.entrada/.bt do site */
  function formEndereco(e) {
    var v = e || {};
    function campo(nome, rotulo, valor, extra) {
      return '<label class="campo"><span class="rotulo">' + rotulo + "</span>" +
        '<input class="entrada" name="' + nome + '" value="' + escapa(valor || "") + '" ' + (extra || "") + "></label>";
    }
    return '<section aria-labelledby="t-endform">' +
      '<button class="cx-voltar" type="button" data-ir="enderecos">' +
        '<span class="cx-ic" aria-hidden="true">' + CONTA_UI.svg("setaEsq") + "</span>" +
        "Voltar para os endereços</button>" +
      '<h2 id="t-endform" class="cx-titulo" style="font-size:clamp(1.4rem,3vw,1.95rem)">' +
        (e ? "Editar endereço" : "Novo endereço") + "</h2>" +
      '<p class="cx-sub">Nesta fase os dados de endereço também são de demonstração: nada é enviado para nenhum servidor.</p>' +
      '<form class="cx-form" id="formEndereco" novalidate>' +
        '<input type="hidden" name="id" value="' + escapa(v.id || "") + '">' +
        '<div class="cx-form__grade">' +
          campo("rotulo", "Identificação", v.rotulo, 'placeholder="Casa, Trabalho..."') +
          campo("destinatario", "Quem recebe", v.destinatario || (S.cliente ? S.cliente.nome : "")) +
          campo("cep", "CEP", v.cep, 'inputmode="numeric" placeholder="00000-000"') +
          campo("numero", "Número", v.numero, 'inputmode="numeric"') +
        "</div>" +
        campo("rua", "Rua", v.rua) +
        '<div class="cx-form__grade">' +
          campo("complemento", "Complemento", v.complemento, 'placeholder="Apto, bloco..."') +
          campo("bairro", "Bairro", v.bairro) +
          campo("cidade", "Cidade", v.cidade) +
          campo("uf", "Estado", v.uf, 'maxlength="2" placeholder="PE"') +
        "</div>" +
        '<label class="escolha" style="margin:.3rem 0 1.3rem">' +
          '<input type="checkbox" name="principal"' + (v.principal ? " checked" : "") + ">" +
          "<span>Usar como endereço principal</span></label>" +
        '<div class="cx-form__acoes">' +
          '<button class="bt bt--rosa" type="submit">' + (e ? "Salvar alterações" : "Adicionar endereço") + "</button>" +
          '<button class="bt bt--vazio" type="button" data-ir="enderecos">Cancelar</button>' +
        "</div>" +
      "</form></section>";
  }

  /* ======================================================== 5. MEUS DADOS */
  function secaoDados(cliente) {
    var c = cliente || S.cliente;
    var ehForm = !!cliente;
    var inicial = CONTA_UI.iniciais(c.nome);

    var h = '<section aria-labelledby="t-dados">' +
      '<div class="cx-cabeca"><div>' +
      '<h1 id="t-dados" class="cx-titulo">Meus dados</h1>' +
      "<p>Como a La Belle fala com você e como você aparece na sua conta.</p></div></div>";

    h += '<div class="cx-grade" style="margin-bottom:1.6rem">' +
      '<div class="cx-cartao"><span>Nome na conta</span><b style="font-size:1.1rem">' +
        '<span style="display:inline-flex;align-items:center;gap:.6rem">' +
        '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--rosa-lavado);color:var(--rosa-escuro);font-family:var(--sans);font-size:.78rem">' + escapa(inicial) + "</span>" +
        escapa(c.nome) + "</span></b>" +
        '<small>' + escapa(c.email) + "</small></div>" +
      '<div class="cx-cartao"><span>Cliente desde</span><b style="font-size:1.1rem">' + escapa(CONTA_UI.dataBR(c.desde)) + "</b>" +
        '<small>' + escapa(resumoPecas({ itens: S.pedidos.reduce(function (a, p) { return a.concat(p.itens); }, []) })) + " no total</small></div>" +
      "</div>";

    h += '<form class="cx-form" id="formDados" novalidate>' +
      '<div class="cx-form__grade">' +
        '<label class="campo"><span class="rotulo">Nome completo</span>' +
          '<input class="entrada" name="nome" value="' + escapa(c.nome) + '" autocomplete="name" required></label>' +
        '<label class="campo"><span class="rotulo">Data de nascimento</span>' +
          '<input class="entrada" type="date" name="nascimento" value="' + escapa(c.nascimento || "") + '"></label>' +
        '<label class="campo"><span class="rotulo">E-mail</span>' +
          '<input class="entrada" type="email" name="email" value="' + escapa(c.email) + '" autocomplete="email" required></label>' +
        '<label class="campo"><span class="rotulo">WhatsApp</span>' +
          '<input class="entrada" type="tel" name="whatsapp" value="' + escapa(c.whatsapp) + '" inputmode="tel" autocomplete="tel"></label>' +
      "</div>" +
      '<div class="cx-form__acoes">' +
        '<button class="bt bt--rosa" type="submit">Salvar os meus dados</button>' +
        '<button class="bt bt--vazio" type="button" data-ir="visao">Cancelar</button>' +
      "</div>" +
    "</form></section>";
    return h;
  }

  /* ======================================================= 6. SEGURANCA */
  function secaoSeguranca() {
    return '<section aria-labelledby="t-seg">' +
      '<div class="cx-cabeca"><div>' +
      '<h1 id="t-seg" class="cx-titulo">Segurança</h1>' +
      "<p>Trocar a senha da sua conta La Belle.</p></div></div>" +

      '<div class="cx-aviso">' + icone("info") +
      "<p><b>Esta tela não guarda a sua senha.</b> A troca de senha depende do servidor de login, " +
      "que ainda não existe neste projeto. Os campos abaixo conferem as regras, mas nenhuma senha " +
      "é enviada ou armazenada — nem aqui, nem no seu navegador.</p></div>" +

      '<form class="cx-form" id="formSenha" novalidate>' +
        '<label class="campo"><span class="rotulo">Senha atual</span>' +
          '<input class="entrada" type="password" name="atual" autocomplete="current-password" required></label>' +
        '<label class="campo"><span class="rotulo">Nova senha</span>' +
          '<input class="entrada" type="password" name="nova" autocomplete="new-password" placeholder="Pelo menos 8 caracteres" required></label>' +
        '<div class="forca" data-nivel="0"><div class="forca__barras" aria-hidden="true">' +
          '<span class="forca__barra"></span><span class="forca__barra"></span>' +
          '<span class="forca__barra"></span><span class="forca__barra"></span></div>' +
          '<span class="forca__txt">Força da senha</span></div>' +
        '<label class="campo"><span class="rotulo">Confirmar nova senha</span>' +
          '<input class="entrada" type="password" name="nova2" autocomplete="new-password" required></label>' +
        '<div class="cx-form__acoes">' +
          '<button class="bt bt--rosa" type="submit">Alterar a minha senha</button>' +
        "</div>" +
      "</form>" +

      '<div class="cx-secao" style="margin-top:2rem;padding-top:1.6rem">' +
        "<h2>Sair da conta</h2>" +
        "<p>Encerra a sessão neste navegador e volta para a tela de acesso.</p>" +
        '<button class="bt bt--vazio" type="button" id="btSairLongo">' + "Sair da conta" + "</button>" +
      "</div>" +
    "</section>";
  }

  /* ========================================================= 7. FAVORITOS
     Esta secao NAO e nova funcionalidade: o coracao do cabecalho, o aviso
     "Salvo nos favoritos" e os links do rodape e da gaveta ja apontavam para
     conta.html#favoritos. Ela e mantida aqui para esses links continuarem
     funcionando — apagar seria regressao.
     Reaproveita o motor do site: LB.estado.favoritos e LB.desenharCartoes. */
  function secaoFavoritos() {
    var ids = (LB.estado && LB.estado.favoritos) || [];
    var lista = ids.map(function (id) { return buscaProduto(id); })
                   .filter(function (p) { return !!p; });

    var h = '<section aria-labelledby="t-fav">' +
      '<div class="cx-cabeca"><div>' +
      '<h1 id="t-fav" class="cx-titulo">Favoritos</h1>' +
      '<p>As peças que você guardou tocando no coração.</p></div></div>';

    if (!lista.length) {
      h += '<div class="cx-cartao" style="text-align:center;padding:2.4rem 1.4rem">' +
        "<p style='color:var(--cinza)'>Você ainda não salvou nenhuma peça.</p>" +
        '<a class="bt bt--rosa" href="loja.html" style="margin-top:1rem">Ver a loja</a></div>';
      h += "</section>";
      return h;
    }

    h += '<div class="grade-produtos" id="gradeFavoritos"></div></section>';
    return h;
  }

  /* =========================================================== 8. RENDER */
  var TITULOS = {
    visao: "Visão geral", pedidos: "Meus pedidos", enderecos: "Endereços",
    dados: "Meus dados", seguranca: "Segurança", endereco: "Endereço",
    favoritos: "Favoritos"
  };

  function render() {
    var h;
    if (S.secao === "pedido") h = secaoPedido(S.pedidoAberto);
    else if (S.secao === "enderecos") h = secaoEnderecos();
    else if (S.secao === "endereco") h = formEndereco(S.enderecoEditando);
    else if (S.secao === "dados") h = secaoDados(null);
    else if (S.secao === "seguranca") h = secaoSeguranca();
    else if (S.secao === "favoritos") h = secaoFavoritos();
    else h = secaoVisao();

    R.caixa.innerHTML = h;

    /* os favoritos reusam o MESMO cartao de produto do site */
    if (S.secao === "favoritos") {
      var ids = (LB.estado && LB.estado.favoritos) || [];
      var lista = ids.map(function (id) { return buscaProduto(id); })
                     .filter(function (p) { return !!p; });
      if (lista.length) LB.desenharCartoes("#gradeFavoritos", lista);
    }

    /* marca a aba ativa (o hash do detalhe pertence a aba de pedidos) */
    var abaMaior = (S.secao === "pedido") ? "pedidos" : (S.secao === "endereco" ? "enderecos" : S.secao);
    todos(R.menu, "button[data-aba]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-aba") === abaMaior);
    });

    ligarAcoes();
    CONTA_UI.prepararSenhas(R.caixa);
    CONTA_UI.pintarIcones(R.caixa);
  }

  /* ------------------------------------------------------- eventos */
  function ligarAcoes() {
    /* navegacao interna: botao com data-ir="secao" ou "pedido/ID" */
    todos(R.caixa, "[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var destino = b.getAttribute("data-ir");
        abrirRota(destino);
      });
    });

    /* enderecos */
    todos(R.caixa, "[data-editar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-editar");
        S.enderecoEditando = id ? copia(enderecoPorId(id)) : null;
        S.secao = "endereco";
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    todos(R.caixa, "[data-principal]").forEach(function (b) {
      b.addEventListener("click", function () {
        CONTA_MOCK.API.definirPrincipal(b.getAttribute("data-principal")).then(function (lista) {
          S.enderecos = lista; render(); toast("Endereço principal atualizado");
        });
      });
    });
    todos(R.caixa, "[data-excluir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-excluir");
        if (!window.confirm("Excluir este endereço?")) return;
        CONTA_MOCK.API.excluirEndereco(id).then(function (lista) {
          S.enderecos = lista; render(); toast("Endereço excluído");
        });
      });
    });

    var fe = sel(R.caixa, "#formEndereco");
    if (fe) fe.addEventListener("submit", submitEndereco);

    var fd = sel(R.caixa, "#formDados");
    if (fd) fd.addEventListener("submit", submitDados);

    var fs = sel(R.caixa, "#formSenha");
    if (fs) fs.addEventListener("submit", submitSenha);

    var sair = sel(R.caixa, "#btSairLongo");
    if (sair) sair.addEventListener("click", sairDaConta);

    /* medidor de forca do formulario de seguranca */
    if (fs) {
      var nova = sel(fs, "[name=nova]");
      var fEl = sel(fs, ".forca");
      nova.addEventListener("input", function () {
        var r = CONTA_UI.forcaSenha(nova.value);
        fEl.setAttribute("data-nivel", String(nova.value ? r.nivel : 0));
        sel(fEl, ".forca__txt").textContent = nova.value ? r.rotulo : "Força da senha";
      });
    }
  }

  function copia(x) { return x ? JSON.parse(JSON.stringify(x)) : x; }

  function toast(msg) { if (LB.toast) LB.toast(msg); }

  /* -------------------------------------------------- envio: endereco */
  function submitEndereco(e) {
    e.preventDefault();
    var f = e.target;
    CONTA_UI.limparTudo(f);

    var g = function (n) { return f.querySelector("[name=" + n + "]"); };
    var obrig = [
      { el: g("rua"), msg: "Digite a rua." },
      { el: g("numero"), msg: "Digite o número." },
      { el: g("bairro"), msg: "Digite o bairro." },
      { el: g("cidade"), msg: "Digite a cidade." },
      { el: g("uf"), msg: "Digite o estado (duas letras)." }
    ];
    obrig.forEach(function (o) { if (!o.el.value.trim()) CONTA_UI.marcarErro(o.el, o.msg); });
    if (CONTA_UI.focarPrimeiroErro(f)) return;

    var dados = {
      id: g("id").value || null,
      rotulo: g("rotulo").value.trim(),
      destinatario: g("destinatario").value.trim() || S.cliente.nome,
      cep: g("cep").value.trim(),
      rua: g("rua").value.trim(),
      numero: g("numero").value.trim(),
      complemento: g("complemento").value.trim(),
      bairro: g("bairro").value.trim(),
      cidade: g("cidade").value.trim(),
      uf: g("uf").value.trim().toUpperCase().slice(0, 2),
      principal: g("principal").checked
    };

    CONTA_MOCK.API.salvarEndereco(dados).then(function (lista) {
      S.enderecos = lista;
      S.secao = "enderecos";
      render();
      toast(dados.id ? "Endereço atualizado" : "Endereço adicionado");
    });
  }

  /* ----------------------------------------------------- envio: dados */
  function submitDados(e) {
    e.preventDefault();
    var f = e.target;
    CONTA_UI.limparTudo(f);

    var nome = f.querySelector("[name=nome]");
    var email = f.querySelector("[name=email]");
    var whats = f.querySelector("[name=whatsapp]");
    var nasc = f.querySelector("[name=nascimento]");

    if (nome.value.trim().length < 3) CONTA_UI.marcarErro(nome, "Digite o seu nome completo.");
    else if (nome.value.trim().indexOf(" ") < 1) CONTA_UI.marcarErro(nome, "Inclua também o sobrenome.");
    if (!CONTA_UI.ehEmail(email.value)) CONTA_UI.marcarErro(email, "Confira o seu e-mail, por favor.");
    if (CONTA_UI.digitos(whats.value).length < 10) CONTA_UI.marcarErro(whats, "Digite o DDD e o número.");
    if (CONTA_UI.focarPrimeiroErro(f)) return;

    CONTA_MOCK.API.atualizarCliente({
      nome: nome.value.trim(),
      email: email.value.trim(),
      whatsapp: whats.value.trim(),
      nascimento: nasc.value
    }).then(function (c) {
      S.cliente = c;
      pintarQuem();
      render();
      toast("Os seus dados foram salvos");
    });
  }

  /* -------------------------------------------------- envio: senha
     Nenhuma senha e guardada. O formulario confere as regras, avisa que a
     troca depende do backend e limpa os campos em seguida.               */
  function submitSenha(e) {
    e.preventDefault();
    var f = e.target;
    CONTA_UI.limparTudo(f);

    var atual = f.querySelector("[name=atual]");
    var nova = f.querySelector("[name=nova]");
    var nova2 = f.querySelector("[name=nova2]");

    if (!atual.value) CONTA_UI.marcarErro(atual, "Digite a sua senha atual.");
    if (CONTA_UI.forcaSenha(nova.value).fraca) {
      CONTA_UI.marcarErro(nova, "Use pelo menos 8 caracteres, misturando letras e números.");
    }
    if (!nova2.value) CONTA_UI.marcarErro(nova2, "Repita a nova senha.");
    else if (nova2.value !== nova.value) CONTA_UI.marcarErro(nova2, "As duas senhas estão diferentes.");
    if (CONTA_UI.focarPrimeiroErro(f)) return;

    var botao = f.querySelector('button[type="submit"]');
    botao.disabled = true;
    CONTA_MOCK.API.trocarSenha({ nova: nova.value })
      ["catch"](function () {})
      .then(function () {
        f.reset();
        var fEl = f.querySelector(".forca");
        if (fEl) { fEl.setAttribute("data-nivel", "0"); f.querySelector(".forca__txt").textContent = "Força da senha"; }
        botao.disabled = false;
        toast("Pronto! Com o servidor ligado, a senha seria alterada agora");
      });
  }

  /* ==================================================== 8. SESSAO */
  function pintarQuem() {
    if (!R.quem) return;
    sel(R.quem, "[data-quem-nome]").textContent = S.cliente ? S.cliente.nome : "Visitante";
    sel(R.quem, "[data-quem-email]").textContent = S.cliente ? S.cliente.email : "—";
  }

  function sairDaConta() {
    CONTA_MOCK.API.sair().then(function () {
      S.demo = false;
      document.body.classList.remove("em-demo");
      R.painel.classList.add("oculto");
      R.portao.classList.remove("oculto");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Você saiu da conta");
    });
  }

  /* roteamento por hash: #visao, #pedidos, #pedido/LB-24960, #enderecos,
     #endereco/novo, #dados, #seguranca — assim o botao "voltar" do celular
     funciona e cada tela pode ser linkada direto.                         */
  function abrirRota(rota) {
    var partes = String(rota || "visao").split("/");
    var alvo = partes[0];
    if (alvo === "pedido" && partes[1]) { S.secao = "pedido"; S.pedidoAberto = partes[1]; }
    else if (alvo === "endereco") { S.secao = "endereco"; S.enderecoEditando = null; }
    else S.secao = TITULOS[alvo] ? alvo : "visao";
    location.hash = "#" + rota;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function rotaDoHash() {
    return (location.hash || "#visao").replace("#", "");
  }

  /* ========================================================= 9. INICIO */
  function iniciar() {
    R.portao = document.querySelector("#portao");
    R.painel = document.querySelector("#painel");
    R.caixa = document.querySelector("#painelConta");
    R.menu = document.querySelector(".conta__menu");
    R.quem = document.querySelector(".conta__quem");
    R.demo = document.querySelector("#modoDemo");

    /* abas do menu lateral */
    if (R.menu) {
      todos(R.menu, "button[data-aba]").forEach(function (b) {
        b.addEventListener("click", function () { abrirRota(b.getAttribute("data-aba")); });
      });
    }

    var btSair = document.querySelector("#sair");
    if (btSair) btSair.addEventListener("click", sairDaConta);

    /* modo demonstracao: só entra se a pessoa pedir */
    var btDemo = document.querySelector("#btDemo");
    if (btDemo) {
      btDemo.addEventListener("click", function () {
        R.portao.classList.add("oculto");
        R.painel.classList.remove("oculto");
        document.body.classList.add("em-demo");
        S.demo = true;
        carregar();
      });
    }

    if (R.demo) {
      var btSairDemo = document.querySelector("#sairDemo");
      if (btSairDemo) btSairDemo.addEventListener("click", sairDaConta);
    }

    window.addEventListener("hashchange", function () {
      if (!S.demo) return;
      var r = rotaDoHash();
      var partes = r.split("/");
      if (partes[0] === "pedido" && partes[1]) { S.secao = "pedido"; S.pedidoAberto = partes[1]; }
      else if (partes[0] === "endereco") { S.secao = "endereco"; }
      else if (partes[0] === "pedidos" && S.secao === "pedido") { S.secao = "pedidos"; }
      else S.secao = TITULOS[partes[0]] ? partes[0] : S.secao;
      render();
    });
  }

  function carregar() {
    var A = CONTA_MOCK.API;
    Promise.all([A.cliente(), A.pedidos(), A.enderecos()]).then(function (r) {
      S.cliente = r[0];
      S.pedidos = r[1];
      S.enderecos = r[2];
      S.etapas = CONTA_MOCK.ETAPAS;
      pintarQuem();

      var r0 = rotaDoHash().split("/");
      if (r0[0] === "pedido" && r0[1]) { S.secao = "pedido"; S.pedidoAberto = r0[1]; }
      else S.secao = TITULOS[r0[0]] ? r0[0] : "visao";

      render();
    });
  }

  return { iniciar: iniciar, carregar: carregar, estado: S };
})();
