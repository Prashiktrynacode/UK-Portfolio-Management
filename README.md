# QuantVault - Portfolio Management App

<div align="center">
  <img src="docs/logo.png" alt="QuantVault Logo" width="200" />
  
  **A modern, full-stack portfolio management application with advanced analytics and What-If scenario analysis.**

  [![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/quantvault)
  [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
  
  [Live Demo](https://quantvault.vercel.app) · [Documentation](./DEPLOYMENT.md) · [Report Bug](https://github.com/yourusername/quantvault/issues)
</div>

---

## ✨ Features

### Dashboard Engine
- **Real-time KPIs**: Total Value, Sharpe Ratio, Beta, Max Drawdown
- **Performance Charts**: Portfolio growth vs S&P 500 benchmark
- **Allocation Views**: Sector and asset class breakdowns
- **Activity Feed**: Recent transactions and alerts

### What-If Analysis Sandbox
- **Scenario Builder**: Simulate adding/removing positions
- **Delta Metrics**: See projected impact on risk/return
- **Correlation Matrix**: Heatmap of asset correlations
- **Efficient Frontier**: Visual optimization guidance

### Data Onboarding
- **CSV Import**: Parse and map columns automatically
- **Manual Entry**: Form with financial validation
- **Broker Templates**: Pre-configured for Fidelity, Schwab, Robinhood

### Holdings Management
- **Advanced Table**: Sortable with sparklines
- **Tax Lot Tracking**: FIFO analysis for each position
- **Row Expansion**: Drill into position details

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), TypeScript |
| **Styling** | Tailwind CSS, Framer Motion |
| **Charts** | Recharts, Tremor |
| **State** | TanStack Query, Zustand |
| **Backend** | Fastify, TypeScript |
| **Database** | PostgreSQL, Prisma ORM |
| **Auth** | Supabase Auth |
| **Hosting** | Vercel (Frontend), Render (API) |

---

## 📁 Project Structure

```
quantvault/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities & API client
│   │   └── stores/             # Zustand stores
│   │
│   └── api/                    # Fastify Backend
│       ├── src/
│       │   ├── routes/         # API endpoints
│       │   ├── services/       # Business logic
│       │   └── middleware/     # Auth, rate limiting
│       └── prisma/             # Database schema
│
├── .env.example                # Environment template
├── DEPLOYMENT.md               # Deployment guide
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase/Neon account)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/quantvault.git
cd quantvault

# Install backend dependencies
cd apps/api
npm install

# Install frontend dependencies
cd ../web
npm install

# Set up environment variables
cd ../..
cp .env.example .env
# Edit .env with your values
```

### Database Setup

```bash
cd apps/api

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed with sample data
npm run db:seed
```

### Development

```bash
# Terminal 1: Start backend
cd apps/api
npm run dev

# Terminal 2: Start frontend
cd apps/web
npm run dev
```

Visit:
- Frontend: http://localhost:3000
- API Health: http://localhost:4000/health

---

## 📊 API Endpoints

### Portfolios
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/portfolios` | List all portfolios |
| GET | `/api/v1/portfolios/:id` | Get portfolio details |
| GET | `/api/v1/portfolios/:id/dashboard` | Get dashboard data |
| POST | `/api/v1/portfolios` | Create portfolio |
| PATCH | `/api/v1/portfolios/:id` | Update portfolio |
| DELETE | `/api/v1/portfolios/:id` | Delete portfolio |

### Positions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/positions` | List positions |
| POST | `/api/v1/positions` | Create position |
| GET | `/api/v1/positions/:id/tax-lots` | Get FIFO analysis |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analysis/simulate` | Run What-If simulation |
| GET | `/api/v1/analysis/correlation` | Get correlation matrix |
| GET | `/api/v1/analysis/risk` | Get risk analysis |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/import/parse-csv` | Parse CSV file |
| POST | `/api/v1/import/csv` | Import from CSV |
| POST | `/api/v1/import/manual` | Manual bulk entry |

---

## 🗄️ Database Schema

### Core Models

```prisma
model Portfolio {
  id          String     @id
  userId      String
  name        String
  accountType AccountType
  positions   Position[]
  snapshots   PortfolioSnapshot[]
}

model Position {
  id           String   @id
  portfolioId  String
  ticker       String
  quantity     Decimal
  avgCostBasis Decimal
  lots         TaxLot[]
  transactions Transaction[]
}

model Transaction {
  id         String   @id
  positionId String
  type       TransactionType
  quantity   Decimal
  price      Decimal
  executedAt DateTime
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `FRONTEND_URL` | Yes | Frontend URL for CORS |

See [.env.example](./.env.example) for full list.

---

## 🚢 Deployment

### One-Click Deploy

1. **Database**: Create free PostgreSQL at [Supabase](https://supabase.com)
2. **Backend**: Deploy to [Render](https://render.com) using `render.yaml`
3. **Frontend**: Deploy to [Vercel](https://vercel.com) with GitHub integration

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step guide.

### Push-to-Deploy

After initial setup, just push to `main`:

```bash
git push origin main
# Vercel auto-deploys frontend (~2 min)
# Render auto-deploys backend (~5 min)
```

---

## 📈 Calculations

### Sharpe Ratio
```
Sharpe = (Portfolio Return - Risk Free Rate) / Standard Deviation
```

### Beta
```
Beta = Covariance(Portfolio, Market) / Variance(Market)
```

### Correlation
```
Correlation(A,B) = Cov(A,B) / (σA × σB)
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- [Recharts](https://recharts.org/) for charts
- [Shadcn/ui](https://ui.shadcn.com/) for components
- [Supabase](https://supabase.com/) for authentication
- [Prisma](https://prisma.io/) for database ORM

---

<div align="center">
  <sub>Built with ❤️ for smarter investing</sub>
</div>
