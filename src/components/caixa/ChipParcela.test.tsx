import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChipParcela from "./ChipParcela";

describe("ChipParcela", () => {
  it("mostra o rótulo n/N", () => {
    render(<ChipParcela parcelamento="1/3" />);

    expect(screen.getByText("Parcela 1/3")).toBeInTheDocument();
  });

  it("aceita parcela zero, que casa com o padrão", () => {
    render(<ChipParcela parcelamento="0/3" />);

    expect(screen.getByText("Parcela 0/3")).toBeInTheDocument();
  });

  it("não renderiza a data ISO do histórico importado", () => {
    const { container } = render(<ChipParcela parcelamento="2026-03-15" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza quando não há parcelamento", () => {
    const { container } = render(<ChipParcela parcelamento={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
