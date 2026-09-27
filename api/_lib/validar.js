/* ==========================================================================
   api/_lib/validar.js — REGRAS PURAS de validacao e normalizacao
   --------------------------------------------------------------------------
   Este arquivo NAO fala com o banco, NAO le cookie e NAO usa require de
   biblioteca externa. Sao funcoes de entrada e saida: recebem texto, devolvem
   texto. Isso e de proposito: sendo puro, ele pode ser provado por execucao
   (ver bancada-auth.js) em qualquer maquina, com ou sem rede.

   A mesma regra vale no servidor E no navegador. O navegador tem uma copia
   destas contas em assets/js/conta-ui.js (escrita para o front, sem modulo).
   Se um dia as duas divergirem, quem manda e ESTE arquivo: o servidor nunca
   confia no que veio do navegador.
   ========================================================================== */

"use strict";

/* ------------------------------------------------------------- e-mail
   Normalizar e obrigatorio: "Maria@Exemplo.COM " e "maria@exemplo.com" sao a
   MESMA pessoa. Sem normalizar, o UNIQUE do banco deixaria as duas entrarem. */
function normalizarEmail(email) {
  return String(email == null ? "" : email).trim().toLowerCase();
}

/* Checagem pragmatica: um @, algo antes, um ponto no dominio com 2+ letras.
   Nao tenta ser a RFC 5322 — regex gigante de e-mail rejeita endereco valido. */
const RE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

function emailValido(email) {
  const e = normalizarEmail(email);
  return e.length <= 254 && RE_EMAIL.test(e);
}

/* ------------------------------------------------------------ WhatsApp
   Guardamos so os digitos, com DDD: 11 (celular) ou 10 (fixo). O
   armazenamento nao depende da mascara que a pessoa digitou.              */
function somenteDigitos(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}

function whatsappValido(v) {
  const d = somenteDigitos(v);
  return d.length === 10 || d.length === 11;
}

/* --------------------------------------------------------------- nome
   Nome completo = pelo menos duas palavras, cada uma com 2+ letras. */
function nomeValido(nome) {
  const partes = String(nome == null ? "" : nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return false;
  return partes.every((p) => p.length >= 2);
}

function normalizarNome(nome) {
  return String(nome == null ? "" : nome).trim().replace(/\s+/g, " ");
}

/* -------------------------------------------------------------- senha
   Regra unica, usada no cadastro e na troca de senha:
     - pelo menos 8 caracteres;
     - nao pode ser so um tipo de caractere (so letras ou so numeros).      */
function senhaForte(s) {
  const v = String(s == null ? "" : s);
  if (v.length < 8) return false;
  const temLetra = /[A-Za-z]/.test(v);
  const temNumero = /\d/.test(v);
  const temSimbolo = /[^A-Za-z0-9]/.test(v);
  // duas categorias quaisquer entre tres
  return [temLetra, temNumero, temSimbolo].filter(Boolean).length >= 2;
}

/* -------------------------------------------------------- nascimento
   Aceita "AAAA-MM-DD" (o que o input type=date entrega) ou vazio (nulo).
   NAO usa new Date() para nao escorregar de fuso: compara texto.          */
function nascimentoValido(iso) {
  if (iso === null || iso === undefined || String(iso).trim() === "") return true; // opcional
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return false;
  const ano = +m[1], mes = +m[2], dia = +m[3];
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const ultimo = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > ultimo) return false;
  if (ano < 1900) return false;
  /* a data nao pode estar no futuro */
  const hoje = new Date();
  const limite = hoje.getFullYear() * 10000 + (hoje.getMonth() + 1) * 100 + hoje.getDate();
  if (ano * 10000 + mes * 100 + dia > limite) return false;
  return true;
}

function normalizarNascimento(iso) {
  const t = String(iso == null ? "" : iso).trim();
  return t === "" ? null : t;
}

/* ------------------------------------------------- faixa de validacao
   Cada funcao devolve { ok, erro }. "erro" e a mensagem que o navegador
   mostra. Sao as MESMAS mensagens dos formularios que ja existem — o
   objetivo e a pessoa ver a mesma frase em qualquer caminho.             */
function ok() { return { ok: true, erro: null }; }
function falha(erro) { return { ok: false, erro: erro }; }

/* ------------------------------------------------------------- cadastro */
function validarCadastro(d) {
  const nome = normalizarNome(d && d.nome);
  const email = normalizarEmail(d && d.email);
  const whatsapp = somenteDigitos(d && d.whatsapp);
  const senha = String((d && d.senha) == null ? "" : d.senha);
  const confirmar = String((d && d.confirmar) == null ? "" : (d.confirmar));
  const aceite = !!(d && d.aceite);

  if (!nome) return falha("Digite o seu nome completo.");
  if (!nomeValido(nome)) return falha("Inclua também o sobrenome.");
  if (!email) return falha("Digite o seu e-mail.");
  if (!emailValido(email)) return falha("Confira o seu e-mail, por favor.");
  if (!whatsapp) return falha("Digite o DDD e o número do WhatsApp.");
  if (!whatsappValido(whatsapp)) return falha("Digite o DDD e o número do WhatsApp.");
  if (!senha) return falha("Digite uma senha.");
  if (!senhaForte(senha)) return falha("Use pelo menos 8 caracteres, misturando letras e números.");
  if (!confirmar) return falha("Repita a senha para confirmar.");
  if (confirmar !== senha) return falha("As duas senhas estão diferentes.");
  if (!aceite) return falha("É preciso aceitar os termos de uso e a política de privacidade.");

  return { ok: true, dados: { nome, email, whatsapp, senha } };
}

/* ---------------------------------------------------------------- login
   Login NAO valida formato com mensagem especifica: qualquer problema vira a
   MESMA resposta generica. Dizer "esse e-mail nao existe" entrega a quem
   estiver tentando adivinhar quais e-mails tem conta aqui.               */
function validarLogin(d) {
  const email = normalizarEmail(d && d.email);
  const senha = String((d && d.senha) == null ? "" : d.senha);
  if (!email || !senha) return falha("Informe o seu e-mail e a sua senha.");
  return { ok: true, dados: { email, senha } };
}

/* ---------------------------------------------------------- meus dados
   Nesta primeira fase o E-MAIL NAO E ALTERAVEL por aqui. Motivo: trocar o
   e-mail e trocar o identificador de acesso. Isso exige confirmar que o novo
   endereco existe (link de verificacao) e avisar o endereco antigo. Sem
   e-mail configurado isso nao da para fazer com seguranca, entao o campo
   fica somente leitura em vez de virar um furo.                          */
function validarDados(d) {
  const nome = normalizarNome(d && d.nome);
  const whatsapp = somenteDigitos(d && d.whatsapp);
  const nascimento = normalizarNascimento(d && d.nascimento);

  if (!nome) return falha("Digite o seu nome completo.");
  if (!nomeValido(nome)) return falha("Inclua também o sobrenome.");
  if (!whatsapp) return falha("Digite o DDD e o número.");
  if (!whatsappValido(whatsapp)) return falha("Digite o DDD e o número.");
  if (!nascimentoValido(nascimento)) return falha("Confira a data de nascimento.");

  return { ok: true, dados: { nome, whatsapp, nascimento } };
}

/* ------------------------------------------------------- troca de senha */
function validarTrocaSenha(d) {
  const atual = String((d && d.atual) == null ? "" : d.atual);
  const nova = String((d && d.nova) == null ? "" : d.nova);
  const confirmar = String((d && d.confirmar) == null ? "" : d.confirmar);

  if (!atual) return falha("Digite a sua senha atual.");
  if (!nova) return falha("Digite a nova senha.");
  if (!senhaForte(nova)) return falha("Use pelo menos 8 caracteres, misturando letras e números.");
  if (!confirmar) return falha("Repita a nova senha.");
  if (confirmar !== nova) return falha("As duas senhas estão diferentes.");
  if (atual === nova) return falha("A nova senha precisa ser diferente da senha atual.");

  return { ok: true, dados: { atual, nova } };
}

module.exports = {
  normalizarEmail,
  emailValido,
  somenteDigitos,
  whatsappValido,
  nomeValido,
  normalizarNome,
  senhaForte,
  nascimentoValido,
  normalizarNascimento,
  validarCadastro,
  validarLogin,
  validarDados,
  validarTrocaSenha,
  ok,
  falha,
};
