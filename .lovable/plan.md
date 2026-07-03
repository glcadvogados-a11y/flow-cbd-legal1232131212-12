
# Arquitetura — Sistema de Gestão Jurídico/CBD

## 1. Princípios

- **Local agora, Cloud depois**: toda leitura/escrita passa por um "repositório" (`src/lib/repo/*`) com interface única. Hoje implementado sobre `localStorage`; amanhã trocamos a implementação por Lovable Cloud sem mexer nas telas.
- **Snapshots imutáveis**: preço, % de comissão e tipo do produto ficam "congelados" em cada fornecimento (histórico não muda se a marca mudar de preço).
- **Datas como verdade**: cada mudança de status grava a data; financeiro e prazos derivam disso.
- **Português, painel de gestão, sidebar** (mantém o visual atual).

## 2. Modelo de dados

### 2.1 Entidades

```text
Paciente
 ├─ Consultas (histórico médico)
 ├─ Receitas (emissão, validade, arquivo/observação)
 └─ Processos (ações judiciais)
      └─ Cumprimentos de Sentença (ciclos)
           └─ Fornecimentos (pedidos à SES)
                └─ Itens de Fornecimento (produto + qtd frascos)
```

- **Paciente**: nome, CPF, contato, estado, observações, marca preferencial (opcional).
- **Estado**: sigla, nome, meses de fornecimento padrão (SP=12, BA=6, editável).
- **Marca**: nome, contato do fornecedor, ativa/inativa.
- **Produto** = Marca + Tipo (`Isolado | Full Spectrum | Broad Spectrum`), com preço/frasco e % comissão próprios. Um paciente pode usar 1+ produtos simultaneamente.
- **Consulta**: paciente, data, médico, valor, observações.
- **Receita**: paciente, médico, data de emissão, validade, produtos prescritos (referência a Produto + posologia), arquivo/nome, observações.
- **Processo**: paciente, número CNJ, tipo (liminar/mérito), vara/comarca, data de protocolo, data da decisão, status (Em andamento / Ganho / Perdido / Encerrado), objeto (produtos que a decisão obriga fornecer + periodicidade).
- **Cumprimento de Sentença**: pertence a um Processo, número próprio, data de protocolo do cumprimento, período coberto (início/fim previstos), status.
- **Fornecimento** (pedido à SES): pertence a um Cumprimento, contém:
  - Datas de cada etapa do fluxo (ver §3).
  - Itens: `{ produtoId, tipoSnapshot, precoFrascoSnapshot, comissaoPctSnapshot, frascos }`.
  - Data de vencimento (validade do lote entregue) → gera alerta de renovação.
  - Valor total vendido ao Estado (opcional, quando conhecido).
  - Valor efetivamente recebido por nós (calculado dos itens; permite override).

### 2.2 Regras derivadas

- **Comissão do item** = `precoFrascoSnapshot × frascos × comissaoPctSnapshot / 100`.
- **Total recebido do Fornecimento** = soma das comissões dos itens (ou override manual).
- **Prazo protocolo→fornecimento** = `dataLiberacaoRF − dataProtocoloCumprimento`.
- **Próxima renovação** = `dataDispensacao + mesesFornecimento(estado)` OU `dataVencimentoLote` (o que vier antes).
- **Status de saúde do paciente** (Verde/Amarelo/Vermelho) = já existe, passa a olhar o último Fornecimento com status "Repasse recebido" ou "Liberado".

## 3. Fluxo de status do Fornecimento

Cada etapa grava data + usuário (quando houver auth real):

```text
1. Solicitação de invoice     (SES pediu orçamento)
2. Invoice enviado            (empresa enviou)
3. Aguardando L.I.
4. L.I. emitida               ── entra em PROJEÇÃO financeira
5. Produto em trânsito
6. Desembaraço RF (liberado)  ── inicia contagem dos ~15 dias
7. Liberado para SES
8. Pago pela SES              (SES → empresa)
9. Repasse recebido           ── entra em REALIZADO
   • Cancelado                (etapa terminal alternativa)
```

Regras:
- **Realizado** = fornecimentos em "Repasse recebido" (usa `dataRepasse`).
- **Projetado** = fornecimentos entre "L.I. emitida" e "Pago pela SES" (não terminais, não cancelados). ETA = `dataLI + 21d` como padrão editável.
- **Realizado + Projetado** = visão consolidada.

## 4. Camada de dados (para migração futura)

```text
src/lib/repo/
 ├─ types.ts            (interfaces de todas entidades)
 ├─ index.ts            (export do repo ativo)
 ├─ local-storage.ts    (implementação atual, evolução do db.ts)
 └─ cloud.ts            (stub — implementado quando migrar)
```

Cada tela usa hooks tipo `usePatients()`, `useFornecimentos({ status, periodo })` que chamam o repo. Sem `localStorage` espalhado pelas telas. Migração para Cloud = trocar o export em `repo/index.ts` + rodar migração dos dados exportados via JSON (já existe Export/Import).

## 5. Navegação (sidebar)

```text
• Dashboard
• Pacientes            → lista → detalhe (abas: Dados | Consultas | Receitas | Processos | Fornecimentos | Financeiro)
• Processos            → lista global de processos (filtros por status/estado/paciente)
• Fornecimentos        → Kanban por status + lista com filtros (data, marca, estado, status)
• Financeiro
    ├─ Realizado
    ├─ Projetado
    └─ Consolidado (Realizado + Projetado)
• Marcas & Produtos    → Marca + tabela de Produtos (tipo/preço/comissão) por marca
• Estados              (já existe)
• Configurações / Backup
```

## 6. Telas principais

### 6.1 Dashboard
Cards no topo + gráficos abaixo:
- **Recebido no mês / trimestre / ano** (com variação vs. período anterior).
- **Projetado a receber** (soma dos fornecimentos entre L.I. e pagamento) e **ETA médio**.
- **Pacientes por status de saúde** (Verde/Amarelo/Vermelho) + link p/ lista filtrada.
- **Fornecimentos por etapa** (barra empilhada do funil).
- **Renovações nos próximos 30/60/90 dias**.
- **Receitas vencendo em 30 dias**.
- **Top 5 marcas por comissão no período**.
- **Prazo médio protocolo→fornecimento** (mês atual + tendência).

### 6.2 Paciente (detalhe)
Abas:
1. **Dados**: pessoais, estado, marca preferida, observações.
2. **Consultas**: histórico com data/médico/valor.
3. **Receitas**: com validade destacada e alerta quando vencendo.
4. **Processos**: lista dos processos, cada um expansível mostrando cumprimentos.
5. **Fornecimentos**: linha do tempo (todos os pedidos do paciente com status).
6. **Financeiro**: total recebido + projetado por este paciente, por ano.

### 6.3 Processo (detalhe)
Cabeçalho com número CNJ, status, decisão. Lista de Cumprimentos; cada Cumprimento abre lista de Fornecimentos com o funil de status.

### 6.4 Fornecimento (detalhe/edição)
- Wizard/steps com o funil de 9 etapas; cada etapa tem botão "Avançar" que pede a data.
- Itens (Produto+Frascos), com cálculo automático de comissão.
- Campos: valor vendido ao Estado (opcional), validade do lote, observações.
- Botão "Duplicar como próximo cumprimento" para o próximo ciclo.

### 6.5 Financeiro
Três abas (Realizado / Projetado / Consolidado), cada uma com:
- Filtros: período (mês/trimestre/ano/custom), marca, produto/tipo, estado, paciente.
- Totais e gráfico mensal.
- Tabela detalhada exportável (CSV).
- Em Projetado: coluna "ETA de recebimento".

### 6.6 Marcas & Produtos
Marca com tabela filha de Produtos (Tipo, Preço/frasco, %). Ao editar preço, avisa que fornecimentos existentes mantêm snapshot.

## 7. Alertas e automações (client-side)

- Toast/badge no menu quando houver: receitas vencendo, renovações próximas, fornecimentos parados >X dias numa etapa (X configurável por etapa).
- Painel "Pendências" no Dashboard listando o que precisa de ação hoje.

## 8. Backup / Segurança

- Export/Import JSON (já existe) — passará a incluir Processos, Cumprimentos, Consultas, Receitas, Produtos.
- Botão "Backup automático diário" que baixa JSON quando abre o app se >24h desde o último.
- Auth local mantida; quando migrar p/ Cloud, entra login por email/senha real e RLS por usuário/organização.

## 9. Roadmap de implementação (após aprovação)

1. **Fundação de dados**: novo `src/lib/repo/*` com tipos completos + migração do `db.ts` atual (mantém dados existentes).
2. **Marcas → Produtos**: adicionar entidade Produto (Marca+Tipo) e migrar fornecimentos antigos.
3. **Processos & Cumprimentos**: CRUD + vinculação a Paciente e Fornecimento.
4. **Fornecimento com funil de 9 status**: refatorar form + timeline.
5. **Consultas & Receitas** no paciente.
6. **Financeiro** com abas Realizado/Projetado/Consolidado.
7. **Dashboard novo** com os cards descritos.
8. **Alertas + backup automático**.
9. **(Depois)** troca do repo para Lovable Cloud.

## 10. Perguntas em aberto (posso decidir default se não responder)

- ETA padrão de recebimento após L.I.: **21 dias** (7 trânsito + 7 SES + 7 empresa) — ajustável por marca?
- Deve haver **múltiplas organizações/usuários** já hoje? (default: não, um usuário local.)
- Anexos de receita/decisão: **guardar arquivo** (base64 no localStorage tem limite ~5MB) ou **só nome + observação** por enquanto? (default: só metadata até migrar p/ Cloud.)
