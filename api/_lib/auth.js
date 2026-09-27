/* ==========================================================================
   api/_lib/auth.js — OPERAÇÕES de autenticação (usa banco + bcrypt)
   --------------------------------------------------------------------------
   Esta é a única camada que junta as três peças: banco (db.js), sessão
   (sessao.js) e hash de senha (bcryptjs).

   REGRAS INVIOLÁVEIS DESTE PROJETO:

   1. Senha NUNCA é gravada em texto puro. Só o hash bcrypt.
   2. O hash NUNCA sai desta camada. Quem responde ao navegador usa
      `clientePublico()`, que só devolve campos da lista de permissão.
   3. Senha NUNCA vai para log. Os erros deste arquivo não imprimem o corpo
      da requisição — só a mensagem do driver do banco, quando houver.
   4. O servidor NUNCA confia em um id de cliente vindo do navegador. Quem é
      o cliente é decidido SEMPRE pela sessão do cookie.
   ========================================================================== */

"use strict";

const db = require("./db");
const S = require("./sessao");

/* bcryptjs é JavaScript puro (não precisa compilar C++), por isso funciona
   no ambiente serverless da Vercel sem dor. O algoritmo e o formato do hash
   são os mesmos do bcrypt nativo ($2a$ / $2b$).                          */
const bcrypt = require("bcryptjs");

/* Custo 12: ~200-300 ms por hash numa máquina comum. Alto o bastante para
   tornar a força bruta cara, baixo o bastante para o login não arrastar.  */
const CUSTO = 12;

/* ------------------------------------------------------------ hash senha */
async function hashSenha(senha) {
  return bcrypt.hash(String(senha), CUSTO);
}

/* Confere a senha contra o hash. Devolve boolean, nunca lança. */
async function conferirSenha(senha, hash) {
  try {
    if (!hash) return false;
    return await bcrypt.compare(String(senha), String(hash));
  } catch (e) {
    return false;
  }
}

/* ----------------------------------------------------------------- sessão
   Cria a sessão no banco e devolve o que a rota precisa para responder:
   o token (que vai no cookie) e a data de expiração.

   O IP e o User-Agent são guardados só para auditoria — e o IP é truncado
   para não ser dado pessoal desnecessário em disco.                      */
async function criarSessao(customerId, persistente, req) {
  const token = S.gerarToken();
  const tokenHash = S.hashToken(token);
  const expiraEm = S.expiracaoDe(!!persistente);

  const ua = (req && req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])) || null;
  const ip = ipDaRequisicao(req);

  await db.consulta(
    'INSERT INTO sessions ("customerId", "tokenHash", "expiresAt", "persistente", "userAgent", ip) ' +
    "VALUES ($1, $2, $3, $4, $5, $6)",
    [customerId, tokenHash, expiraEm, !!persistente, ua ? String(ua).slice(0, 300) : null, ip]
  );

  return { token, expiraEm, persistente: !!persistente };
}

/* Guarda apenas a rede, não o endereço completo. */
function ipDaRequisicao(req) {
  try {
    const h = (req && req.headers) || {};
    const bruto = h["x-forwarded-for"] || h["x-real-ip"] || "";
    const ip = String(bruto).split(",")[0].trim().split(":")[0];
    if (!ip) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split(".").slice(0, 3).join(".") + ".0";
    return ip.slice(0, 45);
  } catch (e) {
    return null;
  }
}

/* Devolve a linha do cliente da sessão, ou null.
   Uma consulta só (JOIN), não duas: menos ida ao banco por requisição.    */
async function clienteDaRequisicao(req) {
  const token = S.lerToken(req);
  if (!token) return null;

  const linha = await db.um(
    "SELECT c.id, c.name, c.email, c.whatsapp, c.birth_date, c.\"createdAt\", " +
    "       s.id AS sessao_id, s.\"expiresAt\" " +
    "FROM sessions s JOIN customers c ON c.id = s.\"customerId\" " +
    'WHERE s."tokenHash" = $1',
    [S.hashToken(token)]
  );

  if (!linha) return null;

  /* Sessão vencida: apaga na hora e trata como não autenticado. */
  if (new Date(linha.expiresAt).getTime() <= Date.now()) {
    await db.consulta("DELETE FROM sessions WHERE id = $1", [linha.sessao_id]);
    return null;
  }

  return linha;
}

/* Renovação deslizante: quem usa, continua conectado; quem abandona, cai.
   Sem isso, "não marcar Manter conectado" derrubaria a pessoa no meio do
   uso. O prazo nunca ULTRAPASSA a expiração original da sessão persistente
   — senão um cookie de 30 dias se renovaria para sempre.                 */
async function postergarSessao(req) {
  try {
    const token = S.lerToken(req);
    if (!token) return;
    const hash = S.hashToken(token);
    const atual = await db.um(
      "SELECT id, \"persistente\", \"expiresAt\" FROM sessions WHERE \"tokenHash\" = $1",
      [hash]
    );
    if (!atual) return;

    const nova = S.expiracaoDe(atual.persistente);
    /* só estende; nunca encurta uma sessão que ainda vale mais */
    if (new Date(nova).getTime() > new Date(atual.expiresAt).getTime()) {
      await db.consulta("UPDATE sessions SET \"expiresAt\" = $1 WHERE id = $2", [nova, atual.id]);
    }
  } catch (e) {
    /* Falha ao postergar não pode derrubar a requisição: a sessão atual
       continua valendo até o prazo que já estava gravado.                */
  }
}

/* ---------------------------------------------------------------- logout */
async function derrubarSessao(req) {
  const token = S.lerToken(req);
  if (!token) return;
  await db.consulta('DELETE FROM sessions WHERE "tokenHash" = $1', [S.hashToken(token)]);
}

/* Trocar a senha tem de derrubar TODAS as sessões. Se alguém entrou na
   conta com a senha vazada, mudar a senha precisa expulsar essa pessoa.  */
async function derrubarTodasSessoes(customerId) {
  await db.consulta('DELETE FROM sessions WHERE "customerId" = $1', [customerId]);
}

/* -------------------------------------------------------------- faxina
   Sessões vencidas não servem para nada e crescem para sempre. Chamada de
   forma oportunista (probabilística) para não custar em toda requisição.  */
async function limparSessoesVencidas() {
  try {
    if (Math.random() > 0.05) return; // ~5% das chamadas
    await db.consulta('DELETE FROM sessions WHERE "expiresAt" < now()');
  } catch (e) { /* faxina nunca pode quebrar a requisição */ }
}

/* ------------------------------------------------------- exigir cliente
   Usada pelas rotas privadas. Devolve a linha do cliente, ou null DEPOIS
   de já ter respondido 401. Quem chama deve simplesmente dar `return`.   */
async function exigirCliente(req, res, http) {
  let linha;
  try {
    linha = await clienteDaRequisicao(req);
  } catch (e) {
    /* Banco fora do ar não é "não autenticado": é 503. Responder 401 aqui
       mandaria a pessoa para a tela de login sem motivo.                 */
    http.erro(res, 503, "Não consegui falar com o servidor agora. Tente de novo em instantes.");
    return null;
  }
  if (!linha) {
    http.erro(res, 401, "A sua sessão expirou. Entre de novo, por favor.");
    return null;
  }
  await postergarSessao(req);
  return linha;
}

/* Mensagem única de login. NÃO revela se o e-mail existe. */
const ERRO_LOGIN = "E-mail ou senha incorretos.";

module.exports = {
  CUSTO,
  ERRO_LOGIN,
  hashSenha,
  conferirSenha,
  criarSessao,
  clienteDaRequisicao,
  postergarSessao,
  derrubarSessao,
  derrubarTodasSessoes,
  limparSessoesVencidas,
  exigirCliente,
  ipDaRequisicao,
};
