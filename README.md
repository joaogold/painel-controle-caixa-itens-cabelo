# 💇 Painel de Controle de Caixa, Estoque e Vendas — Itens de Cabelo

Sistema web para controle de **estoque, vendas, caixa e repasses** de produtos de cabelo.
Interface moderna e responsiva (desktop e celular), com dados persistidos no **Supabase**
e front-end publicável no **Render** como _Static Site_.

## ✨ Funcionalidades

- 🔐 **Autenticação** por e-mail/senha (Supabase Auth), sessão persistente e rotas protegidas.
- 📦 **Produtos**: cadastro com foto (Supabase Storage), custo, preço, estoque mínimo, status, e
  cálculos automáticos (investido, lucro/unidade, margem, potencial de venda e lucro potencial).
- 🔁 **Movimentações de estoque**: entrada, saída, venda, perda, danificado, devolução e ajuste —
  com histórico imutável e bloqueio de estoque negativo.
- 🛒 **Vendas**: carrinho com vários itens, validação de estoque, baixa automática e cálculo de
  faturamento, custo, lucro bruto, repasse de 10% e lucro líquido — tudo de forma **atômica**.
- 📊 **Dashboard** com cartões de indicadores, filtros (hoje, semana, mês, mês anterior,
  personalizado, produto, categoria, forma de pagamento) e **gráficos** (vendas por produto e
  resultado financeiro).
- 💰 **Repasses**: geração por período, visualização das vendas incluídas, marcação como pago e
  controle de pendências (uma venda nunca entra em dois repasses).
- 📑 **Relatórios** com exportação para **CSV, Excel e PDF**.

## 🧱 Arquitetura

| Camada        | Tecnologia                                            |
| ------------- | ----------------------------------------------------- |
| Front-end     | React + Vite + TypeScript + Tailwind CSS              |
| Gráficos      | Recharts                                              |
| Banco / Auth  | Supabase (PostgreSQL, Auth, Storage)                  |
| Hospedagem    | Render (Static Site)                                  |

> A chave **`service_role` nunca é usada no front-end**. Apenas a chave **`anon public`**,
> via variáveis de ambiente. Toda a segurança é reforçada por **Row Level Security (RLS)**.

## 📂 Estrutura de pastas

```
painel_controle_caixa_itens_cabelo/
├── public/                  # favicon e estáticos
├── src/
│   ├── components/          # Layout, Sidebar, UI (Modal, Table, Toast, ...)
│   ├── context/             # AuthContext (sessão Supabase)
│   ├── lib/                 # supabase, format, finance, filters, labels, export
│   ├── pages/               # Login, Dashboard, Produtos, NovaVenda, Movimentacoes,
│   │                        #   Repasses, Relatorios, Configuracoes
│   ├── types/               # tipos do domínio
│   ├── App.tsx              # rotas
│   └── main.tsx             # entrada
├── supabase/
│   ├── schema.sql           # tabelas, índices, constraints e funções (RPC)
│   └── rls.sql              # políticas de RLS + bucket de Storage
├── .env.example
├── render.yaml              # blueprint de deploy no Render
├── vite.config.ts
└── package.json
```

---

## 🚀 1. Executar localmente

### Pré-requisitos

- **Node.js 18+** e **npm** (instale em <https://nodejs.org>).
- Um projeto no **Supabase** (passo 2).

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
#   edite o .env com a URL e a anon key do seu projeto Supabase

# 3. Rodar em desenvolvimento
npm run dev
#   abra http://localhost:5173

# 4. Build de produção (gera a pasta dist/)
npm run build

# 5. Pré-visualizar o build
npm run preview
```

---

## 🗄️ 2. Criar o projeto no Supabase

1. Acesse <https://supabase.com> e crie um novo projeto (anote a senha do banco).
2. No menu **Project Settings → API**, copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`
3. Cole esses valores no seu arquivo `.env` (local) e nas variáveis do Render (deploy).

### Criar as tabelas e funções

1. Abra o **SQL Editor** no Supabase.
2. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em seguida, cole e execute [`supabase/rls.sql`](supabase/rls.sql).

> O `rls.sql` ativa o RLS em todas as tabelas, cria as políticas de acesso e também o
> **bucket de Storage** `produtos`.

### Criar o usuário administrador

1. Vá em **Authentication → Users → Add user**.
2. Informe e-mail e senha e confirme.
3. (Opcional) Em **Authentication → Providers → Email**, desative “Confirm email” para
   permitir login imediato sem confirmação por e-mail.
4. Use esse e-mail/senha na tela de login do sistema.

> Para adicionar mais usuários no futuro, basta repetir esse passo. Cada usuário enxerga
> apenas os próprios dados (RLS por `user_id`).

---

## 🖼️ 3. Configurar o Supabase Storage (fotos dos produtos)

O bucket `produtos` é criado automaticamente pelo `rls.sql`. Caso prefira criar manualmente:

1. Vá em **Storage → Create a new bucket**.
2. Nome: `produtos`. Marque **Public bucket** (apenas leitura pública das imagens).
3. As políticas de upload/edição/exclusão (restritas ao próprio usuário) já estão no `rls.sql`.

> As imagens são salvas no caminho `<user_id>/<produto_id>-<timestamp>.ext`, e o sistema
> guarda apenas a **URL pública** no campo `imagem_url` da tabela `produtos`.

---

## ☁️ 4. Publicar no Render (Static Site)

1. Suba este projeto para um repositório no GitHub/GitLab.
2. No Render, clique em **New → Static Site** e conecte o repositório.
3. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Em **Environment**, adicione as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Redirects/Rewrites** (para o React Router funcionar em rotas internas):
   - **Source:** `/*` → **Destination:** `/index.html` → **Action:** `Rewrite`
6. Clique em **Create Static Site**.

> O arquivo [`render.yaml`](render.yaml) já contém esse _blueprint_. Você pode usar
> **New → Blueprint** apontando para o repositório e o Render aplica tudo automaticamente
> (lembre de preencher as duas variáveis de ambiente).

| Configuração        | Valor                          |
| ------------------- | ------------------------------ |
| Build Command       | `npm install && npm run build` |
| Publish Directory   | `dist`                         |
| Rewrite             | `/*` → `/index.html`           |

---

## 🔢 5. Regras financeiras

```
Faturamento   = quantidade vendida × preço unitário de venda
Custo da venda = quantidade vendida × custo unitário do produto
Lucro bruto   = faturamento − custo da venda − desconto
Repasse (10%) = lucro bruto × 10%        (apenas se o lucro bruto for positivo)
Lucro líquido = lucro bruto − repasse
```

**Exemplo:** Faturamento R$ 100,00 · Custo R$ 60,00 · Lucro bruto R$ 40,00 ·
Repasse R$ 4,00 · Lucro líquido R$ 36,00.

As fórmulas estão centralizadas em [`src/lib/finance.ts`](src/lib/finance.ts) e replicadas nas
funções SQL para garantir consistência mesmo se os cálculos forem feitos no banco.

---

## 🔒 Segurança

- **RLS ativado** em todas as tabelas; usuários anônimos não têm acesso.
- Cada usuário só lê/escreve os próprios registros (`user_id = auth.uid()`).
- Vendas e movimentações **não podem ser excluídas/editadas** pela interface (histórico preservado).
- Operações compostas (venda + baixa de estoque, geração de repasse) usam **funções
  transacionais** (`registrar_venda`, `registrar_movimentacao`, `gerar_repasse`): ou tudo é
  gravado, ou nada permanece salvo.
- O front-end usa **somente a anon key**. A `service_role` jamais é exposta.

---

## 🧪 Comandos úteis

| Comando             | Descrição                                   |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                 |
| `npm run build`     | Type-check + build de produção (`dist/`)    |
| `npm run preview`   | Pré-visualiza o build de produção           |
| `npm run typecheck` | Apenas a checagem de tipos                  |

---

## ❓ Solução de problemas

- **“Supabase não configurado” na tela de login** → verifique `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` no `.env` (local) ou nas variáveis do Render. Após alterar no
  Render, faça um novo deploy (as variáveis `VITE_*` entram no build).
- **Login falha com “Invalid login credentials”** → confira o usuário em Authentication e, se
  necessário, desative a confirmação de e-mail.
- **Erro ao subir foto** → confirme que o bucket `produtos` existe e que o `rls.sql` foi
  executado.
- **Rotas dão 404 ao recarregar no Render** → confirme a regra de _Rewrite_ `/*` → `/index.html`.
