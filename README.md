# Mini Loan Decision Engine

A robust backend service that mimics how micro-lending platforms evaluate user eligibility and approve/reject loan applications.

## Features

- **User Management**: Secure user registration and profile management.
- **KYC Submission**: Process Know Your Customer (KYC) information for users.
- **Loan Application Processing**: Handle loan applications with automatic eligibility checks.
- **Real-time Decisions**: Instant loan decisions with clear reasons based on defined business rules.
- **Loan History**: Retrieve paginated loan history for individual users.
- **Input Validation**: Robust validation for all API inputs using Zod.
- **Centralized Error Handling**: Consistent error responses for various error types (validation, not found, conflict, database errors).
- **Rate Limiting**: Protects API endpoints from abuse and ensures fair usage.
- **Loan Decision Caching**: Improves performance by caching loan decisions for frequently requested parameters.
- **Comprehensive API Documentation**: Interactive API documentation available via Swagger/OpenAPI.
- **Health Monitoring**: Exposes Prometheus metrics for application health and performance monitoring.

## Tech Stack

- **Backend**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (via Prisma ORM)
- **Validation**: Zod
- **Testing**: Jest (Unit & Integration Tests)
- **Caching**: In-memory cache (extendable to Redis)
- **API Docs**: Swagger UI Express, YAML.js
- **Monitoring**: `prom-client` (Prometheus metrics)
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Orchestration (Local Dev)**: Docker Compose

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- pnpm (or npm/yarn)
- Docker
- PostgreSQL database (e.g., a Neon instance or local PostgreSQL)

### Local Development

1. **Clone the repository:**

    ```bash
    git clone mini-loan-decision-engine
    cd mini-loan-decision-engine
    ```

2. **Install dependencies:**

    ```bash
    pnpm install
    ```

3. **Configure Environment Variables:**
    Create a `.env` file in the root directory based on `.env.example`.

    ```plaintext
    # Database
    DATABASE_URL="postgresql://username:password@localhost:5432/mini_loan_engine?schema=public"

    # Server
    PORT=3000
    NODE_ENV=development
    ```

    **Important**: Replace `DATABASE_URL` with your actual PostgreSQL connection string (e.g., from Neon).

4. **Generate Prisma Client & Push Schema:**

    ```bash
    pnpm run db:generate
    pnpm run db:push # This will create tables in your database
    ```

5. **Start the application:**

    ```bash
    pnpm run dev
    ```

    The application will be running on `http://localhost:3000`.

### Running with Docker Compose (Local Development)

If you want to run the application and a local PostgreSQL database using Docker Compose:

1. **Ensure Docker is running.**

2. **Update `docker-compose.yml`**: If you're using an external database like Neon, ensure your `docker-compose.yml` only includes the `app` service and points to your `DATABASE_URL` environment variable. If you want a local database, uncomment or add the `db` service.

3. **Build and run:**

    ```bash
    docker compose up --build
    ```

    The application will be available at `http://localhost:3000`.

### Running Tests

```bash
pnpm test
```

## API Endpoints

The API documentation is available via Swagger UI at `/api-docs`.

- **`POST /users`**: Register a new user.
- **`POST /users/:id/kyc`**: Submit KYC information for a user.
- **`GET /users/:id/loans`**: Get a user's paginated loan history.
- **`POST /loans`**: Submit a new loan application.
- **`GET /loans/:id`**: Get details of a specific loan application.
- **`GET /health`**: Health check endpoint.
- **`GET /metrics`**: Prometheus metrics endpoint.

## Deployment

This application is designed for containerized deployment. A `Dockerfile` is provided for building the Docker image.

### CI/CD with GitHub Actions

The `.github/workflows/ci.yml` workflow is configured to:

- Checkout code.
- Set up Node.js and pnpm.
- Install dependencies.
- Generate Prisma client.
- Build the application.
- Run tests.

This workflow ensures code quality and functionality before deployment.

### Deployment to Vercel

This application can be deployed to Vercel using its native Dockerfile support.

1. Connect your GitHub repository to Vercel.
2. Vercel will detect the `Dockerfile` and build your application.
3. Configure your `DATABASE_URL` (from Neon) as an environment variable in your Vercel project settings.
4. Vercel's built-in CI/CD will handle automatic deployments on pushes to your main branch.

## Health Monitoring

The application exposes Prometheus metrics at the `/metrics` endpoint. You can configure a Prometheus server to scrape these metrics and visualize them using Grafana for real-time monitoring of:

- HTTP request durations (`http_request_duration_seconds`)
- Total loan applications (`loan_applications_total`)
- Loan decisions by status (`loan_decisions_total`)
- Default Node.js process metrics (CPU, memory, event loop, etc.)
