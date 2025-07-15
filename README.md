# Mini Loan Decision Engine

A backend service that mimics how micro-lending platforms evaluate user eligibility and approve/reject loan applications.

## Features

- User registration and KYC submission
- Loan application processing
- Automatic eligibility checks using business rules
- Real-time decisions with reasons

## Tech Stack

- Backend: Node.js + TypeScript
- Framework: Express
- Database: PostgreSQL (via Prisma ORM)
- Optional: Redis + BullMQ for background processing

## Getting Started

```bash
pnpm add .
pnpm run dev
```

## API Endpoints

- `POST /users` - Create a new user
- `POST /users/:id/kyc` - Submit KYC info
- `POST /loans` - Submit loan application
- `GET /loans/:id` - Fetch loan status & decision
