# TR Stock — frontend

Controle de estoque da TR. App instalável (PWA), feito em React + Vite,
conectado a um projeto Supabase (banco + autenticação).

## Como rodar localmente

```bash
npm install
cp .env.example .env
# preencha o .env com a URL e a anon key do projeto Supabase
npm run dev
```

Abre em `http://localhost:5173`.

## Estrutura

```
src/
  lib/
    supabaseClient.js   -> conexão com o Supabase
    AuthContext.jsx      -> sessão do usuário logado + papel (contador/gerente)
    ProtectedRoute.jsx    -> bloqueia rota por login/papel
  pages/
    Login.jsx             -> pronta e funcional
    Home.jsx               -> cards de categoria (placeholder — próxima etapa)
    Counting.jsx            -> tela de contagem (placeholder — próxima etapa)
    GerenteDashboard.jsx     -> painel de estoque (placeholder — próxima etapa)
    GerenteProdutos.jsx      -> gerenciar produtos (placeholder — próxima etapa)
    GerenteFuncionarios.jsx  -> gerenciar funcionários (placeholder — próxima etapa)
  App.jsx                -> rotas
  index.css               -> cores/fontes da TR (preto, laranja, amarelo)
```

## Status atual

- ✅ Login conectado ao Supabase Auth, com redirecionamento por papel
- ✅ Rotas protegidas (contador só acessa área de contagem, gerente só acessa painel)
- ✅ Estrutura de PWA configurada (falta gerar os ícones — ver abaixo)
- ⏳ Telas de contagem, painel, produtos e funcionários — próximas etapas

## Ícones do PWA

Faltam os arquivos `public/icons/icon-192.png` e `public/icons/icon-512.png`
(ícone quadrado da TR, fundo preto). Assim que tiver a logo em alta resolução,
é só exportar nesses dois tamanhos.

## Deploy

Este projeto builda como um site estático (`npm run build` gera a pasta `dist/`),
então funciona em qualquer hospedagem de frontend estático (Vercel, Netlify, etc.).
O guia passo a passo de deploy vem numa etapa futura, junto com a configuração
do projeto Supabase.
