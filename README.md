# 💇 Painel de Controle de Caixa, Estoque e Vendas — Itens de Cabelo

Sistema web para controle de **estoque, vendas, caixa e repasses** de produtos de cabelo.
Feito em **HTML, CSS e JavaScript puro** (sem build/compilação), com dados no **Supabase**
e publicável no **Render** como _Static Site_.

## ✨ Funcionalidades

- 🔐 **Autenticação** por e-mail/senha (Supabase Auth), sessão persistente e rotas protegidas.
- 📦 **Produtos**: cadastro com foto (Supabase Storage), custo, preço, estoque mínimo, status e
  cálculos automáticos (investido, lucro/unidade, margem, potencial de venda e lucro potencial).
- 🔁 **Movimentações de estoque**: entrada, saída, venda, perda, danificado, devolução e ajuste —
  com histórico imutável e bloqueio de estoque negativo.
- 🛒 **Vendas**: carrinho com vários itens, validação de estoque, baixa automática e cálculo de
  faturamento, custo, lucro bruto, repasse de 10% e lucro líquido — de forma **atômica**.
- 📊 **Dashboard** com indicadores, filtros (hoje/semana/mês/mês anterior/personalizado/produto/
  categoria/pagamento) e **gráficos** (Chart.js).
- 💰 **Repasses**: geração por período, vendas incluídas, marcação como pago e total pendente.
- 📑 **Relatórios** com exportação **CSV, Excel e PDF**.

## 🧱 Tecnologias

| Camada       | Tecnologia                                         |
| ------------ | -------------------------------------------------- |
| Front-end    | HTML + CSS + JavaScript (ES Modules, sem build)    |
| Estilo       | Tailwind CSS (via CDN) + CSS próprio               |
| Gráficos     | Chart.js (via CDN)                                 |
| Ícones       | Lucide (via CDN)                                   |
| Banco / Auth | Supabase (PostgreSQL, Auth, Storage)               |
| Hospedagem   | Render (Static Site)                               |

As bibliotecas são carregadas por **CDN** usando um _import map_ no `index.html` —
não há `npm install` nem etapa de compilação.

> Apenas a chave **anon public** é usada (segura no navegador, protegida por **RLS**).
> A chave **`service_role` nunca** deve ser usada aqui.

## 📂 Estrutura de pastas

```
painel_controle_caixa_itens_cabelo/
├── index.html              # shell do app (carrega tudo)
├── config.example.js       # modelo das credenciais do Supabase
├── config.js               # (você cria) credenciais — está no .gitignore
├── favicon.svg
├── css/
│   └── styles.css
├── js/
│   ├── main.js             # bootstrap + roteador (hash)
│   ├── supabaseClient.js   # cria o cliente Supabase
│   ├── auth.js             # sessão, login, logout
│   ├── layout.js           # menu lateral + cabeçalho
│   ├── format.js / finance.js / filters.js / labels.js
│   ├── ui.js               # toasts, modais, confirmação
│   ├── export.js           # CSV / Excel / PDF
│   ├── components/
│   │   └── dataTable.js    # tabela com busca e paginação
│   └── pages/
│       ├── login.js  dashboard.js  produtos.js  novaVenda.js
│       └── movimentacoes.js  repasses.js  relatorios.js  configuracoes.js
├── supabase/
│   ├── schema.sql          # tabelas, índices, constraints e funções
│   └── rls.sql             # políticas de RLS + bucket de Storage
├── render.yaml             # blueprint de deploy no Render
└── servir.ps1              # sobe um servidor local para testes
```

---

## 🚀 1. Executar localmente

Como o projeto usa **módulos ES** e o Supabase Auth, ele precisa ser servido por **HTTP**
(não abra o `index.html` direto pelo `file://`).

### Opção A — script pronto (Windows / PowerShell)

```powershell
# Cria o config.js (se faltar), sobe o servidor e abre o navegador
powershell -ExecutionPolicy Bypass -File .\servir.ps1
```

### Opção B — manualmente

1. Copie `config.example.js` para `config.js` e preencha:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
     SUPABASE_ANON_KEY: 'SUA-ANON-KEY',
   }
   ```
2. Suba um servidor estático na pasta do projeto. Exemplos:
   ```bash
   npx serve .            # Node
   # ou
   python -m http.server  # Python
   ```
3. Abra o endereço indicado (ex.: <http://localhost:5173>) — funciona em PC e celular.

> Sem o `config.js` preenchido, a tela de login abre normalmente mas mostra um aviso
> de “Supabase não configurado”.

---

## 🗄️ 2. Criar o projeto no Supabase

1. Crie um projeto em <https://supabase.com>.
2. Em **Project Settings → API**, copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
3. No **SQL Editor**, execute na ordem:
   1. [`supabase/schema.sql`](supabase/schema.sql) — tabelas, índices, constraints e funções.
   2. [`supabase/rls.sql`](supabase/rls.sql) — políticas de RLS, bucket de Storage e Realtime.
   - _Já tinha instalado a versão antiga (dados por usuário)? Rode também_
     [`supabase/migracao_compartilhado_realtime.sql`](supabase/migracao_compartilhado_realtime.sql)
     _para passar ao acervo compartilhado + tempo real._
4. Crie o usuário admin em **Authentication → Users → Add user**.
   - (Opcional) Em **Authentication → Providers → Email**, desative “Confirm email” para
     login imediato.

---

## 🖼️ 3. Supabase Storage (fotos dos produtos)

O bucket `produtos` é criado automaticamente pelo `rls.sql`. Para criar manualmente:
**Storage → Create bucket → nome `produtos` → marque Public**. As políticas de upload já
estão no `rls.sql` (cada usuário só envia na própria “pasta” `user_id/...`).

---

## ☁️ 4. Publicar no Render (Static Site)

1. Suba o projeto para um repositório no GitHub.
2. No Render: **New → Static Site** e conecte o repositório.
3. Configure:
   - **Build Command:**
     ```
     printf "window.APP_CONFIG={SUPABASE_URL:'%s',SUPABASE_ANON_KEY:'%s'};" "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > config.js
     ```
   - **Publish Directory:** `.` (raiz do projeto)
4. Em **Environment**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. **Create Static Site**.

> O [`render.yaml`](render.yaml) já traz esse blueprint (use **New → Blueprint**).
> O comando de build gera o `config.js` a partir das variáveis de ambiente, mantendo as
> chaves fora do Git.

| Configuração       | Valor                                              |
| ------------------ | -------------------------------------------------- |
| Build Command      | gera `config.js` a partir das env vars (acima)     |
| Publish Directory  | `.`                                                |

---

## 🔢 Regras financeiras

```
Faturamento   = quantidade vendida × preço unitário de venda
Custo da venda = quantidade vendida × custo unitário do produto
Lucro bruto   = faturamento − custo da venda − desconto
Repasse (10%) = lucro bruto × 10%   (apenas se o lucro bruto for positivo)
Lucro líquido = lucro bruto − repasse
```

**Exemplo:** Faturamento R$ 100,00 · Custo R$ 60,00 · Lucro bruto R$ 40,00 ·
Repasse R$ 4,00 · Lucro líquido R$ 36,00.

---

## 🔒 Segurança

- **RLS ativado** em todas as tabelas; usuários anônimos não têm acesso.
- **Acervo compartilhado:** todos os usuários autenticados veem e operam o mesmo
  estoque/vendas/repasses (loja com vários operadores). O campo `user_id` registra
  quem fez cada operação. _(Para isolar por usuário, use as políticas originais por `user_id`.)_
- **Tempo real (Supabase Realtime):** mudanças de estoque/vendas aparecem ao vivo para
  todos os usuários conectados, sem precisar recarregar a página.
- Vendas e movimentações **não podem ser excluídas/editadas** pela interface (histórico preservado).
- Venda + baixa de estoque e geração de repasse usam **funções transacionais** no banco
  (`registrar_venda`, `registrar_movimentacao`, `gerar_repasse`): ou tudo é gravado, ou nada.
- O front-end usa **somente a anon key**.

---

## ❓ Solução de problemas

- **“Supabase não configurado”** → preencha `config.js` (local) ou as variáveis no Render.
- **Tela em branco / erro de módulo** → você abriu via `file://`. Use um servidor HTTP
  (veja a seção 1).
- **“Invalid login credentials”** → confira o usuário em Authentication; desative a
  confirmação de e-mail se necessário.
- **Erro ao subir foto** → confirme que o bucket `produtos` existe e que o `rls.sql` rodou.
