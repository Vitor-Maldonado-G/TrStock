# TR Stock — esquema do banco (Supabase / Postgres)

Documento pra quem for montar o backend no Supabase. O frontend já está escrito
esperando essa estrutura — se algum nome de tabela/coluna mudar, avisar pra
ajustar os dois lados juntos.

## Autenticação

Usa o **Supabase Auth** (e-mail + senha) direto — não temos tabela de senha
própria. Como não há cadastro público, as contas são criadas manualmente:

- Pelo painel do Supabase (Authentication > Users > Add user), ou
- Futuramente por uma função/rota administrativa chamada pela tela
  "Gerenciar funcionários" (usa a Service Role key, nunca exposta no frontend).

## Tabelas

### `profiles`
Guarda nome e papel de cada usuário. `id` é o mesmo UUID do Supabase Auth.

| coluna      | tipo      | observação                              |
|-------------|-----------|------------------------------------------|
| id          | uuid (PK) | igual a `auth.users.id`                   |
| name        | text      |                                            |
| role        | text      | `'contador'` ou `'gerente'`               |
| active      | boolean   | default `true`                            |
| created_at  | timestamptz | default `now()`                         |

> Sugestão: criar um *trigger* em `auth.users` (on insert) que cria a linha
> correspondente em `profiles` automaticamente, ou simplesmente inserir os
> dois juntos na função administrativa de criar funcionário.

### `categories`
| coluna | tipo | observação |
|--------|------|------------|
| id     | uuid (PK) ou serial | |
| name   | text | ex: "Pizza / Esfiha" |
| slug   | text (unique) | ex: `pizza-esfiha`, usado na URL |

Linhas iniciais (seed): `pizza-esfiha`, `lanches`, `bebidas`, `diversos`.

### `products`
| coluna       | tipo    | observação |
|--------------|---------|------------|
| id           | uuid (PK) | |
| name         | text    | |
| unit         | text    | `unidades`, `kg`, `litros`, `pacotes`, `rolos`, ... |
| min_quantity | numeric | ponto de alerta definido pelo gerente |
| active       | boolean | default `true` (desativar em vez de apagar) |
| created_at   | timestamptz | default `now()` |

### `product_categories` (tabela de ligação — muitos-para-muitos)
| coluna       | tipo | observação |
|--------------|------|------------|
| product_id   | uuid (FK -> products.id) | |
| category_id  | uuid (FK -> categories.id) | |

Chave primária composta `(product_id, category_id)`.

### `counts`
Cada contagem é um **INSERT**, nunca um UPDATE — é assim que o histórico é
gerado automaticamente.

| coluna       | tipo        | observação |
|--------------|-------------|------------|
| id           | uuid (PK)   | |
| product_id   | uuid (FK -> products.id) | |
| quantity     | numeric     | |
| note         | text        | opcional, pode ser null |
| counted_by   | uuid (FK -> profiles.id) | |
| counted_at   | timestamptz | default `now()` |

**"Contagem mais recente de cada produto"** (usada no painel do gerente) é uma
query, não uma coluna: pegar o `counts` com maior `counted_at` por `product_id`
(no Postgres: `distinct on (product_id) ... order by product_id, counted_at desc`).

## RLS (Row Level Security) — resumo do que cada papel pode fazer

Deixar RLS **ativado** em todas as tabelas. Sugestão de política:

- `contador`: `select` em `products`, `categories`, `product_categories`;
  `insert` em `counts` (só pra si mesmo, `counted_by = auth.uid()`); sem
  acesso a `profiles` de outros usuários.
- `gerente`: acesso total (`select`/`insert`/`update`) em todas as tabelas
  acima, incluindo criar/editar produtos, categorias e perfis.

O papel de cada usuário pode ser checado numa política via subquery em
`profiles` (`role = (select role from profiles where id = auth.uid())`).

## Variáveis que o frontend precisa

```
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Ambas em Project Settings > API no painel do Supabase. A **anon key** é
segura de expor no frontend (é o que a RLS protege) — a **service role key**
nunca deve aparecer no código do frontend.
