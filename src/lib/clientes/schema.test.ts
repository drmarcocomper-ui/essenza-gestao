import { describe, expect, it } from "vitest";

import { clienteSchema, errosPorCampo, lerFormulario } from "./schema";

/** Simula o que o `<form>` manda: todo campo chega como string. */
function formulario(campos: Record<string, string>) {
  const dados = new FormData();

  for (const [chave, valor] of Object.entries(campos)) {
    dados.set(chave, valor);
  }

  return dados;
}

const minimo = { nome: "Jéssica Conceição", telefone: "(27) 99999-8888" };

describe("clienteSchema", () => {
  it("aceita o cadastro mínimo e guarda o telefone só com dígitos", () => {
    const resultado = clienteSchema.safeParse(
      lerFormulario(formulario(minimo)),
    );

    expect(resultado.success).toBe(true);
    expect(resultado.data?.nome).toBe("Jéssica Conceição");
    expect(resultado.data?.telefone).toBe("27999998888");
  });

  it("transforma campo opcional vazio em null", () => {
    const { data } = clienteSchema.safeParse(lerFormulario(formulario(minimo)));

    expect(data?.email).toBeNull();
    expect(data?.data_nascimento).toBeNull();
    expect(data?.observacoes).toBeNull();
  });

  it("exige nome", () => {
    const { error } = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, nome: "  " })),
    );

    expect(errosPorCampo(error!).nome).toBe("Informe o nome da cliente");
  });

  it("exige telefone com DDD", () => {
    const { error } = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, telefone: "99998888" })),
    );

    expect(errosPorCampo(error!).telefone).toBe(
      "Telefone com DDD, 10 ou 11 dígitos",
    );
  });

  it("recusa e-mail inválido, mas aceita e-mail em branco", () => {
    const invalido = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, email: "arroba-nenhum" })),
    );
    expect(errosPorCampo(invalido.error!).email).toBe("E-mail inválido");

    const vazio = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, email: "" })),
    );
    expect(vazio.success).toBe(true);
  });

  it("recusa data de nascimento fora do formato", () => {
    const { error } = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, data_nascimento: "14/03/1990" })),
    );

    expect(errosPorCampo(error!).data_nascimento).toBe("Data inválida");
  });

  it("guarda os campos opcionais preenchidos", () => {
    const { data } = clienteSchema.safeParse(
      lerFormulario(
        formulario({
          ...minimo,
          email: " kamylle@exemplo.com ",
          data_nascimento: "1990-03-14",
          municipio: "Vitória",
          bairro: "Praia do Canto",
          profissao: "Advogada",
          preferencias: "Água com gás",
          origem: "Instagram",
          observacoes: "Couro cabeludo sensível",
        }),
      ),
    );

    expect(data?.email).toBe("kamylle@exemplo.com");
    expect(data?.data_nascimento).toBe("1990-03-14");
    expect(data?.municipio).toBe("Vitória");
    expect(data?.preferencias).toBe("Água com gás");
  });
});

describe("lerFormulario", () => {
  it("ignora campo que não pertence ao cadastro", () => {
    const dados = lerFormulario(
      formulario({ ...minimo, id_externo: "CL-0001", ativo: "false" }),
    );

    expect(dados).not.toHaveProperty("id_externo");
    expect(dados).not.toHaveProperty("ativo");
  });
});

describe("limite de tamanho", () => {
  it("recusa texto longo demais em vez de descartá-lo em silêncio", () => {
    const { error } = clienteSchema.safeParse(
      lerFormulario(formulario({ ...minimo, municipio: "a".repeat(101) })),
    );

    expect(errosPorCampo(error!).municipio).toBe("Máximo de 100 caracteres");
  });
});
