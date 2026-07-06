# Plano: Login interno + banco na nuvem

## O que vai mudar (visão geral)
1. Ativar o Lovable Cloud (backend gerenciado) para armazenar tudo de forma persistente e compartilhada entre você e seu sócio.
2. Criar login por e-mail e senha **sem tela de cadastro público** — as duas contas serão criadas manualmente por mim, no banco. Qualquer visitante que tentar acessar cai direto na tela de login.
3. Migrar todas as coleções que hoje ficam no navegador (localStorage) para tabelas na nuvem, com regras de segurança (RLS) que só liberam leitura/escrita para usuários autenticados.
4. Trocar o `useCollection` do `src/lib/db.ts` para ler/gravar no banco em vez de `localStorage`, mantendo a mesma API para os componentes existentes (mínimo de mudanças na UI).
5. Fazer uma **importação única** dos dados atuais do seu navegador para a nuvem, para você não perder nada do que já cadastrou.

## Login (como vai funcionar)
- Tela `/auth`: só campos de e-mail e senha, botão **Entrar**. Sem "Criar conta", sem "Esqueci minha senha" público.
- Todas as rotas do sistema (`/`, `/pacientes`, `/processos`, `/marcas`, `/produtos`, `/consultas`, `/receitas`, etc.) passam a exigir sessão ativa. Sem sessão → redireciona para `/auth`.
- Botão **Sair** no cabeçalho.
- Vou criar as duas contas (a sua e a do seu sócio) direto no painel do Cloud. Você me passa os dois e-mails e as senhas iniciais — de preferência via o campo seguro, não no chat.

## Migração dos dados (o que vira tabela)
Coleções hoje em `localStorage` → tabelas na nuvem, com os mesmos campos que já existem em `src/lib/db.ts`:
- `states`, `brands`, `products`
- `patients` (+ `patient_produtos`)
- `processos`
- `cumprimentos` (+ `cumprimento_items`)
- `fulfillments` (+ `fulfillment_items`)
- `consultas`, `receitas`

Regras de acesso: **qualquer usuário logado (você ou seu sócio) enxerga e edita tudo** — é um sistema interno da dupla, não multi-cliente. Visitantes sem login não veem nada.

## Import inicial (não perder o que já está no navegador)
Depois do login funcionando, adiciono um botão **"Importar dados do navegador"** dentro da área logada, que pega o que já está salvo localmente e sobe pra nuvem uma vez. Depois disso, tudo é lido/gravado direto na nuvem.

## Detalhes técnicos (para referência)

```text
src/
├── integrations/supabase/          (gerado ao ativar o Cloud)
├── routes/
│   ├── auth.tsx                    (nova — só login)
│   ├── _authenticated/route.tsx    (gate; gerado pela integração)
│   └── _authenticated/*            (todas as rotas atuais movidas p/ cá)
├── lib/
│   ├── db.ts                       (mesma API, agora chama supabase)
│   └── *.functions.ts              (server fns para operações sensíveis)
└── components/                     (sem mudanças de UI relevantes)
```

- `useCollection<K>()` continua devolvendo `{ items, upsert, remove }`, mas por trás usa TanStack Query + Supabase (subscription em realtime opcional numa segunda etapa).
- RLS: `USING (auth.uid() is not null)` para SELECT/INSERT/UPDATE/DELETE nas tabelas de negócio; `user_roles` não é necessário porque não há papéis diferentes entre você e o sócio.
- Sem `signUp` público — a criação de conta acontece só no painel administrativo.

## O que **não** vai mudar agora
- Layout, cores, componentes de tela, cálculos de câmbio, regras de comissão — tudo continua igual.
- Nada de novos recursos além de login + persistência.

## Ordem de execução
1. Ativar Cloud.
2. Criar todas as tabelas + RLS + GRANTs numa migração só.
3. Criar `/auth` e mover rotas atuais para `_authenticated/`.
4. Reescrever `src/lib/db.ts` para usar o Supabase mantendo a mesma API.
5. Adicionar o botão de importação única.
6. Você me passa os dois e-mails/senhas → eu crio as contas → testamos o login.

Se estiver ok, confirma para eu começar pelo passo 1.
