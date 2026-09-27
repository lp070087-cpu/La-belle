# -*- coding: utf-8 -*-
"""
La Belle Modas — apresentacao
Gerador das versoes otimizadas das imagens.

LE AS FOTOS ORIGINAIS (somente leitura):
  ../imagens            (fotos da loja / editoriais)
  ../Public             (fotos da loja / produtos)
  ../imagens pra informacoes  (material institucional)

ESCREVE APENAS EM:
  assets/img/**

Os arquivos originais NUNCA sao alterados, renomeados ou removidos.
Este script existe para que qualquer pessoa possa regerar os assets.

Uso:  python3 build-images.py
"""

import os
import sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ASSETS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ASSETS)                 # /apresentacao
PROJ = os.path.dirname(ROOT)                   # raiz "La Belle"
SRC_LOCAL = os.path.join(PROJ, "imagens")
SRC_PUBLIC = os.path.join(PROJ, "Public")
SRC_INFO = os.path.join(PROJ, "imagens pra informaçoes")
OUT = os.path.join(ASSETS, "img")

QUALITY = 82

# ---------------------------------------------------------------- helpers

def val(path, *parts):
    """Valida que todos os arquivos existem antes de comecar."""
    if not os.path.isfile(path):
        raise SystemExit("Arquivo de origem ausente: %s" % path)
    return path


def cover(im, w, h):
    """Preenche w x h sem distorcer: recorta o excedente pelo centro."""
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def contain_square(im, size, bg=(255, 255, 255)):
    """Encaixa a foto inteira dentro de um quadrado (sem cortar)."""
    im = im.convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas.convert("RGB")


def save(im, sub, name, q=QUALITY):
    d = os.path.join(OUT, sub)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name)
    im.save(p, "WEBP", quality=q, method=6)
    return p


def load(p):
    return Image.open(val(p))


# ---------------------------------------------------------------- catalogo
# As escolhas foram feitas olhando cada foto (ver ANALISE.md, secao de imagens).
# Cada foto recebeu uma letra na folha de contato e e referenciada por ela aqui.

HERO = SRC_LOCAL
PUB = SRC_PUBLIC

# letras -> arquivo
A = f"{PUB}/821656291_18432915283180970_5319525107516482475_n.jpg"  # halter branco + short jeans
B = f"{PUB}/816615010_18431886130180970_4269967825687545028_n.jpg"  # conjunto branco ombro unico
C = f"{PUB}/800565900_18432915076180970_4193938143234718960_n.jpg"  # bustie branco + short jeans
D = f"{PUB}/822036194_18432915310180970_2645275167234320946_n.jpg"  # bustie branco + short jeans
E = f"{PUB}/817329515_18431886424180970_3805072921315345148_n.jpg"  # vestido rosa bebe plissado
F = f"{PUB}/816156839_18431888359180970_648118995351802450_n.jpg"  # vestido longo floral
G = f"{PUB}/814800350_18431738902180970_1542719740089419395_n.jpg"  # vestido preto drapeado
H = f"{PUB}/820292177_18432915139180970_6045180507143509178_n.jpg"  # corset laranja
I = f"{PUB}/814629396_18431739256180970_4983866177088408165_n.jpg"  # verde limao ombro unico
J = f"{PUB}/813765444_18431577142180970_5732900590097597841_n.jpg"  # vestido laranja curto
K = f"{PUB}/754250356_18421893070180970_4882096882699384706_n.jpg"  # top caramelo + calca jeans
L = f"{PUB}/825269447_18433072927180970_955238956199168493_n.jpg"  # vestido longo azul
M = f"{PUB}/825269541_18433072954180970_1074580883865446215_n.jpg" # vestido verde agua brilhante
N = f"{HERO}/749459266_18421243045180970_747059428945697971_n.jpg" # conjunto laranja + calca branca
O = f"{HERO}/810996459_18432814738180970_7820433858450629284_n.jpg" # vestido laranja franjas
P = f"{HERO}/811203282_18432578644180970_3172493300763850527_n.jpg" # trio de vestidos longos

# --- Fotos adicionais, para os 16 produtos terem imagem REAL.
#     Antes destas, p13..p16 existiam no catalogo e nao existiam no disco:
#     a loja mostrava quatro cartoes com imagem quebrada.
#     Cada legenda abaixo foi conferida olhando a foto ampliada (nao por suposicao):
W1 = f"{PUB}/749314996_18421258327180970_1388082453388124634_n.jpg"  # bustier amarelo + short jeans branco
W2 = f"{PUB}/821656291_18432915283180970_5319525107516482475_n.jpg"  # top branco + short jeans amarracao rosa
W3 = f"{PUB}/734277504_18419714614180970_1368173103856364497_n.jpg"  # blusa pink + calca jeans wide leg clara
W4 = f"{PUB}/733852177_18419714728180970_2996374089865317858_n.jpg"  # top branco + calca jeans destroyed wide leg
W5 = f"{PUB}/743146867_18419714788180970_7093523110609683115_n.jpg"  # top azul + calca branca
W6 = f"{PUB}/742997768_18420149059180970_6198692883412308198_n.jpg"  # top branco + calca listrada clara
W7 = f"{PUB}/748718422_18420950029180970_8861733708887721078_n.jpg"  # vestido branco transpassado com faixa
W8 = f"{PUB}/761546357_18423403942180970_346216264307718050_n.jpg"   # vestido curto laranja ajustado
W9 = f"{PUB}/753225299_18422180446180970_777895760300293219_n.jpg"   # conjunto amarelo claro

PLAN = []

def add(src, dst, name, w, h, mode="cover"):
    PLAN.append((src, dst, name, w, h, mode))

# --- HERO: campanha
add(A, "hero", "hero-a", 1200, 1620)
add(A, "hero", "hero-a-sm", 760, 1010)
add(E, "hero", "hero-b", 1200, 1620)
add(G, "hero", "hero-c", 900, 1200)

# --- EDITORIAL: faixas largas (banners)
# ATENCAO: 'ed-verao' usa a letra O. A letra O ja e usada no hero (hero-c) e nos
# tall, por isso o nome "ed-verao" fica reservado so para a faixa larga.
add(P, "wide", "ed-campanha", 1800, 760)
add(N, "wide", "ed-duo", 1800, 760)
add(O, "wide", "ed-verao", 1800, 760)

# --- CATEGORIAS (recorte editorial 3:4)
add(E, "cat", "cat-vestidos", 760, 1010)
add(I, "cat", "cat-conjuntos", 760, 1010)
add(C, "cat", "cat-blusas", 760, 1010)
add(K, "cat", "cat-calcas", 760, 1010)
add(B, "cat", "cat-saias", 760, 1010)
add(M, "cat", "cat-lancamentos", 760, 1010)

# --- TALL: blocos verticais usados em mosaicos / monte seu look
add(P, "tall", "tall-a", 760, 1140)
add(O, "tall", "tall-b", 760, 1140)
add(N, "tall", "tall-c", 760, 1140)
add(G, "tall", "tall-d", 760, 1140)

# --- CARDS DE PRODUTO  (4:5, foto principal + foto alternativa p/ o hover)
CARDS = [
    ("p01", A, C),
    ("p02", D, I),
    ("p03", E, F),
    ("p04", G, H),
    ("p05", I, J),
    ("p06", K, L),
    ("p07", M, B),
    ("p08", N, O),
    ("p09", P, H),
    ("p10", J, M),
    ("p11", L, E),
    ("p12", C, D),
    # p13..p16 so passaram a ter foto nesta rodada (ver W1..W9 acima).
    # O nome de cada produto em dados.js descreve exatamente a foto principal.
    # Nao existe foto de vestido preto entre as imagens nao usadas: a unica e a
    # letra G, que ja e a foto de p04. Por isso p16 nao pode ser um "vestido preto"
    # sem repetir foto ou inventar peca — ele passou a ser a peca W8, que existe.
    ("p13", W1, W2),  # conj. short branco ..... bustier amarelo + short jeans / top branco + short jeans
    ("p14", W3, W4),  # calca jeans wide leg ... blusa pink + calca clara / top branco + jeans destroyed
    ("p15", W5, W6),  # conj. calca branca ..... top azul + calca branca / top branco + calca listrada
    ("p16", W8, W9),  # vestido curto laranja .. vestido curto laranja ajustado / conjunto amarelo claro
]

for code, a, b in CARDS:
    add(a, "card", "%s-a" % code, 720, 900)
    add(b, "card", "%s-b" % code, 720, 900)

# --- REELS: formato 9:16, mesma linguagem visual dos reels do perfil
REELS = [
    ("r01", A), ("r02", E), ("r03", G), ("r04", I),
    ("r05", P), ("r06", O), ("r07", N), ("r08", M),
]
for code, a in REELS:
    add(a, "reel", "%s" % code, 480, 854)

# --- mosaico institucional (quadrados)
add(C, "tall", "inst-a", 760, 760)
add(F, "tall", "inst-b", 760, 760)


def limpar_saida():
    """Apaga SOMENTE o que este script gera (assets/img).

    As pastas de origem (imagens/, Public/, 'imagens pra informacoes/') nunca
    sao tocadas. Sem esta limpeza, sobras de uma execucao anterior — arquivos
    renomeados ou sem extensao — continuariam no projeto como peso morto e
    poderiam mascarar um caminho quebrado.
    """
    if not os.path.isdir(OUT):
        return
    removidos = 0
    for raiz, dirs, arqs in os.walk(OUT, topdown=False):
        for a in arqs:
            os.remove(os.path.join(raiz, a))
            removidos += 1
        for d in dirs:
            p = os.path.join(raiz, d)
            if not os.listdir(p):
                os.rmdir(p)
    if removidos:
        print("limpeza: %d arquivo(s) antigo(s) removido(s)" % removidos)


def main():
    if not os.path.isdir(SRC_LOCAL) or not os.path.isdir(SRC_PUBLIC):
        raise SystemExit("Pastas de origem nao encontradas. Rode este script de dentro de /apresentacao.")

    limpar_saida()

    n = 0
    for src, dst, name, w, h, mode in PLAN:
        im = load(src)
        out = cover(im, w, h) if mode == "cover" else contain_square(im, w)
        save(out, dst, "%s.webp" % name)
        n += 1

    # --- LOGO: extraida da captura de tela do perfil (material da propria loja)
    prof = load(os.path.join(SRC_INFO, "Captura de tela 2026-09-26 142853.png"))
    # circulo do avatar dentro da captura 751x259
    avatar = prof.crop((62, 88, 188, 214)).resize((512, 512), Image.LANCZOS)
    save(avatar, "logo", "labelle-avatar.webp")
    save(avatar.resize((160, 160), Image.LANCZOS), "logo", "labelle-avatar-sm.webp")

    # marca d'agua do destaque "Clientes" (coração + silhuetas) recortada do print dos destaques
    hl = load(os.path.join(SRC_INFO, "Captura de tela 2026-09-26 142843.png"))
    save(hl.crop((496, 26, 564, 94)).resize((256, 256), Image.LANCZOS), "logo", "icon-clientes.webp")
    save(hl.crop((360, 26, 428, 94)).resize((256, 256), Image.LANCZOS), "logo", "icon-feedback.webp")
    save(hl.crop((558, 58, 604, 108)).resize((220, 240), Image.LANCZOS), "logo", "icon-envios.webp")

    # miniaturas dos destaques (a propria loja usa esses icones no perfil)
    hl2 = load(os.path.join(SRC_INFO, "Captura de tela 2026-09-26 143134.png"))
    save(hl2.crop((14, 8, 96, 96)).resize((256, 256), Image.LANCZOS), "logo", "icon-brasil.webp")

    # foto da embalagem/brinde (conteudo real da loja)
    # o nome PRECISA terminar em .webp: o site referencia assets/img/tall/brindes.webp
    gift = load(os.path.join(SRC_INFO, "Captura de tela 2026-09-26 145611.png"))
    save(cover(gift, 900, 900), "tall", "brindes.webp")

    print("OK — %d imagens geradas em assets/img" % (n + 6))


if __name__ == "__main__":
    main()
