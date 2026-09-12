# TR Stock

Aplicação web instalável (PWA) para controle de estoque da TR. É feita com React e Vite, usa Supabase para autenticação, banco de dados e armazenamento de fotos, e possui áreas separadas para contador e gerente.

## O que o sistema já faz

### Contador

- Login com e-mail e senha.
- Acesso somente às telas de contagem.
- Escolha de categoria para iniciar uma contagem.
- Registro de quantidade, observação e, quando necessário, foto do item.
- Campo de estimativa opcional para itens contados por foto.
- Aviso quando um produto já foi contado no mesmo dia, incluindo horário e responsável.
- Cada salvamento cria uma nova contagem, preservando o histórico.

### Gerente

- Painel com a última contagem de cada produto.
- Destaque e filtro de produtos abaixo da quantidade mínima.
- Filtros por categoria e por itens de mercado.
- Visualização de observações e fotos da última contagem.
- Cadastro, edição, ativação e desativação de produtos.
- Definição de unidade, quantidade mínima, categorias, item de mercado e contagem por foto.
- Cadastro, edição, ativação e desativação de funcionários.
- Histórico de contagens, com filtros por categoria e período.
- Exclusão de uma contagem pelo gerente.

## Tecnologias

- React 18 + Vite
- React Router
- Supabase Auth, Postgres, Storage e Edge Functions
- Lucide React para ícones
- Vite PWA para instalação como aplicativo

## Como executar localmente

1. Instale o Node.js LTS.
2. Na pasta do projeto, instale as dependências:

```bash
npm install
```

3. Copie `.env.example` para `.env` e informe os dados do projeto Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

4. Inicie o sistema:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.

Para gerar a versão de produção:

```bash
npm run build
```

## Configuração necessária no Supabase

O frontend espera estas tabelas:

- `profiles`: nome, papel (`contador` ou `gerente`) e status ativo do usuário.
- `categories`: nome e slug das categorias.
- `products`: nome, unidade, quantidade mínima, ativo, `count_by_photo` e `is_market_item`.
- `product_categories`: ligação entre produtos e categorias.
- `counts`: produto, quantidade opcional, observação, `photo_url`, responsável e data da contagem.

Também é necessário criar o bucket `fotos-contagem` no Storage e publicar a Edge Function `create-employee`. A função precisa das variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` configuradas no Supabase.

Mantenha o RLS ativo: contadores devem registrar apenas as próprias contagens; gerentes devem administrar produtos, funcionários e histórico.

## Categorias padrão

O aplicativo prioriza esta ordem nas telas:

1. Pizza / Esfiha
2. Lanches
3. Bebidas
4. Diversos
5. Produtos de limpeza

Outras categorias continuam funcionando, mas devem ser adicionadas à ordem em `CATEGORY_ORDER` nas telas caso precisem de uma posição específica.

## PWA e publicação

Os ícones do aplicativo já estão em `public/icons`. O projeto pode ser hospedado como site estático na Vercel, Netlify ou serviço equivalente. Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` também no ambiente de publicação.

## Observações importantes

- Nunca inclua a `SUPABASE_SERVICE_ROLE_KEY` no frontend ou no arquivo `.env` publicado.
- O arquivo `.env` é local e não deve ser enviado ao Git.
- O esquema histórico recomenda anular contagens em vez de apagá-las, caso auditoria seja necessária.
