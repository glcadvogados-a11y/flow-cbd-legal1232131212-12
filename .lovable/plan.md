# Plano — Paciente completo, câmbio USD↔BRL e Processos

Este é um passo grande. Divido em 4 blocos independentes que posso entregar em sequência.

## 1. Ficha do paciente (histórico completo)

Rota nova: `/pacientes/:id` (já existe o arquivo `_app.pacientes.$id.tsx` — vamos preenchê-lo).

Dentro da ficha:
- **Cabeçalho**: nome, CPF, estado (SP anual / BA semestral), marca ativa, alerta configurado.
- **Timeline de cumprimentos** (ordenada por data do protocolo, mais recente primeiro), cada linha com:
  - Nº do processo / cumprimento
  - Data do protocolo
  - Data efetiva do fornecimento (dispensação)
  - Data de vencimento do estoque
  - **Lead time**: dias entre protocolo e dispensação (calculado)
  - Status atual do funil (pendente, em importação, aguardando SES, pago, etc.)
  - Frascos, marca/tipo, valor bruto
- **Botão "Novo cumprimento"** já existente.
- **Resumo**: total de cumprimentos, lead time médio, próximo vencimento.

## 2. Projeção financeira (a receber)

Novo bloco na tela **Financeiro**, acima da tabela atual:
- **Recebido no ano** (com filtro de mês) — soma de fornecimentos com status `repasse_recebido`.
- **Projeção a receber** — soma de fornecimentos com status entre `invoice_enviado` e `pago_ses` (ainda não caiu no nosso caixa, mas contratado).
- **Projeção total** — recebido + projeção.

Cada card mostra o valor em **BRL e USD** lado a lado (usando a cotação do dia para os não-fechados).

## 3. Marcas, produtos e câmbio USD↔BRL

### 3.1. Produto (expandir modelo)
Adicionar aos produtos:
- `tipo`: Full Spectrum / Broad Spectrum / Isolate (já existe)
- `concentracaoMg`: número (default 1500)
- `volumeMl`: número (default 30)
- `moeda`: BRL | USD (já existe)

Exibir na lista como: *"CBDEX — Full Spectrum 1500mg/30ml — US$ 340"* com o equivalente em R$ ao lado.

### 3.2. Cotação USD/BRL em tempo real
- Serviço `src/lib/fx.ts` que busca cotação atual (AwesomeAPI `economia.awesomeapi.com.br/json/last/USD-BRL` — gratuito, sem chave).
- Cache no `localStorage` por 30 min para não bater na API a cada render.
- Hook `useFxRate()` que devolve `{ rate, updatedAt, reload() }`.

### 3.3. Conversão nas telas
- Em qualquer valor mostrado, exibir moeda original + conversão (ex.: `US$ 340 · R$ 1.870`).
- Toggle global no Financeiro para "Ver tudo em BRL / USD / moeda original".

### 3.4. Fechamento de câmbio no recebimento
Ao mudar o status do fornecimento para `repasse_recebido`:
- Perguntar como fechar o câmbio:
  - **Usar cotação da data** (com date-picker, default = hoje) — busca cotação histórica.
  - **Inserir manualmente** (input com a taxa fechada).
- Salvar em campos novos no `Fulfillment`: `fxTaxaFechada`, `fxDataFechamento`, `fxOrigem` (`historica` | `manual`).
- Após fechado, o valor em BRL fica congelado — nunca mais recalcula com cotação nova.
- Prazo para fechar: até 5 dias após pagamento. Se passar sem fechar, avisar no dashboard.

## 4. Processos (item novo no menu lateral)

Rota nova: `/processos` (arquivo já existe `_app.processos.tsx` — expandir).

Modelo `Processo` (já existe no db) com campos:
- Nº do processo, paciente vinculado, estado, tipo (liminar / mérito), data de ajuizamento, vara/juiz, status.

Status sugeridos: `ajuizado`, `aguardando_liminar`, `liminar_deferida`, `liminar_indeferida`, `sentenca_favoravel`, `transito_julgado`, `arquivado`.

Tela lista todos os processos com filtro por status, com link para o paciente. Ficha do paciente também mostra os processos vinculados.

---

## Ordem de entrega sugerida

1. **Ficha do paciente + timeline** (bloco 1) — mais isolado e destrava a visão do dia a dia.
2. **Cotação USD/BRL + conversão nas telas** (blocos 3.2 e 3.3) — infraestrutura pra tudo depois.
3. **Fechamento de câmbio** (bloco 3.4) — depende do item 2.
4. **Projeção financeira** (bloco 2) — usa câmbio pronto.
5. **Marca com mg/ml** (bloco 3.1) — rápido.
6. **Processos** (bloco 4) — telinha nova.

## Detalhes técnicos

- Persistência continua em `localStorage` (arquitetura pronta pra Supabase depois).
- Novos campos em `Fulfillment`: `fxTaxaFechada?: number`, `fxDataFechamento?: string`, `fxOrigem?: "historica" | "manual"`.
- Novos campos em `Product`: `concentracaoMg?: number`, `volumeMl?: number`.
- Cotação histórica: AwesomeAPI aceita `/USD-BRL/1?start_date=YYYYMMDD&end_date=YYYYMMDD`.
- Helpers de conversão em `src/lib/fx.ts`: `useFxRate()`, `convertToBRL(v, moeda, rate)`, `convertToUSD(v, moeda, rate)`.
- Sem novas dependências.

Confirma essa ordem e eu começo pelo bloco 1 (ficha do paciente)?
