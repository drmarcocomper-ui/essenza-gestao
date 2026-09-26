import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Todo link interno do app aponta para uma rota que existe de verdade.
 *
 * `next build` não pega isto: `href` montado com template literal
 * (`/clientes/${id}/formulas/nova`) não é conferido contra as rotas
 * tipadas, então um caminho errado compila, passa no build e só aparece
 * como 404 no celular dela, no meio de um atendimento.
 */

const RAIZ = path.resolve(import.meta.dirname, "../..");
const APP = path.join(RAIZ, "src/app");

/**
 * Rotas que o app já linka e que ainda não foram construídas. Ficam aqui
 * de propósito, uma a uma: entrar nesta lista é decisão, não descuido.
 *
 * Vazia hoje, e o normal é continuar vazia: todo link do app aponta para
 * uma rota que existe. Ela serve para o caso em que a tela venha antes da
 * rota de propósito — aí o caminho entra aqui, com o motivo escrito ao
 * lado, e sai assim que a rota nascer.
 */
const ROTAS_PENDENTES: string[] = [];

/** Arquivos de código onde um link pode estar escrito. */
function arquivosDeCodigo(dir: string): string[] {
  const saida: string[] = [];

  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, item.name);

    if (item.isDirectory()) {
      saida.push(...arquivosDeCodigo(completo));
    } else if (/\.tsx?$/.test(item.name) && !/\.test\.tsx?$/.test(item.name)) {
      saida.push(completo);
    }
  }

  return saida;
}

/**
 * Caminhos internos citados no arquivo, já normalizados: sem query, e com
 * cada `${...}` virando um segmento dinâmico.
 */
function linksDoArquivo(conteudo: string): string[] {
  const encontrados = conteudo.matchAll(/["'`](\/[a-z][^"'`\s]*)["'`]/g);

  return [...encontrados]
    .map(([, caminho]) =>
      caminho
        .split(/[?#]/)[0]
        .replace(/\$\{[^}]*\}/g, ":dyn")
        .replace(/\/+$/, ""),
    )
    .filter((caminho) => caminho.length > 1);
}

/**
 * Resolve o caminho contra a árvore de `src/app`, do jeito que o Next
 * resolve: grupo de rota `(app)` não consome segmento, e `[param]` casa
 * com qualquer segmento.
 */
function rotaExiste(caminho: string, dir = APP): boolean {
  const segmentos = caminho.split("/").filter(Boolean);

  return resolver(dir, segmentos);
}

function resolver(dir: string, segmentos: string[]): boolean {
  if (segmentos.length === 0) {
    return (
      existsSync(path.join(dir, "page.tsx")) ||
      existsSync(path.join(dir, "route.ts"))
    );
  }

  const [primeiro, ...resto] = segmentos;

  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;

    const filho = path.join(dir, item.name);

    // Grupo de rota: existe na pasta, não na URL.
    if (item.name.startsWith("(") && item.name.endsWith(")")) {
      if (resolver(filho, segmentos)) return true;
      continue;
    }

    const dinamico = item.name.startsWith("[") && item.name.endsWith("]");

    if (item.name === primeiro || dinamico) {
      if (resolver(filho, resto)) return true;
    }
  }

  return false;
}

describe("links internos", () => {
  const arquivos = [
    ...arquivosDeCodigo(APP),
    ...arquivosDeCodigo(path.join(RAIZ, "src/components")),
    ...arquivosDeCodigo(path.join(RAIZ, "src/lib")),
  ];

  const links = [
    ...new Set(
      arquivos.flatMap((arquivo) =>
        linksDoArquivo(readFileSync(arquivo, "utf8")),
      ),
    ),
  ]
    // Só caminho de navegação: assets e endpoints externos ficam fora.
    .filter((caminho) => !/\.(jpg|png|svg|ico|webmanifest|js|css)$/.test(caminho))
    .filter((caminho) => !caminho.startsWith("/storage/"))
    .filter((caminho) => !ROTAS_PENDENTES.includes(caminho));

  it("acha links para conferir (senão o teste não está testando nada)", () => {
    expect(links.length).toBeGreaterThan(5);
  });

  it.each(links)("%s resolve para uma rota existente", (caminho) => {
    expect(rotaExiste(caminho)).toBe(true);
  });
});

describe("rotas da seção Extensão", () => {
  /**
   * `/produtos/extensao/...` só funciona porque o segmento estático
   * `extensao` ganha do `[id]` da revenda; e o desmembrar é linkado com
   * template literal, que o build não confere.
   */
  it.each([
    "src/app/(app)/produtos/extensao/nova/page.tsx",
    "src/app/(app)/produtos/extensao/[id]/page.tsx",
    "src/app/(app)/produtos/extensao/[id]/desmembrar/page.tsx",
  ])("%s existe", (arquivo) => {
    expect(existsSync(path.join(RAIZ, arquivo))).toBe(true);
  });

  it.each([
    "/produtos/extensao/nova",
    "/produtos/extensao/:dyn",
    "/produtos/extensao/:dyn/desmembrar",
  ])("%s é uma rota navegável", (caminho) => {
    expect(rotaExiste(caminho)).toBe(true);
  });
});

describe("rotas do módulo de fórmula e atendimento", () => {
  /**
   * Os arquivos que o fluxo principal depende, fixados pelo caminho.
   * O 404 de "Nova fórmula" nasceu aqui: a rota existia no build e o
   * servidor de desenvolvimento não a enxergava.
   */
  const ARQUIVOS = [
    "src/app/(app)/clientes/[id]/formulas/nova/page.tsx",
    "src/app/(app)/clientes/[id]/formulas/[formulaId]/page.tsx",
    "src/app/(app)/clientes/[id]/atendimentos/novo/page.tsx",
    "src/app/(app)/clientes/[id]/atendimentos/[atendimentoId]/page.tsx",
  ];

  it.each(ARQUIVOS)("%s existe", (arquivo) => {
    expect(existsSync(path.join(RAIZ, arquivo))).toBe(true);
  });

  it.each([
    "/clientes/:dyn/formulas/nova",
    "/clientes/:dyn/formulas/:dyn",
    "/clientes/:dyn/atendimentos/novo",
    "/clientes/:dyn/atendimentos/:dyn",
  ])("%s é uma rota navegável", (caminho) => {
    expect(rotaExiste(caminho)).toBe(true);
  });
});

describe("link do Caixa para a conta do atendimento", () => {
  /**
   * A edição de um lançamento de conta manda para o atendimento, onde a
   * conta é reaberta. O link é montado com template literal no
   * servidor; se o caminho mudar, é aqui que quebra, não no celular.
   */
  it("o link está na edição e resolve para a página do atendimento", () => {
    const pagina = readFileSync(
      path.join(RAIZ, "src/app/(app)/caixa/[id]/editar/page.tsx"),
      "utf8",
    );

    expect(linksDoArquivo(pagina)).toContain("/clientes/:dyn/atendimentos/:dyn");
    expect(rotaExiste("/clientes/:dyn/atendimentos/:dyn")).toBe(true);
  });
});

describe("links da peça de extensão na conta", () => {
  /**
   * A conta fechada leva à ficha da peça vendida. O href é template
   * literal: o build não confere, este teste sim.
   */
  it("a página do atendimento linka a peça, e o link resolve", () => {
    const pagina = readFileSync(
      path.join(
        RAIZ,
        "src/app/(app)/clientes/[id]/atendimentos/[atendimentoId]/page.tsx",
      ),
      "utf8",
    );

    expect(linksDoArquivo(pagina)).toContain("/produtos/extensao/:dyn");
    expect(rotaExiste("/produtos/extensao/:dyn")).toBe(true);
  });
});

describe("link do selo da peça para a conta", () => {
  it("o selo linka o atendimento, e o link resolve", () => {
    const selo = readFileSync(
      path.join(RAIZ, "src/components/produtos/SeloEstadoPeca.tsx"),
      "utf8",
    );

    expect(linksDoArquivo(selo)).toContain("/clientes/:dyn/atendimentos/:dyn");
    expect(rotaExiste("/clientes/:dyn/atendimentos/:dyn")).toBe(true);
  });
});
