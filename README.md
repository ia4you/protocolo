# Protocolo

Quiz sobre protocolos en dinámicas D/s. Next.js 14 + Tailwind, PostgreSQL 16
(`protocolo-db`), desplegado con Dokploy en https://protocolo.turel.es
(auto-deploy al hacer push a `main`).

## Base de datos: migraciones y semilla (manual)

Las migraciones **no se ejecutan en el deploy**: se lanzan a mano cuando haga
falta. `protocolo-db` solo es accesible desde la red `dokploy-network`, así que
se ejecutan desde un contenedor Node conectado a ella, con las variables de
`.env.local`:

```bash
# Aplica las migraciones pendientes de db/migrations/ (idempotente)
docker run --rm --network dokploy-network -v "$PWD":/app -w /app node:20-alpine \
  node --env-file=.env.local scripts/migrate.mjs

# Carga/actualiza las preguntas de db/seed/questions.json (idempotente)
docker run --rm --network dokploy-network -v "$PWD":/app -w /app node:20-alpine \
  node --env-file=.env.local scripts/seed.mjs
```

Si se añade una migración nueva (`db/migrations/00X_*.sql`), hay que aplicarla
**antes** de hacer push del código que la necesita.

---

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
