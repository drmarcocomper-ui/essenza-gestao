import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListaEstoque from "./ListaEstoque";

const CONTAGEM = {
  data: "2026-09-10",
  registradoEm: "2026-09-10T14:00:00+00:00",
  quantidade: 5,
};

describe("ListaEstoque", () => {
  it("mostra o saldo, 'Sem contagem' e o aviso do negativo, na ordem recebida", () => {
    render(
      <ListaEstoque
        produtos={[
          {
            id: "1",
            nome: "Bain Terrapist",
            marca: null,
            saldo: { situacao: "contado", quantidade: 4, contagem: CONTAGEM },
          },
          {
            id: "2",
            nome: "Masque Terrapist",
            marca: null,
            saldo: { situacao: "sem_contagem" },
          },
          {
            id: "3",
            nome: "The One Redken",
            marca: "Redken",
            saldo: { situacao: "contado", quantidade: -2, contagem: CONTAGEM },
          },
        ]}
      />,
    );

    const linhas = screen.getAllByRole("link");

    expect(linhas.map((linha) => linha.getAttribute("href"))).toEqual([
      "/produtos/1",
      "/produtos/2",
      "/produtos/3",
    ]);
    expect(linhas[0]).toHaveTextContent("4 un");
    expect(linhas[1]).toHaveTextContent("Sem contagem");
    expect(linhas[1]).not.toHaveTextContent(/\d+ un/);
    expect(linhas[2]).toHaveTextContent("-2 un");
    expect(linhas[2]).toHaveTextContent("Conte de novo");
  });

  it("sem produto ativo, diz isso", () => {
    render(<ListaEstoque produtos={[]} />);

    expect(screen.getByText("Nenhum produto de revenda ativo.")).toBeInTheDocument();
  });
});
