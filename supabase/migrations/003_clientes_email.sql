-- =====================================================================
-- Essenza — Migration 003: coluna de email em clientes
--
-- Omissão das migrations 001/002: a aba Cadastro da planilha tem E-mail
-- preenchido em 17 dos 126 clientes, e a coluna não foi criada.
-- Descoberto na importação, quando o Table Editor recusou o CSV.
-- =====================================================================

alter table public.clientes add column if not exists email text;