/* ==========================================================================
   scripts/migrar.js — aplica as migrations no banco do Neon
   --------------------------------------------------------------------------
   Uso:
     npm run migrar

   Le a DATABASE_URL do ambiente. Se existir um arquivo .env na raiz do
   projeto, ele e lido antes — assim nao e preciso exportar a variavel na mao
   a cada vez. O .env NAO e versionado (ver .gitignore).

   NUNCA ha URL escrita neste arquivo. Se a variavel nao existir, o script
   para e explica o que fazer, em vez de tentar adivinhar.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.dirname(__dirname);
const PASTA = path.join(RAIZ, "migrations");

/* ------------------------------------------------------------ .env minimo
   Leitor de .env proposital: sem dependencia nova, e sem nenhuma mágica.
   Formato aceito: LINHA=valor   (# inicia comentario)                      */
function carregarEnv() {
  const p = path.join(RAIZ, ".env");
  if (!fs.existsSync(p)) return false;
  const linhas = fs.readFileSync(p, "utf8").split(/\r?\n/);
  for (const linha of linhas) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const chave = t.slice(0, i).trim();
    /* tira aspas simples ou duplas em volta do valor, se houver */
    let valor = t.slice(i + 1).trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
    if (!(chave in process.env)) process.env[chave] = valor;
  }
  return true;
}

function parar(titulo, linhas) {
  console.error("\n" + titulo + "\n");
  for (const l of linhas) console.error("  " + l);
  console.error("");
  process.exit(1);
}

const tinhaEnv = carregarEnv();
const url = (process.env.DATABASE_URL || "").trim();

if (!url) {
  parar("DATABASE_URL nao esta definida — parei antes de tocar no banco.", [
    "1. Crie o projeto no Neon (https://neon.tech) e copie a connection string",
    '   do tipo "Pooled connection" (ela ja vem com ?sslmode=require).',
    "2. Em " + (tinhaEnv ? "o arquivo .env" : "um arquivo .env na raiz do projeto") + ", preencha:",
    "",
    "     DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require",
    "",
    "3. Na Vercel, adicione a MESMA variavel em",
    "   Project -> Settings -> Environment Variables (para Production e Preview).",
    "4. Rode de novo:  npm run migrar",
    "",
    "(Nenhuma URL ficticia foi embutida no codigo de proposito.)",
    tinhaEnv ? "" : "Dica: existe um .env.example pronto para copiar.",
  ].filter(Boolean));
}

/* Confere que a URL e do Postgres antes de conectar, para o erro ser claro. */
if (!/^postgres(ql)?:\/\//i.test(url)) {
  parar("DATABASE_URL nao parece uma conexao PostgreSQL.", [
    "Comece a URL com postgresql:// ou postgres://",
    "Se você colou a senha com caracteres especiais, ela precisa estar",
    "codificada na URL (ex.: @ vira %40).",
  ]);
}

/* --------------------------------------------------------------- arquivos */
if (!fs.existsSync(PASTA)) {
  parar("A pasta migrations nao foi encontrada.", ["Esperava: " + PASTA]);
}

const arquivos = fs.readdirSync(PASTA)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!arquivos.length) {
  parar("Nenhum arquivo .sql encontrado em migrations/.", []);
}

/* ----------------------------------------------------------------- rodar */
let pg;
try {
  pg = require("pg");
} catch (e) {
  parar("O pacote 'pg' nao esta instalado.", [
    "Rode:  npm install",
    "(O sandbox sem rede nao instala. Instale numa maquina com internet",
    "ou deixe a Vercel instalar durante o deploy.)",
  ]);
}

const { Client } = pg;

(async () => {
  const cliente = new Client({
    connectionString: url,
    /* O Neon exige TLS. Nao desligamos a verificacao de certificado aqui:
       a connection string do Neon ja traz o modo correto.                   */
    ssl: /sslmode=disable/i.test(url) ? false : { rejectUnauthorized: true },
  });

  console.log("\nAplicando migrations do La Belle Modas");
  console.log("  banco: " + url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@"));

  try {
    await cliente.connect();
  } catch (e) {
    parar("Nao consegui conectar no banco.", [
      "O banco existe e esta de pe?",
      "A DATABASE_URL esta correta e completa?",
      "Se a sua rede bloqueia TLS, verifique se a URL tem ?sslmode=require.",
      "",
      "Detalhe tecnico: " + (e && e.message ? e.message : String(e)),
    ]);
  }

  let aplicadas = 0;
  for (const arq of arquivos) {
    const sql = fs.readFileSync(path.join(PASTA, arq), "utf8");
    process.stdout.write("  " + arq + " ... ");
    try {
      /* Cada migration roda inteira ou nao roda nada. Assim uma falha no meio
         nao deixa o banco pela metade.                                   */
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query("COMMIT");
      console.log("ok");
      aplicadas++;
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      await cliente.end().catch(() => {});
      parar("Falhou em " + arq + ". Nada foi aplicado dessa migration.", [
        e && e.message ? e.message : String(e),
      ]);
    }
  }

  /* Prova final: as tabelas existem mesmo? Nao basta o comando ter saido
     sem erro — conferimos no catalogo do proprio Postgres.                */
  const esperadas = ["customers", "sessions", "password_resets"];
  const t = await cliente.query(
    "SELECT table_name FROM information_schema.tables " +
    "WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
    [esperadas]
  );
  const achadas = t.rows.map((r) => r.table_name).sort();
  const faltando = esperadas.filter((x) => achadas.indexOf(x) === -1);

  await cliente.end();

  console.log("\n  " + aplicadas + " arquivo(s) aplicado(s).");
  console.log("  tabelas no banco: " + (achadas.join(", ") || "(nenhuma)"));

  if (faltando.length) {
    parar("Migrations rodaram, mas estas tabelas nao existem:", faltando);
  }
  console.log("\nBanco pronto.\n");
})().catch((e) => {
  parar("Erro inesperado.", [e && e.message ? e.message : String(e)]);
});
