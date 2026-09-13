import { describe, expect, it } from "vitest";

import {
  deslocarMes,
  mesValido,
  primeiroDia,
  rotuloMes,
  ultimoDia,
} from "./mes";

describe("mesValido", () => {
  it("aceita 'AAAA-MM'", () => {
    expect(mesValido("2026-09")).toBe(true);
  });

  it("recusa mês fora do calendário", () => {
    expect(mesValido("2026-00")).toBe(false);
    expect(mesValido("2026-13")).toBe(false);
  });

  it("recusa o que não tem a forma de mês", () => {
    expect(mesValido("2026-9")).toBe(false);
    expect(mesValido("2026-09-14")).toBe(false);
    expect(mesValido("setembro")).toBe(false);
    expect(mesValido(undefined)).toBe(false);
    expect(mesValido(["2026-09"])).toBe(false);
  });
});

describe("deslocarMes", () => {
  it("anda para frente e para trás dentro do ano", () => {
    expect(deslocarMes("2026-09", 1)).toBe("2026-10");
    expect(deslocarMes("2026-09", -1)).toBe("2026-08");
  });

  it("vira o ano nas duas pontas", () => {
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
  });

  it("anda mais de um ano de uma vez", () => {
    expect(deslocarMes("2026-05", 12)).toBe("2027-05");
    expect(deslocarMes("2026-05", -17)).toBe("2024-12");
  });
});

describe("rotuloMes", () => {
  it("escreve o mês por extenso", () => {
    expect(rotuloMes("2026-09")).toBe("Setembro de 2026");
    expect(rotuloMes("2026-01")).toBe("Janeiro de 2026");
    expect(rotuloMes("2026-12")).toBe("Dezembro de 2026");
  });
});

describe("limites do mês", () => {
  it("pega o primeiro dia", () => {
    expect(primeiroDia("2026-09")).toBe("2026-09-01");
  });

  it("pega o último dia de cada tamanho de mês", () => {
    expect(ultimoDia("2026-01")).toBe("2026-01-31");
    expect(ultimoDia("2026-04")).toBe("2026-04-30");
    expect(ultimoDia("2026-02")).toBe("2026-02-28");
  });

  it("acerta fevereiro de ano bissexto", () => {
    expect(ultimoDia("2028-02")).toBe("2028-02-29");
  });
});
