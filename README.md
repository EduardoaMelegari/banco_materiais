# Banco de Materiais

Sistema completo para:

- Cadastrar materiais com nome e preco
- Definir pasta/segmento do item no cadastro (ex.: CABO, DISJUNTOR, CONECTOR)
- Definir tipo do item no cadastro (material ou servico)
- Definir margem (%) por item no cadastro
- Editar e excluir itens
- Montar orcamento previo com multiplos itens
- Adicionar mao de obra personalizada por cliente no momento de montar o orcamento
- Salvar snapshot de preco de venda (com margem) por item no momento do orcamento
- Exportar orcamento em PDF com todos os detalhes
- Controlar status do orcamento (rascunho, aprovado, rejeitado)

## Tecnologias

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Banco: SQLite (arquivo local `backend/prisma/dev.db`)
- ORM: Prisma
- Validacao: Zod
- Testes: Vitest

## Estrutura

- `backend`: API e Prisma
- `frontend`: interface web

## Como rodar

1. Configure o backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

Copie `backend/.env.example` para `backend/.env` antes de rodar a API (ja vem com SQLite local).

2. Configure o frontend:

```bash
cd ../frontend
npm install
```

3. Na raiz do projeto, rode backend + frontend juntos:

```bash
cd ..
npm install
npm run dev
```

## Endpoints principais

- `GET /api/materials`
- `POST /api/materials`
- `PUT /api/materials/:id`
- `DELETE /api/materials/:id`
- `GET /api/budgets`
- `GET /api/budgets/:id`
- `POST /api/budgets`
- `PUT /api/budgets/:id`
- `PATCH /api/budgets/:id/status`
- `DELETE /api/budgets/:id`
# banco_materiais
# banco_materiais
