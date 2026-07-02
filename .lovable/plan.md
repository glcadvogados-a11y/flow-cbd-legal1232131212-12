
# Sistema de Gestão Jurídica – CBD

App React + TanStack Start rodando 100% no navegador. Dados persistidos em `localStorage` (sem backend). Interface em português, sidebar de navegação, visual limpo tipo painel de gestão.

> Observação importante sobre "login": como você escolheu **só front-end + localStorage**, o login é uma trava de acesso local (usuário/senha guardados no navegador, sem servidor). Não é autenticação real — qualquer pessoa com acesso ao mesmo navegador pode entrar. Se um dia quiser login real com usuários separados, migramos para Lovable Cloud.

## Stack e persistência

- React + TanStack Start (já configurado no projeto).
- Tailwind + shadcn/ui para UI.
- `localStorage` como banco, acessado por um hook central (`useLocalDB`) com chaves versionadas: `cbd.patients`, `cbd.fulfillments`, `cbd.brands`, `cbd.auth`.
- `zod` para validar formulários.
- `date-fns` para cálculos de vencimento.
- Exportar/Importar JSON (backup manual) na tela de Configurações da sidebar.

## Estrutura de dados

```text
Brand        { id, nome, precoFrasco, comissaoPct, comissaoValor (derivado) }
Patient      { id, nome, cpf, estado: 'SP'|'BA', brandId, frascosPorPedido,
               alertaDias: 90|120, criadoEm }
Fulfillment  { id, patientId, dataProtocolo, dataDispensacao, dataVencimento,
               frascos, valorRecebido, observacoes, brandIdSnapshot,
               precoFrascoSnapshot, comissaoValorSnapshot }
AuthUser     { username, passwordHash (SHA-256), criadoEm }
```

Regras:
- Cadência SP = anual, BA = semestral (usada para sugerir próxima dispensação).
- Marca ativa do paciente é o `brandId` atual; o histórico preserva `brandIdSnapshot` + preço/comissão no momento da dispensação.
- Comissão por frasco = `precoFrasco * comissaoPct / 100` (calculada automaticamente).

## Status de estoque (dashboard)

Para cada paciente, pega a última `Fulfillment` e compara `dataVencimento` com hoje:
- Vermelho: vencido (`hoje > dataVencimento`).
- Amarelo: dentro da janela (`dataVencimento - hoje <= alertaDias`).
- Verde: em dia.
- Cinza: sem cumprimentos ainda.

## Telas

1. **Login / Cadastro inicial** (`/auth`)
   - Primeiro acesso: cria usuário/senha (hash SHA-256 via `crypto.subtle`, salvo em `cbd.auth`).
   - Depois: tela de login. Sessão marcada em `sessionStorage`.
   - Guard em layout `_app` que redireciona para `/auth` se não logado.

2. **Dashboard** (`/`)
   - Cards: total de pacientes, vencidos, em alerta, em dia, comissão do mês.
   - Tabela "Precisa de atenção" (vermelhos + amarelos) com paciente, marca, dias restantes, ação "Registrar cumprimento".

3. **Pacientes** (`/pacientes`)
   - Lista com busca por nome/CPF, filtro por estado e status.
   - Cadastro/edição (nome, CPF com máscara, estado SP/BA, marca ativa, frascos/pedido, alerta 90/120).
   - Detalhe do paciente (`/pacientes/$id`):
     - Dados + botão "Trocar marca ativa".
     - Histórico completo de cumprimentos.
     - Botão "Novo cumprimento" (modal): data protocolo, data dispensação, data vencimento, frascos, valor recebido, observações. Salva snapshots de marca/preço/comissão.

4. **Marcas** (`/marcas`)
   - CRUD: nome, preço/frasco, % comissão. Mostra comissão calculada.
   - Bloqueia exclusão se houver paciente/cumprimento vinculado.

5. **Financeiro** (`/financeiro`)
   - Filtros: período (mês/trimestre/ano/custom) e marca.
   - Totais: valor recebido, comissão total, nº de dispensações.
   - Tabela por marca: frascos dispensados, receita, comissão.
   - Tabela detalhada de dispensações no período.

## Arquivos a criar

```text
src/routes/auth.tsx
src/routes/_app.tsx                       # layout com sidebar + guard
src/routes/_app.index.tsx                 # dashboard
src/routes/_app.pacientes.tsx             # lista
src/routes/_app.pacientes.$id.tsx         # detalhe + histórico
src/routes/_app.marcas.tsx
src/routes/_app.financeiro.tsx
src/routes/index.tsx                      # redirect -> /auth ou /_app
src/components/app-sidebar.tsx
src/components/patient-form.tsx
src/components/fulfillment-form.tsx
src/components/brand-form.tsx
src/components/status-badge.tsx
src/lib/db.ts                             # useLocalDB + CRUD helpers
src/lib/auth.ts                           # hash, login, logout
src/lib/domain.ts                         # cálculos de status/comissão
src/lib/format.ts                         # BRL, datas, CPF
```

Atualizar `src/routes/__root.tsx` com título/descrição em pt-BR.

## Como rodar

O Lovable já executa o app automaticamente no preview do lado — não precisa comando. Localmente (fora do Lovable):

```bash
bun install
bun dev
```

Servidor em `http://localhost:8080`. Dados ficam salvos no `localStorage` do navegador (limpar cache apaga tudo — use o botão "Exportar backup" periodicamente).

## Fora de escopo (posso adicionar depois)

- Login real multi-usuário (exige Lovable Cloud).
- Sincronização entre dispositivos.
- Notificações por e-mail dos alertas.
- Anexos de PDFs de protocolo.
