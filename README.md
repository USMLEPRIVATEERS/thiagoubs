# UBS Sitio dos Remedios - Sistema de Indicadores de Saude

Sistema web para gestao de indicadores de qualidade da UBS Sitio dos Remedios.
Importa dados CSV do e-SUS APS, calcula o cumprimento dos 7 indicadores do Ministerio da Saude, e exibe dashboard com acoes pendentes.

## Stack

- **Frontend**: Next.js (App Router, React, TypeScript, Tailwind CSS)
- **Backend/DB**: Supabase (PostgreSQL + Auth)
- **Deploy**: Vercel

## Setup

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL de `supabase-schema.sql` no SQL Editor do Supabase
3. Crie um usuario no Supabase Auth (email/senha)
4. Configure as variaveis de ambiente no `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
```

5. Instale e rode:

```bash
npm install
npm run dev
```

## Indicadores

| Codigo | Nome | Publico-alvo |
|--------|------|-------------|
| C1 | Mais Acesso | Todos os pacientes |
| C2 | Desenvolvimento Infantil | Criancas 0-24 meses |
| C3 | Gestacao e Puerperio | Gestantes e puerperas |
| C4 | Diabetes | Pacientes com diabetes |
| C5 | Hipertensao | Pacientes com hipertensao |
| C6 | Pessoa Idosa | Pacientes 60+ anos |
| C7 | Saude da Mulher | Mulheres e homens trans 9-69 anos |
