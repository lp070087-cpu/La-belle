# Dependências do backend — La Belle Modas

Duas dependências, e nada além disso. O site público continua HTML/CSS/JS puro,
sem framework e sem passo de build.

| Pacote | Versão | Por que |
| --- | --- | --- |
| `pg` | ^8.11.5 | Cliente oficial do PostgreSQL no Node. Faz a conexão com o Neon. É a única forma de falar com o banco. |
| `bcryptjs` | ^2.4.3 | Hash de senha. Mesmo algoritmo do `bcrypt` (`$2a$`/`$2b$`), mas em JavaScript puro — sem compilação nativa, que quebra no ambiente serverless da Vercel. |

## Por que estas, e não outras

**Por que não um ORM (Prisma, Drizzle, Knex).** O projeto tem **uma tabela** de
domínio e cinco consultas. Um ORM traria um gerador de cliente, um schema
próprio, um passo extra de build e mais uma coisa para quebrar sem ninguém
precisar. `pg` com queries parametrizadas resolve, e é o que o Neon documenta.
A migration é SQL puro e legível (ver `migrations/001_autenticacao.sql`).

**Por que `bcryptjs` e não `bcrypt`.** O `bcrypt` nativo precisa compilar C++ no
`npm install`. Na Vercel isso é uma fonte clássica de falha de build. O
`bcryptjs` é puro JavaScript, tem a mesma saída e nenhuma dependência. O custo é
ser um pouco mais lento por hash — irrelevante para login.

**Por que não `argon2`.** Também nativo, mesmo problema de compilação.

**Por que não JWT.** Sessão em cookie opaco com registro no banco permite
**invalidar** o acesso na hora (logout de verdade, troca de senha derruba as
sessões antigas). JWT assinado não permite revogar sem manter uma lista negra —
que é a tabela de sessões de volta, com mais passos. Veja `api/_lib/auth.js`.

## Instalar

```bash
cd apresentacao
npm install
```

Sem rede não há instalação. Se `npm install` falhar por falta de internet, as
dependências precisam ser instaladas numa máquina com acesso, ou direto pela
Vercel durante o deploy.
