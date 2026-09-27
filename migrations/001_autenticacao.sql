-- ==========================================================================
-- La Belle Modas — autenticacao da area da cliente
-- --------------------------------------------------------------------------
-- Reproduzivel: pode rodar mais de uma vez sem quebrar nada.
-- Rode com:  npm run migrar   (le DATABASE_URL do ambiente)
--
-- O que este arquivo NAO faz: nao cria preco, nao cria pedido, nao cria
-- endereco. Pedidos e enderecos continuam demonstrativos nesta fase.
-- ==========================================================================

-- gen_random_uuid() mora aqui no Postgres 13+. No Neon ja vem disponivel
-- (o Neon roda Postgres 15+), mas o IF NOT EXISTS garante em qualquer versao.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------- CLIENTES
-- Tabela "customers". Um registro por pessoa que cria conta.
CREATE TABLE IF NOT EXISTS customers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  -- O e-mail e guardado SEMPRE normalizado (minusculo, sem espaco nas pontas)
  -- pelo servidor. Por isso o UNIQUE aqui ja barra duplicata de verdade.
  email         text        NOT NULL UNIQUE,
  whatsapp      text        NOT NULL,
  -- Data de nascimento nao e pedida no cadastro inicial: entra depois, em
  -- "Meus dados". Por isso aceita nulo.
  birth_date    date,
  -- Nome do campo igual ao pedido no escopo. Guarda SOMENTE o hash bcrypt
  -- ($2a$...). Nenhuma senha em texto puro passa por aqui.
  "passwordHash" text       NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

-- Busca por e-mail no login. O UNIQUE ja cria indice, mas o indice abaixo e
-- explicito porque toda tentativa de login consulta por e-mail.
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);

-- ------------------------------------------------------------- SESSOES
-- Sessao de verdade: guarda o SHA-256 do token, NUNCA o token.
-- Assim, mesmo com o banco vazado, ninguem monta um cookie valido.
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" uuid       NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  -- SHA-256 do token que vai no cookie. hex = 64 caracteres.
  "tokenHash" text        NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  -- Marca se a pessoa pediu "Manter conectado". Serve para auditar a duracao
  -- escolhida, e nao para decidir validade (quem decide e expiresAt).
  "persistente" boolean   NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  -- Guardados apenas para auditoria. NAO contem dado sensivel.
  "userAgent" text,
  ip          text
);

CREATE INDEX IF NOT EXISTS sessions_customer_idx ON sessions ("customerId");
-- Toda requisicao autenticada procura por tokenHash; o UNIQUE ja indexa.
-- Este indice serve para a faxina de sessoes vencidas.
CREATE INDEX IF NOT EXISTS sessions_expira_idx ON sessions ("expiresAt");

-- ------------------------------------------------- RECUPERACAO DE SENHA
-- Estrutura pronta, MAS NENHUM E-MAIL E ENVIADO NESTA FASE.
-- Nao existe servico de e-mail configurado, e inventar um reset "de mentira"
-- seria pior do que nao ter. A tabela fica aqui para que a integracao de
-- e-mail seja plugada sem migration nova.
--
-- Regras que o codigo ja respeita:
--   - guarda o SHA-256 do token, nunca o token;
--   - uso unico (usedAt);
--   - validade curta (expiresAt);
--   - quem pede reset recebe SEMPRE a mesma resposta, exista ou nao o e-mail.
CREATE TABLE IF NOT EXISTS password_resets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" uuid       NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  "tokenHash" text        NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "usedAt"    timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_customer_idx ON password_resets ("customerId");
