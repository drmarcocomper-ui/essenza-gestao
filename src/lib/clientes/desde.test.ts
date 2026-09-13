import { describe, expect, it } from "vitest";

import { resolveClienteDesde } from "./desde";

describe("resolveClienteDesde", () => {
  it("usa a data de cadastro quando ela existe", () => {
    expect(resolveClienteDesde("2024-02-10", "2026-01-05")).toBe("2024-02-10");
  });

  it("prefere o cadastro mesmo quando o atendimento é mais antigo", () => {
    // Importadas da planilha têm atendimento anterior ao cadastro no app.
    // Ainda assim o cadastro é o que a ficha promete mostrar.
    expect(resolveClienteDesde("2026-03-01", "2020-07-15")).toBe("2026-03-01");
  });

  it("cai no primeiro atendimento quando não há data de cadastro", () => {
    expect(resolveClienteDesde(null, "2026-01-05")).toBe("2026-01-05");
  });

  it("devolve null sem cadastro e sem atendimento", () => {
    expect(resolveClienteDesde(null, null)).toBeNull();
  });

  it("trata undefined e string vazia como ausência", () => {
    expect(resolveClienteDesde(undefined, undefined)).toBeNull();
    expect(resolveClienteDesde("", "")).toBeNull();
    expect(resolveClienteDesde("", "2026-01-05")).toBe("2026-01-05");
  });
});
