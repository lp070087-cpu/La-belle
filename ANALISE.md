# La Belle Modas — Fase 1: análise e decisões

Documento de apoio à apresentação visual. Explica **o que foi lido**, **o que foi
decidido** e — principalmente — **o que não foi inventado**. Este arquivo não substitui
o site; ele existe para que qualquer pessoa entenda de onde veio cada informação.

---

## 1. Materiais lidos

Todos os arquivos originais foram lidos **apenas em modo de leitura**. Nada foi
renomeado, movido, alterado ou apagado.

| Pasta | Conteúdo | Uso na apresentação |
|---|---|---|
| `imagens/` | Fotos de campanha e editoriais da loja | hero, faixas largas, mosaico |
| `Public/` | Fotos de produto (grades do perfil) | cards de produto, categorias |
| `imagens pra informaçoes/` | Capturas de tela do perfil, destaques, política de trocas | identidade, logo, política, brindes |
| `vivence-joias-main/` | Projeto de referência (joias) | **somente** estudo de técnicas visuais |
| `link de rels` | Links reais de publicações do Instagram | seção Reels e grade do Instagram |

### O que foi extraído da referência (Vivence) e o que **não** foi

Da referência foram estudadas **apenas técnicas visuais**: a curva de aceleração
única (`cubic-bezier(.22,.61,.36,1)`), o brilho diagonal que atravessa o card no
hover, o sublinhado que varre da esquerda, e a convenção de atraso escalonado nos
elementos que aparecem ao rolar.

**Nada** da identidade da Vivence entrou aqui: nem marca, nem nome, nem logo, nem
texto, nem produto, nem cor, nem imagem. A referência também não possui sistema de
scroll próprio, então o vocabulário de movimento foi desenhado do zero para a
La Belle.

---

## 2. Identidade visual — cores medidas, não chutadas

A cor de destaque foi **extraída da própria foto da campanha**, não escolhida de
memória:

| Papel | Valor | Origem |
|---|---|---|
| Rosa de marca | `#ff65c3` | amostra da foto de campanha |
| Rosa forte (ação) | `#e8318f` | derivado do rosa de marca, para contraste em botões |
| Tinta (preto de base) | `#0f1116` | fundo escuro medido no material |
| Areia / areia-2 | neutros claros | para as faixas de respiro |

A paleta é usada com parcimônia: **rosa é acento**, não fundo. O corpo do site é
branco e neutro, para não cair no lugar-comum de "template todo rosa".

### Tipografia

`Playfair Display` (serifada) nos títulos e `Jost` (sem serifa, leve) nos rótulos.
Os micro-rótulos são caixa-alta com espaçamento crescente (`.1em` → `.28em`), o que
dá o tom de boutique.

### Logo

Não existe arquivo de logo isolado nos materiais. O avatar circular foi **recortado
da captura de tela do próprio perfil da loja** — ou seja, é material da La Belle,
não uma marca desenhada por nós. O mesmo vale para os ícones de destaque e para a
foto da embalagem/brinde.

---

## 3. Regra mais importante: preço não existe, então não foi inventado

Os materiais da loja **não trazem tabela de preços**. Publicar qualquer número seria
falsificar informação comercial.

Por isso, em **todo** o site — card, página da peça, sacola, resumo do pedido,
favoritos — o valor aparece como:

> **Valor sob consulta**

e o caminho oferecido é falar com a loja pelo WhatsApp. O filtro de preço da loja
explica isso em vez de exibir uma faixa de valores falsa.

O mesmo critério valeu para:

- **frete** — a loja não informou tabela pública. O cálculo por CEP mostra as
  *opções* (entrega local / transportadora) e diz que valor e prazo são confirmados
  no atendimento. Nenhum valor nem prazo de frete foi criado.
- **entrega local** — existe como opção, com valor e horário "a combinar". Não foi
  inventado preço nem prazo de entrega local.
- **parcelamento** — não há informação nos materiais, então nenhuma parcela, juros
  ou "em até 12x" foi inventado.
- **avaliações** — não há nota real. A página da peça diz "Peça nova na arara", sem
  número de estrelas ou de avaliações fabricado.

---

## 4. Dados reais usados (e onde aparecem)

Tudo abaixo vem dos materiais; nada foi criado.

| Dado | Valor | Onde aparece |
|---|---|---|
| Nome | La Belle Modas | cabeçalho, rodapé, títulos |
| Assinatura | "La Belle modas" | perfil |
| Instagram | `@labellemodas02` | faixa, rodapé, página Sobre |
| Seguidores | 379 mil | página Sobre, seção Instagram |
| Publicações | 7.975 | página Sobre |
| Bio | "Deixando você ainda mas BELA" | hero, página Sobre |
| Cidade | Só Verejo | rodapé, página Sobre |
| Endereço | Estrada de Águas Compridas, 395 | rodapé, página Sobre |
| Representante | `@mariagueixa` | rodapé, página Sobre |
| WhatsApp | link real `wa.me/message/KC6Z4GSRHU6TF1` | botão flutuante, CTAs |

**Não foram inventados**: telefone, e-mail, CNPJ, horário de funcionamento, CEP da
loja, redes sociais além das informadas, ou qualquer dado de contato adicional.

---

## 5. Política de trocas — texto preservado

A página `trocas.html` **reproduz** a política enviada pela loja. As regras estão
no array `TROCAS` em `assets/js/dados.js` e nenhuma foi reescrita, arredondada ou
"melhorada":

- **Posso trocar?** — exige nota fiscal (ou comprovante), produto em perfeitas
  condições, com etiqueta e dentro do prazo.
- **Prazo** — compras **on-line: 7 dias corridos**; compras **presenciais: 3 dias
  corridos**, sempre em perfeito estado e com a etiqueta original.
- **Peças que não são trocadas** — brancas, rendas, delicadas, tricô, promocionais,
  acessórios e bolsas.

As duas últimas seções da página ("Como pedir a troca" e "Ainda com dúvida?") são
orientação de interface e **não alteram** nenhuma regra acima.

---

## 6. Imagens — pipeline e escolhas

`assets/build-images.py` gera todas as versões otimizadas em WebP a partir das fotos
originais, **sem nunca escrever nas pastas de origem**. É regenerável por qualquer
pessoa: basta rodar `python3 assets/build-images.py` dentro de `apresentacao/`.

Cada foto recebeu uma letra (A–P) numa folha de contato e foi escolhida para um
papel específico, olhando a imagem:

| Letra | Conteúdo | Papel |
|---|---|---|
| A | halter branco + short jeans | hero principal, card p01 |
| E | vestido rosa plissado | hero alternativo, categoria Vestidos |
| G | vestido preto drapeado | hero escuro, card p04 |
| N | conjunto laranja + calça branca | faixa larga "duo" |
| O | vestido laranja com franjas | faixa larga "verão" |
| P | trio de vestidos longos | faixa de campanha, card p09 |

Formato e uso:

- **card de produto** 720×900 (4:5) — duas fotos por peça, para a troca no hover
- **categoria** 760×1010 (3:4)
- **faixa larga** 1800×760
- **reel** 480×854 (9:16)
- todas com `loading="lazy"`, `width`/`height` declarados e `aspect-ratio` no CSS,
  para não haver salto de layout

### Limitação honesta

Existem **duas fotos por peça**, não as três ou quatro de uma loja completa. Por
isso o hover do card é uma **troca entre duas fotos**, e não o giro de várias
posições. É uma limitação da apresentação, não um defeito escondido.

### Correção: as peças p13 a p16 estavam sem foto

Na primeira montagem, **16 produtos** foram cadastrados mas só **12 pares de fotos**
foram gerados. Resultado: a loja mostrava quatro cartões com imagem quebrada, e a
bancada não acusava, porque não conferia imagem de produto contra o disco.

Ao corrigir, três decisões foram tomadas — e todas na direção de **não inventar**:

1. **O nome descreve a foto.** As fotos remanescentes foram abertas uma a uma e o
   nome de cada peça foi escrito a partir do que a foto mostra. Um produto chamado
   "Short Alfaiataria" com foto de vestido branco seria informação inventada.
2. **O selo "-20%" saiu.** Era desconto inventado: o material da loja não traz preço
   nem percentual. A peça continua em "Promoções", que é uma vitrine, sem cravar
   número.
3. **p16 deixou de ser "vestido preto".** Entre as fotos não usadas **não existe
   outro vestido preto** — a única foto do tipo é a letra `G`, que já é a foto de
   p04. Em vez de repetir a foto ou inventar a peça, p16 passou a ser uma peça que
   realmente existe no material (vestido curto laranja, foto `W8`).

Também foi acrescentada à bancada a prova que faltava: **a contagem escrita à mão na
home tem de bater com o catálogo**. Antes dela, a home anunciava "Vestidos 4 peças"
enquanto a loja mostrava 7 — um número escrito à mão envelhece calado.

### Limite conhecido da bancada

A bancada lê arquivos, não pixels. Ela **não prova** que a foto escolhida para um
produto combina com o nome dele: isso foi conferido olhando as imagens ampliadas e
está registrado aqui. A bancada prova o que é mecânico — arquivo existe, contagem
bate, classe existe, link leva a algum lugar.

---

## 7. O que é demonstração (e está dito no site)

Estas telas existem para mostrar a interface, sem backend, e cada uma **avisa isso
na própria tela**:

- **Minha conta** — login, criar conta, pedidos, detalhe do pedido, rastreio,
  favoritos, endereços, meus dados
- **Sacola / checkout** — itens, cupom, cálculo por CEP, entrega local,
  transportadora, dados de entrega, forma de pagamento
- **Formulário de contato** (página Sobre)

Os pedidos de exemplo usam dados fictícios de rastreio **marcados como exemplo**
(`LB-24960`, código `...DEMO`) e endereços com "Exemplo" no nome, justamente para
não serem confundidos com informação real da loja.

O que **não** existe nesta fase, conforme o escopo: backend, banco de dados,
autenticação real, integração com Melhor Envio, integração de pagamento, publicação.

---

## 8. Arquitetura

```
/apresentacao
├─ index.html      home
├─ loja.html       catálogo com filtros
├─ produto.html    página da peça
├─ sacola.html     sacola + frete + checkout
├─ conta.html      minha conta
├─ trocas.html     política de trocas
├─ sobre.html      institucional + contato + brindes
├─ 404.html        página não encontrada
└─ assets
   ├─ css/  base.css · site.css · paginas.css
   ├─ js/   dados.js (fonte única) · ui.js (casca comum)
   ├─ img/  webp otimizados
   └─ build-images.py
```

Stack: **HTML, CSS e JavaScript puros**. Sem framework, sem build, sem dependência
instalada — conforme o escopo, que pede simplicidade e proíbe subir uma stack grande
para uma apresentação.

`dados.js` é a **fonte única de verdade**: catálogo, política de trocas, links reais
e dados da loja vivem só ali. `ui.js` monta a casca comum (faixa, cabeçalho, gavetas,
busca, rodapé, botão de WhatsApp) para que as oito páginas não dupliquem marcação.

---

## 9. Acessibilidade e movimento

- Link "pular para o conteúdo" em todas as páginas.
- Foco visível; gavetas e modais devolvem o foco ao elemento de origem ao fechar.
- `Esc` fecha gavetas; `aria-hidden`, `aria-expanded`, `aria-pressed` e rótulos
  `aria-label` nos controles de ícone.
- `prefers-reduced-motion` desliga animações e revelações.
- Alvos de toque com pelo menos 44px nos controles principais.
- `scroll-padding-top` para que âncoras não caiam sob o cabeçalho fixo.

---

## 10. Como abrir

Basta abrir `index.html` no navegador. A apresentação é estática e funciona por
`file://`, sem servidor.
