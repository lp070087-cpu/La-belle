/* ==========================================================================
   api/_lib/sessao.js — SESSÃO: peças puras
   --------------------------------------------------------------------------
   Só usa `crypto` (nativo do Node). NÃO usa bcrypt, NÃO usa banco, NÃO usa
   rede. Por isso este arquivo é provado por execução na bancada, com ou sem
   internet.

   DESENHO DA SESSÃO — e o porquê de cada escolha:

   1. Token OPACO, não JWT. Um valor aleatório de 32 bytes. O banco guarda
      apenas o SHA-256 dele. Vantagem: dá para INVALIDAR na hora (logout de
      verdade, e trocar a senha derruba todas as sessões antigas). JWT
      assinado não permite revogar sem uma lista negra — que é esta tabela
      de volta, com mais passos.

   2. O banco nunca vê o token, só o hash. Se o banco vazar, ninguém monta
      um cookie válido a partir dele.

   3. SHA-256 puro (não bcrypt) para o token: o token já é aleatório de 32
      bytes, então não há o que "adivinhar" — não precisa de hash lento.
      Hash lento é para senha, que é escolhida por gente e tem pouca entropia.

   4. Cookie HttpOnly: o JavaScript da página não lê o token. Não há token
      em localStorage, nunca.
   ========================================================================== */

"use strict";

const crypto = require("crypto");

const NOME_COOKIE = "labelle_sessao";

/* ------------------------------------------------------------- duração
   Duas durações, conforme o "Manter conectado":
     - marcado:   30 dias  (persistente)
     - desmarcado: 12 horas (sessão curta)

   Por que 30 dias: é o prazo de "lembrar de mim" usual no comércio
   eletrônico. Longo o bastante para não pedir login toda semana, e curto o
   bastante para um aparelho emprestado não ficar conectado para sempre.

   Por que 12 horas desmarcado: cobre um dia inteiro de uso. Ao fechar o
   navegador, o cookie `Max-Age` curto continua valendo, mas cada acesso
   RENOVA o prazo (ver `postergarSessao` em auth.js). Ou seja: quem usa,
   continua; quem abandona, cai.                                       */
const DIAS_PERSISTENTE = 30;
const HORAS_PADRAO = 12;

function diasDaSessao() {
  const v = parseInt(process.env.SESSAO_DIAS || "", 10);
  return Number.isFinite(v) && v > 0 && v <= 365 ? v : DIAS_PERSISTENTE;
}

/* Devolve a data de expiração. `persistente` = a pessoa marcou o checkbox. */
function expiracaoDe(persistente, agora) {
  const base = agora ? new Date(agora) : new Date();
  const ms = persistente
    ? diasDaSessao() * 24 * 60 * 60 * 1000
    : HORAS_PADRAO * 60 * 60 * 1000;
  return new Date(base.getTime() + ms);
}

/* --------------------------------------------------------------- token
   32 bytes aleatórios -> 43 caracteres em base64url (sem +, / ou =, então
   não precisa de escape em cookie nem em URL).                           */
function gerarToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/* O que vai para o banco. Nunca o token. */
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

/* Comparação de tempo constante, para o hash não vazar informação pelo
   tempo que a resposta leva. (Para string de 64 hex, a diferença seria
   mínima, mas o certo é o certo.)                                        */
function mesmoHash(a, b) {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* -------------------------------------------------------------- cookie
   Serializa o Set-Cookie à mão: é uma linha, e evita mais uma dependência.

   HttpOnly      -> o JS da página não lê (protege contra roubo de token)
   Secure        -> só em HTTPS (em produção; desligado em localhost)
   SameSite=Lax  -> o cookie acompanha a navegação normal do site, mas NÃO
                    acompanha requisições vindas de outro domínio. Isso
                    barra CSRF para os nossos POST, que exigem cookie.
   Path=/        -> vale no site inteiro.
   Max-Age       -> só quando persistente. Sem Max-Age, o cookie morre ao
                    fechar o navegador (sessão de navegador).               */
function emProducao() {
  return process.env.NODE_ENV !== "development";
}

function serializarCookie(token, expiraEm, persistente) {
  const partes = [
    NOME_COOKIE + "=" + token,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (emProducao()) partes.push("Secure");
  if (persistente) {
    const seg = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
    partes.push("Max-Age=" + seg);
  }
  return partes.join("; ");
}

/* Cookie que apaga a sessão no navegador. Usado no logout. */
function cookieDeSaida() {
  const partes = [NOME_COOKIE + "=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (emProducao()) partes.push("Secure");
  return partes.join("; ");
}

/* ------------------------------------------------------- leitura do cookie
   Aceita tanto o header `cookie` da Vercel quanto o formato de array do
   runtime do Node. Devolve o token, ou null. Nunca lança.                 */
function lerToken(req) {
  try {
    const bruto = (req && req.headers && (req.headers.cookie || req.headers.Cookie)) || "";
    if (!bruto) return null;
    for (const pedaco of String(bruto).split(";")) {
      const i = pedaco.indexOf("=");
      if (i < 1) continue;
      if (pedaco.slice(0, i).trim() === NOME_COOKIE) {
        const v = pedaco.slice(i + 1).trim();
        return v || null;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------------------- DTO público
   A ÚNICA forma de um cliente sair da API. passwordHash NÃO passa por aqui.

   A lista é de PERMISSÃO (o que sai), não de proibição (o que não sai).
   Assim, se alguém adicionar uma coluna sensível em `customers` amanhã, ela
   não começa a vazar sozinha: só sai o que está escrito abaixo.            */
function clientePublico(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    nome: linha.name,
    email: linha.email,
    whatsapp: linha.whatsapp,
    nascimento: linha.birth_date ? formatarDataISO(linha.birth_date) : null,
    desde: linha.createdAt ? new Date(linha.createdAt).toISOString() : null,
  };
}

/* O driver pg entrega `date` como Date à meia-noite local. Cortar em ISO
   (AAAA-MM-DD) evita a data andar um dia por causa de fuso.               */
function formatarDataISO(valor) {
  if (!valor) return null;
  if (typeof valor === "string") return valor.slice(0, 10);
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  /* usa os getters UTC quando o driver entregou UTC */
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}

module.exports = {
  NOME_COOKIE,
  DIAS_PERSISTENTE,
  HORAS_PADRAO,
  diasDaSessao,
  expiracaoDe,
  gerarToken,
  hashToken,
  mesmoHash,
  emProducao,
  serializarCookie,
  cookieDeSaida,
  lerToken,
  clientePublico,
  formatarDataISO,
};
