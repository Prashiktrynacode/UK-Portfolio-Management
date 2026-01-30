# QuantVault - Full-Stack Portfolio Management App

## Project Structure

```
quantvault/
├── apps/
│   ├── web/                          # Next.js Frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx              # Dashboard
│   │   │   │   ├── portfolio/page.tsx
│   │   │   │   ├── analysis/page.tsx
│   │   │   │   ├── sources/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── api/
│   │   │   │   └── auth/[...supabase]/route.ts
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                   # Shadcn/ui components
│   │   │   ├── dashboard/
│   │   │   │   ├── kpi-cards.tsx
│   │   │   │   ├── performance-chart.tsx
│   │   │   │   ├── allocation-chart.tsx
│   │   │   │   └── activity-feed.tsx
│   │   │   ├── portfolio/
│   │   │   │   ├── holdings-table.tsx
│   │   │   │   ├── sparkline.tsx
│   │   │   │   └── lot-expansion.tsx
│   │   │   ├── analysis/
│   │   │   │   ├── scenario-builder.tsx
│   │   │   │   ├── correlation-heatmap.tsx
│   │   │   │   └── efficient-frontier.tsx
│   │   │   ├── sources/
│   │   │   │   ├── csv-parser.tsx
│   │   │   │   ├── manual-entry-form.tsx
│   │   │   │   └── broker-connections.tsx
│   │   │   └── layout/
│   │   │       ├── sidebar.tsx
│   │   │       ├── header.tsx
│   │   │       └── main-layout.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts         # TanStack Query + Fetch wrapper
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   └── server.ts
│   │   │   ├── calculations/
│   │   │   │   ├── sharpe-ratio.ts
│   │   │   │   ├── beta.ts
│   │   │   │   ├── correlation.ts
│   │   │   │   └── portfolio-metrics.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── use-portfolio.ts
│   │   │   ├── use-analysis.ts
│   │   │   └── use-auth.ts
│   │   ├── stores/
│   │   │   ├── ui-store.ts           # Zustand for UI state
│   │   │   └── simulation-store.ts   # What-If sandbox state
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # Fastify Backend (Render)
│       ├── src/
│       │   ├── server.ts             # Fastify entry point
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── portfolio.ts
│       │   │   ├── positions.ts
│       │   │   ├── transactions.ts
│       │   │   ├── analysis.ts
│       │   │   └── import.ts
│       │   ├── services/
│       │   │   ├── portfolio-service.ts
│       │   │   ├── calculation-service.ts
│       │   │   ├── import-service.ts
│       │   │   └── market-data-service.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── rate-limit.ts
│       │   └── utils/
│       │       ├── csv-parser.ts
│       │       └── validators.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       ├── Dockerfile
│       ├── render.yaml
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared types & utilities
│       ├── types/
│       │   └── index.ts
│       └── package.json
│
├── .env.example
├── turbo.json                        # Turborepo config (optional)
└── README.md
```

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | React framework with SSR |
| Styling | Tailwind CSS + Shadcn/ui | Utility-first CSS |
| Charts | Tremor + Recharts | Data visualization |
| State | TanStack Query + Zustand | Server & client state |
| Backend | Fastify (TypeScript) | High-performance API |
| Database | PostgreSQL + Prisma | Relational DB with ORM |
| Auth | Supabase Auth | Authentication service |
| Frontend Hosting | Vercel | Edge deployment |
| Backend Hosting | Render | Container hosting |
| Database Hosting | Supabase/Neon | Free PostgreSQL |
