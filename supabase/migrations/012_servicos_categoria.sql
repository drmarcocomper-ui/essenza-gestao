-- =====================================================================
-- Essenza — Migration 012: categoria do serviço no catálogo
--
-- A planilha da Kamylle já trazia os 24 serviços agrupados, e `servicos`
-- não tinha onde guardar esse agrupamento. Com 24 itens numa lista de
-- chips, na tela do celular, achar "Matização" no meio de tudo é rolagem
-- pura: a categoria existe para quebrar essa lista em blocos.
--
-- POR QUE NULLABLE:
--   o serviço que nasce no ato do atendimento (`origem_registro =
--   'atendimento'`, ver 008) é um nome digitado com pressa entre uma
--   cliente e outra — não há de onde tirar a categoria naquele momento.
--   Exigir categoria quebraria esse caminho, que é o único jeito de
--   registrar um serviço fora do catálogo. Sem categoria é o estado
--   normal de um serviço recém-nascido, não erro.
--
-- POR QUE SEM `check`, e sem default:
--   a lista das cinco categorias — Coloração, Corte, Tratamento,
--   Extensão, Serviço — ainda vai mudar conforme o catálogo assenta.
--   Um `check` no banco faria cada categoria nova virar uma migration
--   aplicada à mão no SQL Editor, e a lista mudaria mais rápido do que
--   isso. Aqui a regra mora na aplicação, em
--   `src/lib/servicos/schema.ts`, onde uma categoria nova é uma linha
--   de TypeScript.
--   Isto é diferente de `origem_registro` (008), que tem `check`: lá os
--   dois valores descrevem caminhos de código e só mudam se o app mudar.
--
-- POR QUE SEM ÍNDICE:
--   o catálogo tem dezenas de linhas e é lido inteiro para montar os
--   chips. Varredura sequencial de uma tabela desse tamanho é mais
--   barata que manter um índice.
-- =====================================================================

alter table public.servicos
  add column if not exists categoria text;

comment on column public.servicos.categoria is
  'Agrupamento do serviço na lista de chips. Sem `check` de propósito: a lista de valores é mantida na aplicação (src/lib/servicos/schema.ts), não no banco, porque ainda muda e cada mudança viraria uma migration. Null é válido — o serviço criado no ato de um atendimento nasce sem categoria.';
