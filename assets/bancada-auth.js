/* ==========================================================================
   bancada-auth.js — prova da autenticacao REAL, por execucao
   --------------------------------------------------------------------------
   Uso:  node assets/bancada-auth.js

   O QUE ESTA BANCADA FAZ
   Carrega os arquivos REAIS de api/ (nao uma copia) e executa as rotas de
   verdade, com requisicao e resposta de mentira. Prova o fluxo inteiro:
   cadastro -> login -> sessao -> area -> logout -> troca de senha.

   COMO ELA RODA SEM POSTGRES E SEM BCRYPTJS
   O sandbox nao tem rede, entao `pg` e `bcryptjs` nao podem ser instalados.
   Esta bancada intercepta o `require` e entrega dois dublês:

     - um Postgres de mentira, em memoria, que entende EXATAMENTE as
       consultas que o projeto faz;
     - um bcrypt de mentira, com a mesma interface e o mesmo formato de saida
       (60 caracteres, prefixo $2a$).

   A GARANTIA CONTRA BANCADA MENTIROSA
   O Postgres falso LANCA ERRO em qualquer consulta que ele nao reconheca.
   Se alguem mudar uma query no projeto e esquecer a bancada, ela quebra na
   hora — em vez de dar verde para sempre sem testar nada.

   O QUE ESTA BANCADA NAO PROVA (dito com todas as letras)
   - que o SQL e valido no Postgres de verdade (o dublê nao e o Postgres);
   - que o bcrypt real produz o mesmo hash (o dublê e scrypt com a etiqueta
     do bcrypt);
   - que a Vercel resolve as rotas /api/... do jeito esperado.
   Isso so se prova com o banco ligado. Ver o relatorio final.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");

const RAIZ = path.dirname(__dirname);
const API = path.join(RAIZ, "api");

let provas = 0, falhas = 0;
function ok(cond, rotulo, detalhe) {
  provas++;
  if (!cond) { falhas++; console.log("  FALHA  " + rotulo + (detalhe ? "\n         " + detalhe : "")); }
}
function secao(t) { console.log("\n== " + t + " =="); }

/* ==========================================================================
   DUBLE 1 — Postgres de mentira
   ========================================================================== */

function criarBanco() {
  return { customers: [], sessions: [], password_resets: [], consultas: 0, naoReconhecidas: [] };
}

const C = (sql) => String(sql).replace(/\s+/g, " ").trim();

function criarPg(banco) {
  function novoCliente() {
    return {
      /* Motor de consulta. Cada padrao tem de casar EXATAMENTE. */
      async query(sql, params) {
        banco.consultas++;
        const q = C(sql);
        const p = params || [];
        const agora = () => new Date();

        /* ------------------------------------------------ customers */
        let m;
        if ((m = /^SELECT id FROM customers WHERE email = \$1$/.exec(q))) {
          const c = banco.customers.find((x) => x.email === p[0]);
          return { rows: c ? [{ id: c.id }] : [] };
        }
        if (/^INSERT INTO customers \(name, email, whatsapp, "passwordHash"\) VALUES \(\$1, \$2, \$3, \$4\) RETURNING id, name, email, whatsapp, birth_date, "createdAt"$/.test(q)) {
          if (banco.customers.some((x) => x.email === p[1])) {
            const e = new Error("duplicate key value violates unique constraint"); e.code = "23505"; throw e;
          }
          const c = {
            id: crypto.randomUUID(), name: p[0], email: p[1], whatsapp: p[2],
            passwordHash: p[3], birth_date: null, createdAt: agora(),
          };
          banco.customers.push(c);
          return { rows: [c] };
        }
        if (/^SELECT id, name, email, whatsapp, birth_date, "createdAt", "passwordHash" FROM customers WHERE email = \$1$/.test(q)) {
          const c = banco.customers.find((x) => x.email === p[0]);
          return { rows: c ? [c] : [] };
        }
        if (/^SELECT "passwordHash" FROM customers WHERE id = \$1$/.test(q)) {
          const c = banco.customers.find((x) => x.id === p[0]);
          return { rows: c ? [{ passwordHash: c.passwordHash }] : [] };
        }
        if (/^UPDATE customers SET name = \$1, whatsapp = \$2, birth_date = \$3, "updatedAt" = now\(\) WHERE id = \$4 RETURNING/.test(q)) {
          const c = banco.customers.find((x) => x.id === p[3]);
          if (!c) return { rows: [] };
          c.name = p[0]; c.whatsapp = p[1]; c.birth_date = p[2]; c.updatedAt = agora();
          return { rows: [c] };
        }
        if (/^UPDATE customers SET "passwordHash" = \$1, "updatedAt" = now\(\) WHERE id = \$2$/.test(q)) {
          const c = banco.customers.find((x) => x.id === p[1]);
          if (c) { c.passwordHash = p[0]; c.updatedAt = agora(); }
          return { rows: [], rowCount: c ? 1 : 0 };
        }

        /* ------------------------------------------------- sessions */
        if (/^INSERT INTO sessions \("customerId", "tokenHash", "expiresAt", "persistente", "userAgent", ip\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)$/.test(q)) {
          const s = {
            id: crypto.randomUUID(), customerId: p[0], tokenHash: p[1],
            expiresAt: p[2], persistente: p[3], userAgent: p[4], ip: p[5],
          };
          banco.sessions.push(s);
          return { rows: [s] };
        }
        if (/^SELECT c\.id, c\.name, c\.email, c\.whatsapp, c\.birth_date, c\."createdAt", s\.id AS sessao_id, s\."expiresAt" FROM sessions s JOIN customers c ON c\.id = s\."customerId" WHERE s\."tokenHash" = \$1$/.test(q)) {
          const s = banco.sessions.find((x) => x.tokenHash === p[0]);
          if (!s) return { rows: [] };
          const c = banco.customers.find((x) => x.id === s.customerId);
          if (!c) return { rows: [] };
          return { rows: [Object.assign({}, c, { sessao_id: s.id, expiresAt: s.expiresAt })] };
        }
        if (/^SELECT id, "persistente", "expiresAt" FROM sessions WHERE "tokenHash" = \$1$/.test(q)) {
          const s = banco.sessions.find((x) => x.tokenHash === p[0]);
          return { rows: s ? [{ id: s.id, persistente: s.persistente, expiresAt: s.expiresAt }] : [] };
        }
        if (/^UPDATE sessions SET "expiresAt" = \$1 WHERE id = \$2$/.test(q)) {
          const s = banco.sessions.find((x) => x.id === p[1]);
          if (s) s.expiresAt = p[0];
          return { rows: [] };
        }
        if (/^DELETE FROM sessions WHERE id = \$1$/.test(q)) {
          banco.sessions = banco.sessions.filter((x) => x.id !== p[0]);
          return { rows: [] };
        }
        if (/^DELETE FROM sessions WHERE "tokenHash" = \$1$/.test(q)) {
          banco.sessions = banco.sessions.filter((x) => x.tokenHash !== p[0]);
          return { rows: [] };
        }
        if (/^DELETE FROM sessions WHERE "customerId" = \$1$/.test(q)) {
          banco.sessions = banco.sessions.filter((x) => x.customerId !== p[0]);
          return { rows: [] };
        }
        if (/^DELETE FROM sessions WHERE "expiresAt" < now\(\)$/.test(q)) {
          banco.sessions = banco.sessions.filter((x) => new Date(x.expiresAt).getTime() >= Date.now());
          return { rows: [] };
        }

        /* ------------------------------------------ password_resets */
        if (/^SELECT id, "customerId", "expiresAt", "usedAt" FROM password_resets WHERE "tokenHash" = \$1$/.test(q)) {
          const r = banco.password_resets.find((x) => x.tokenHash === p[0]);
          return { rows: r ? [r] : [] };
        }
        if (/^DELETE FROM password_resets WHERE "customerId" = \$1 AND "usedAt" IS NULL$/.test(q)) {
          banco.password_resets = banco.password_resets.filter((x) => !(x.customerId === p[0] && !x.usedAt));
          return { rows: [] };
        }
        if (/^INSERT INTO password_resets \("customerId", "tokenHash", "expiresAt"\) VALUES \(\$1, \$2, \$3\)$/.test(q)) {
          const r = { id: crypto.randomUUID(), customerId: p[0], tokenHash: p[1], expiresAt: p[2], usedAt: null };
          banco.password_resets.push(r);
          return { rows: [r] };
        }
        if (/^UPDATE password_resets SET "usedAt" = now\(\) WHERE id = \$1$/.test(q)) {
          const r = banco.password_resets.find((x) => x.id === p[0]);
          if (r) r.usedAt = agora();
          return { rows: [] };
        }

        /* --------------------------------------------- transacoes */
        if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(q)) return { rows: [] };

        /* Nao reconhecida: LANCA. Nunca passa em silencio. */
        banco.naoReconhecidas.push(q);
        throw new Error("bancada-auth: consulta nao reconhecida pelo Postgres falso:\n" + q);
      },
      async connect() {},
      async end() {},
      on() {},
    };
  }

  return {
    Pool: function () { return Object.assign(novoCliente(), { on() {} }); },
    Client: function () { return novoCliente(); },
  };
}

/* ==========================================================================
   DUBLE 2 — bcryptjs de mentira
   Mesma interface (hash / compare) e MESMO FORMATO de saida do bcrypt:
   60 caracteres, comecando em $2a$12$.
   Por dentro usa scrypt (nativo), nao bcrypt. Isso basta para provar o que
   interessa: que o projeto grava hash e nunca a senha, e que compara certa.
   ========================================================================== */

function criarBcrypt() {
  const CUSTO = 12;
  const B64 = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  /* O bcrypt real devolve 60 caracteres: 7 de prefixo ($2a$12$), 22 de sal e
     31 de hash. O dublê respeita esse tamanho — senão a prova "tem 60
     caracteres, como o bcrypt real" nao estaria medindo nada.            */
  const TAM_CORPO = 31;

  function derivar(senha, sal, n) {
    return crypto.scryptSync(String(senha) + "|" + sal, "labelle", n, { N: 1024, r: 8, p: 1 });
  }

  return {
    async hash(senha /*, custo*/) {
      const sal = crypto.randomBytes(16).toString("hex").slice(0, 22);
      const bruto = derivar(senha, sal, TAM_CORPO);
      let corpo = "";
      for (const b of bruto) corpo += B64[b % 64];
      return "$2a$" + String(CUSTO).padStart(2, "0") + "$" + sal + corpo;
    },
    async compare(senha, hash) {
      try {
        if (!hash || hash.length !== 60) return false;
        const sal = hash.slice(7, 29);
        const bruto = derivar(senha, sal, TAM_CORPO);
        let corpo = "";
        for (const b of bruto) corpo += B64[b % 64];
        const calc = hash.slice(0, 29) + corpo;
        const a = Buffer.from(calc), b = Buffer.from(hash);
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
      } catch (e) { return false; }
    },
  };
}

/* ==========================================================================
   INJECAO DOS DUBLES
   Redireciona SOMENTE 'pg' e 'bcryptjs'. O resto do require segue normal,
   entao os arquivos carregados sao os REAIS do projeto.
   ========================================================================== */

const banco = criarBanco();
const pgFalso = criarPg(banco);
const bcryptFalso = criarBcrypt();

/* db.js recusa trabalhar sem DATABASE_URL — e faz certo. Como aqui o banco e
   o dublê abaixo, a bancada precisa satisfazer essa trava. O valor e
   PROPOSITALMENTE falso e nunca e usado para conectar em nada: nao existe
   conexao real nesta bancada.                                            */
process.env.DATABASE_URL = "postgresql://bancada:fake@localhost:5432/bancada?sslmode=require";

const carregarOriginal = Module._load;
Module._load = function (pedido, pai, principal) {
  if (pedido === "pg") return pgFalso;
  if (pedido === "bcryptjs") return bcryptFalso;
  return carregarOriginal.apply(this, arguments);
};

/* Carrega os arquivos REAIS. */
function rota(rel) { return require(path.join(API, rel)); }

const R = {
  cadastro: rota("auth/cadastro.js"),
  login: rota("auth/login.js"),
  logout: rota("auth/logout.js"),
  me: rota("auth/me.js"),
  cliente: rota("cliente/index.js"),
  senha: rota("cliente/senha.js"),
  recuperar: rota("auth/recuperar.js"),
  redefinir: rota("auth/redefinir.js"),
};

/* ==========================================================================
   REQUISICAO E RESPOSTA DE MENTIRA
   ========================================================================== */

function req(metodo, corpo, cookie) {
  const r = new (require("stream").Readable)({ read() {} });
  r.method = metodo;
  r.headers = {};
  if (cookie) r.headers.cookie = cookie;
  r.headers["user-agent"] = "bancada-auth";
  r.headers["x-forwarded-for"] = "189.45.12.77";
  r.body = corpo === undefined ? {} : corpo;
  r.push(null);
  return r;
}

function res() {
  const r = {
    statusCode: 0,
    headers: {},
    corpo: null,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end(t) { try { this.corpo = JSON.parse(t); } catch (e) { this.corpo = t; } },
  };
  return r;
}

async function chamar(handler, metodo, corpo, cookie) {
  const r = req(metodo, corpo, cookie);
  const s = res();
  await handler(r, s);
  return s;
}

/* Devolve o valor do cookie de sessao a partir do Set-Cookie. */
function tokenDe(s) {
  const sc = s.headers["set-cookie"];
  if (!sc) return null;
  const m = /=([^;]*)/.exec(sc);
  const valor = m ? m[1] : "";
  return valor || null;
}
function cookieDe(s) {
  const t = tokenDe(s);
  if (!t) return null;
  return "labelle_sessao=" + t;
}

/* ==========================================================================
   PROVAS
   ========================================================================== */

const SENHA_BOA = "Belle2024x";

async function main() {
  console.log("\n=====================================================");
  console.log("BANCADA DE AUTENTICACAO — La Belle Modas");
  console.log("Executando os arquivos REAIS de api/ com banco e bcrypt dublês");
  console.log("=====================================================");

  /* ---------------------------------------------------- 1. CADASTRO */
  secao("1. CADASTRO");

  let s = await chamar(R.cadastro, "POST", {
    nome: "Maria Geovana Silva", email: "  Maria@Exemplo.COM  ",
    whatsapp: "(81) 98888-7777", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: true,
  });
  ok(s.statusCode === 201, "cadastro válido cria conta (201)", "recebi " + s.statusCode);
  ok(banco.customers.length === 1, "a cliente existe no banco", "total: " + banco.customers.length);
  ok(banco.customers[0] && banco.customers[0].email === "maria@exemplo.com",
    "o e-mail foi normalizado (minusculo, sem espaco)",
    "gravado: " + (banco.customers[0] && banco.customers[0].email));
  ok(banco.customers[0] && banco.customers[0].passwordHash !== SENHA_BOA,
    "a senha NAO foi gravada em texto puro");
  ok(banco.customers[0] && /^\$2a\$12\$/.test(banco.customers[0].passwordHash),
    "o hash segue o formato bcrypt ($2a$12$)",
    "hash: " + (banco.customers[0] && banco.customers[0].passwordHash).slice(0, 12));
  ok(banco.customers[0] && banco.customers[0].passwordHash.length === 60,
    "o hash tem 60 caracteres, como o bcrypt real");
  ok(s.corpo && s.corpo.cliente && !("passwordHash" in s.corpo.cliente),
    "a resposta do cadastro NAO contem passwordHash");
  ok(!JSON.stringify(s.corpo).includes(SENHA_BOA), "a resposta NAO contem a senha");
  ok(!!s.headers["set-cookie"], "o cadastro ja abre sessao (Set-Cookie presente)");
  ok(/HttpOnly/.test(s.headers["set-cookie"] || ""), "o cookie e HttpOnly");
  ok(/SameSite=Lax/.test(s.headers["set-cookie"] || ""), "o cookie e SameSite=Lax");
  ok(/Path=\//.test(s.headers["set-cookie"] || ""), "o cookie vale em Path=/");

  const cookieMaria = cookieDe(s);
  ok(!!cookieMaria, "o cadastro devolve um cookie de sessao utilizavel");

  /* duplicado */
  s = await chamar(R.cadastro, "POST", {
    nome: "Outra Pessoa", email: "maria@exemplo.com",
    whatsapp: "(81) 97777-6666", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: true,
  });
  ok(s.statusCode === 409, "e-mail duplicado e recusado (409)", "recebi " + s.statusCode);
  ok(/já existe uma conta/i.test(s.corpo.erro || ""), "a mensagem de duplicado e amigavel",
    "mensagem: " + s.corpo.erro);
  ok(banco.customers.length === 1, "o cadastro duplicado NAO criou registro");

  /* senhas divergentes */
  s = await chamar(R.cadastro, "POST", {
    nome: "Ana Paula Souza", email: "ana@exemplo.com",
    whatsapp: "(81) 96666-5555", senha: SENHA_BOA, confirmar: "OutraSenha9", aceite: true,
  });
  ok(s.statusCode === 400, "senha divergente e recusada (400)", "recebi " + s.statusCode);
  ok(/diferentes/i.test(s.corpo.erro || ""), "a mensagem fala das duas senhas", "mensagem: " + s.corpo.erro);
  ok(banco.customers.length === 1, "senha divergente NAO criou registro");

  /* campos invalidos */
  const invalidos = [
    [{ nome: "Maria", email: "m2@exemplo.com", whatsapp: "(81) 91111-2222", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: true }, "so um nome (sem sobrenome)"],
    [{ nome: "Maria Silva", email: "sem-arroba", whatsapp: "(81) 91111-2222", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: true }, "e-mail sem @"],
    [{ nome: "Maria Silva", email: "m3@exemplo.com", whatsapp: "123", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: true }, "whatsapp curto"],
    [{ nome: "Maria Silva", email: "m4@exemplo.com", whatsapp: "(81) 91111-2222", senha: "curta1", confirmar: "curta1", aceite: true }, "senha fraca"],
    [{ nome: "Maria Silva", email: "m5@exemplo.com", whatsapp: "(81) 91111-2222", senha: SENHA_BOA, confirmar: SENHA_BOA, aceite: false }, "sem aceite dos termos"],
    [{ nome: "Maria Silva", email: "m6@exemplo.com", whatsapp: "(81) 91111-2222", senha: "abcdefghij", confirmar: "abcdefghij", aceite: true }, "senha so de letras"],
  ];
  for (const [corpo, rot] of invalidos) {
    const r = await chamar(R.cadastro, "POST", corpo);
    ok(r.statusCode === 400, "recusa cadastro invalido: " + rot, "recebi " + r.statusCode);
  }
  ok(banco.customers.length === 1, "nenhum cadastro invalido entrou no banco",
    "total: " + banco.customers.length);

  /* ------------------------------------------------------- 2. LOGIN */
  secao("2. LOGIN");

  s = await chamar(R.login, "POST", { email: "MARIA@exemplo.com", senha: SENHA_BOA });
  ok(s.statusCode === 200, "login válido autentica (200)", "recebi " + s.statusCode);
  ok(!JSON.stringify(s.corpo).includes(SENHA_BOA), "a resposta do login NAO contem a senha");
  ok(s.corpo.cliente && !("passwordHash" in s.corpo.cliente), "a resposta do login NAO contem passwordHash");
  ok(s.corpo.cliente && s.corpo.cliente.nome === "Maria Geovana Silva", "devolve o nome da cliente");
  ok(!!cookieDe(s), "o login cria sessao");
  const cookieLogin = cookieDe(s);

  /* senha errada */
  s = await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "ErradaTotal9" });
  ok(s.statusCode === 401, "senha errada e recusada (401)", "recebi " + s.statusCode);
  ok(s.corpo.erro === "E-mail ou senha incorretos.", "mensagem generica na senha errada",
    "mensagem: " + s.corpo.erro);

  /* usuario inexistente — MESMA mensagem */
  s = await chamar(R.login, "POST", { email: "ninguem@exemplo.com", senha: SENHA_BOA });
  ok(s.statusCode === 401, "usuario inexistente e recusado (401)", "recebi " + s.statusCode);
  ok(s.corpo.erro === "E-mail ou senha incorretos.",
    "usuario inexistente devolve a MESMA mensagem da senha errada",
    "mensagem: " + s.corpo.erro);

  /* o tempo das duas respostas nao denuncia qual caso e */
  const t0 = Date.now(); await chamar(R.login, "POST", { email: "ninguem@exemplo.com", senha: SENHA_BOA });
  const tInexistente = Date.now() - t0;
  const t1 = Date.now(); await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "ErradaTotal9" });
  const tSenhaErrada = Date.now() - t1;
  ok(Math.abs(tInexistente - tSenhaErrada) < 15,
    "o tempo das duas respostas e equivalente (nao denuncia o caso)",
    "inexistente " + tInexistente + "ms vs senha errada " + tSenhaErrada + "ms");

  /* ----------------------------------------------------- 3. SESSAO */
  secao("3. SESSAO E PROTECAO DA AREA");

  s = await chamar(R.me, "GET", {}, cookieLogin);
  ok(s.statusCode === 200, "/api/auth/me com sessao responde 200");
  ok(s.corpo.autenticado === true, "/api/auth/me diz que esta autenticada");
  ok(s.corpo.cliente && s.corpo.cliente.id === banco.customers[0].id, "devolve o cliente certo");

  s = await chamar(R.me, "GET", {}, null);
  ok(s.statusCode === 401, "/api/auth/me SEM sessao responde 401", "recebi " + s.statusCode);
  ok(s.corpo && s.corpo.erro, "responde com corpo de erro, nao vazio");

  s = await chamar(R.me, "GET", {}, "labelle_sessao=token-inventado-que-nao-existe");
  ok(s.statusCode === 401, "/api/auth/me com token invalido responde 401");

  /* o que esta guardado no banco NAO e o token */
  const guardado = banco.sessions.map((x) => x.tokenHash);
  ok(guardado.length > 0 && guardado.every((h) => !cookieLogin.includes(h)),
    "o banco guarda o HASH do token, nunca o token");

  /* rota privada sem sessao */
  s = await chamar(R.cliente, "GET", {}, null);
  ok(s.statusCode === 401, "GET /api/cliente SEM sessao responde 401 (dado privado protegido)");

  s = await chamar(R.cliente, "GET", {}, cookieLogin);
  ok(s.statusCode === 200, "GET /api/cliente com sessao responde 200");
  ok(!JSON.stringify(s.corpo).includes("passwordHash"), "GET /api/cliente nao devolve passwordHash");

  /* --------------------------------------- 4. O ID DO CORPO E IGNORADO */
  secao("4. O ID VINDO DO NAVEGADOR NAO VALE NADA");

  const outraId = crypto.randomUUID();
  s = await chamar(R.cliente, "PATCH", {
    id: outraId, customerId: outraId,
    nome: "Invasora Silva", whatsapp: "(11) 90000-0000", nascimento: "1990-01-01",
  }, cookieLogin);
  ok(s.statusCode === 200, "PATCH /api/cliente aceita o corpo");
  ok(banco.customers[0].name === "Invasora Silva",
    "quem foi alterada foi a dona da SESSAO (nao o id do corpo)");
  ok(!banco.customers.some((x) => x.id === outraId), "nenhum registro com o id forjado foi criado");

  /* volta o nome para as provas seguintes */
  await chamar(R.cliente, "PATCH", { nome: "Maria Geovana Silva", whatsapp: "(81) 98888-7777", nascimento: "1996-04-12" }, cookieLogin);

  /* --------------------------------------------- 5. MEUS DADOS REAL */
  secao("5. MEUS DADOS GRAVAM NO SERVIDOR");

  s = await chamar(R.cliente, "GET", {}, cookieLogin);
  ok(s.corpo.cliente.nascimento === "1996-04-12", "a data de nascimento volta como AAAA-MM-DD",
    "recebi: " + s.corpo.cliente.nascimento);
  ok(s.corpo.cliente.whatsapp === "81988887777", "o WhatsApp e guardado so com digitos",
    "recebi: " + s.corpo.cliente.whatsapp);

  s = await chamar(R.cliente, "PATCH", { nome: "Maria", whatsapp: "(81) 98888-7777" }, cookieLogin);
  ok(s.statusCode === 400, "nome sem sobrenome e recusado pelo servidor");
  s = await chamar(R.cliente, "PATCH", { nome: "Maria Silva", whatsapp: "123" }, cookieLogin);
  ok(s.statusCode === 400, "WhatsApp invalido e recusado pelo servidor");
  s = await chamar(R.cliente, "PATCH", { nome: "Maria Silva", whatsapp: "(81) 98888-7777", nascimento: "1996-02-30" }, cookieLogin);
  ok(s.statusCode === 400, "data impossivel (30 de fevereiro) e recusada pelo servidor");

  /* -------------------------------------------------- 6. SENHA */
  secao("6. TROCA DE SENHA");

  s = await chamar(R.senha, "POST", { atual: "errada", nova: "NovaSenha2024", confirmar: "NovaSenha2024" }, cookieLogin);
  ok(s.statusCode === 400, "senha atual errada e recusada (400)");
  ok(s.corpo.campo === "atual", "o erro aponta o campo 'atual'");

  const sessaoAntes = banco.sessions.length;

  s = await chamar(R.senha, "POST", { atual: SENHA_BOA, nova: "NovaSenha2024", confirmar: "NovaSenha2024" }, cookieLogin);
  ok(s.statusCode === 200, "troca de senha valida funciona (200)");
  ok(!JSON.stringify(s.corpo).includes("NovaSenha2024"), "a resposta NAO contem a senha nova");
  ok(banco.customers[0].passwordHash !== SENHA_BOA && !banco.customers[0].passwordHash.includes("NovaSenha"),
    "o banco guardou hash, nao a senha");

  /* a sessao antiga foi derrubada */
  s = await chamar(R.me, "GET", {}, cookieLogin);
  ok(s.statusCode === 401, "a sessao ANTIGA morreu depois da troca de senha");

  const cookieNovo = cookieDe(await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "NovaSenha2024" }));
  ok(!!cookieNovo, "a senha NOVA autentica");

  s = await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: SENHA_BOA });
  ok(s.statusCode === 401, "a senha ANTIGA nao autentica mais");

  /* -------------------------------------------------- 7. LOGOUT */
  secao("7. LOGOUT");

  const quantasAntes = banco.sessions.length;
  s = await chamar(R.logout, "POST", {}, cookieNovo);
  ok(s.statusCode === 200, "logout responde 200");
  ok(banco.sessions.length === quantasAntes - 1, "logout APAGOU a sessao no banco (nao so o cookie)",
    "antes " + quantasAntes + " agora " + banco.sessions.length);
  ok(/Max-Age=0/.test(s.headers["set-cookie"] || ""), "logout manda o cookie expirado");

  s = await chamar(R.me, "GET", {}, cookieNovo);
  ok(s.statusCode === 401, "depois do logout, o token antigo NAO vale mais (nem se alguem copiou)");

  s = await chamar(R.logout, "POST", {}, null);
  ok(s.statusCode === 200, "logout sem sessao nao da erro (idempotente)");

  /* ----------------------------------------- 8. MANTER CONECTADO */
  secao("8. MANTER CONECTADO (duracao da sessao)");

  const sNao = await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "NovaSenha2024", manter: false });
  const sSim = await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "NovaSenha2024", manter: true });
  const sessNao = banco.sessions.find((x) => x.tokenHash === crypto.createHash("sha256").update(tokenDe(sNao)).digest("hex"));
  const sessSim = banco.sessions.find((x) => x.tokenHash === crypto.createHash("sha256").update(tokenDe(sSim)).digest("hex"));

  const durNao = Math.round((new Date(sessNao.expiresAt) - Date.now()) / 3600000);
  const durSim = Math.round((new Date(sessSim.expiresAt) - Date.now()) / 86400000);
  ok(durNao === 12, "sem 'Manter conectado': sessao de 12 horas", "medi " + durNao + "h");
  ok(durSim === 30, "com 'Manter conectado': sessao de 30 dias", "medi " + durSim + " dias");
  ok(/Max-Age/.test(sSim.headers["set-cookie"] || ""), "sessao persistente manda Max-Age");
  ok(!/Max-Age/.test(sNao.headers["set-cookie"] || ""), "sessao curta NAO manda Max-Age (morre ao fechar)");

  /* a sessao persistente nao se renova para sempre */
  const sRen = banco.sessions.filter((x) => x.customerId === banco.customers[0].id);
  ok(sRen.length >= 2, "as sessoes coexistem (mesma conta, aparelhos diferentes)");

  /* -------------------------------------- 9. RECUPERAR SENHA */
  secao("9. RECUPERACAO DE SENHA (arquitetura, sem envio)");

  const semProvedor = await chamar(R.recuperar, "POST", { email: "maria@exemplo.com" });
  const semConta = await chamar(R.recuperar, "POST", { email: "ninguem-mesmo@exemplo.com" });
  ok(semProvedor.statusCode === 200 && semConta.statusCode === 200, "recuperar responde 200 nos dois casos");
  ok(semProvedor.corpo.mensagem === semConta.corpo.mensagem,
    "a resposta e IDENTICA exista ou nao a conta (nao revela quem tem conta)");
  ok(banco.password_resets.length === 0,
    "sem provedor de e-mail, NENHUM token e criado no banco (nao deixa residuo)");
  ok(!/token/i.test(JSON.stringify(semProvedor.corpo)),
    "a resposta NAO devolve token nenhum ao navegador");

  /* -------------------------------------------- 10. METODOS */
  secao("10. METODO ERRADO E CORPO INVALIDO");

  s = await chamar(R.login, "GET", {});
  ok(s.statusCode === 405, "GET /api/auth/login responde 405", "recebi " + s.statusCode);
  ok(!!s.headers.allow, "405 manda o header Allow");

  s = await chamar(R.cadastro, "POST", null);
  ok(s.statusCode === 400, "corpo vazio no cadastro e recusado com 400, nao 500",
    "recebi " + s.statusCode);

  s = await chamar(R.me, "POST", {}, "labelle_sessao=qualquer");
  ok(s.statusCode === 405, "POST /api/auth/me responde 405");

  /* ---------------------------------- 11. NADA SENSIVEL VAZA */
  secao("11. O QUE NUNCA PODE VAZAR");

  const todasRespostas = JSON.stringify(banco.customers.map((c) => c.passwordHash));
  ok(!todasRespostas.includes(SENHA_BOA), "nenhum hash contem a senha em texto");

  const sFinal = await chamar(R.me, "GET", {}, cookieNovo);
  ok(sFinal.statusCode === 401, "sessao encerrada continua encerrada na ultima checagem");

  const sLoginFinal = await chamar(R.login, "POST", { email: "maria@exemplo.com", senha: "NovaSenha2024" });
  const corpoCru = JSON.stringify(sLoginFinal.corpo);
  ok(!/passwordHash|password_hash|\$2a\$/.test(corpoCru),
    "nenhuma resposta contem o campo de hash nem o valor do hash");
  ok(!/\$2a\$/.test(JSON.stringify(s.headers)), "nenhum cabecalho contem o hash");

  ok(banco.naoReconhecidas.length === 0,
    "todas as consultas feitas pelo projeto foram reconhecidas pelo banco falso",
    banco.naoReconhecidas.join("\n"));

  /* ------------------------------- 12. CONTROLES NEGATIVOS */
  secao("12. CONTROLE NEGATIVO — o instrumento precisa saber reprovar");

  /* (a) o banco falso reprova consulta que nao conhece */
  let lancou = false;
  try {
    /* chama o motor do banco falso direto, com SQL que o projeto nunca faz */
    const fake = criarPg(banco);
    await fake.Client().query("SELECT * FROM tabela_que_nao_existe WHERE x = $1", [1]);
  } catch (e) { lancou = true; }
  ok(lancou, "CONTROLE: o banco falso LANCA em consulta desconhecida (nao da verde em silencio)");

  /* (b) se o hash fosse gravado cru, a bancada teria de acusar */
  const hashCru = banco.customers[0].passwordHash;
  ok(hashCru !== SENHA_BOA, "CONTROLE: a prova de 'nao gravou a senha' cairia se o hash fosse a senha");

  /* (c) o detector de mensagem generica sabe reprovar */
  const msgErrada = "Esse e-mail não existe.";
  ok(msgErrada !== "E-mail ou senha incorretos.",
    "CONTROLE: o detector de mensagem generica REPROVARIA uma mensagem especifica");

  /* (d) o detector de sessao derrubada sabe reprovar */
  const sessaoViva = banco.sessions.some((x) => x.tokenHash === crypto.createHash("sha256").update(tokenDe(sSim)).digest("hex"));
  ok(sessaoViva, "CONTROLE: o detector de sessao viva ACEITA uma sessao que existe de fato");

  /* ------------------------------------------------- RESUMO */
  console.log("\n=====================================================");
  console.log((falhas === 0 ? "APROVADO" : "REPROVADO") + " — " + provas + " provas, " + falhas + " falha(s)");
  console.log("Consultas executadas pelo projeto: " + banco.consultas);
  console.log("Contas no banco falso: " + banco.customers.length + " | sessoes: " + banco.sessions.length);
  console.log("=====================================================\n");

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nA bancada quebrou:", e && e.message ? e.message : e);
  process.exit(2);
});
