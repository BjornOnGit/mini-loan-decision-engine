import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import { prisma } from "./config/database"
// Import routes
import userRoutes from "./routes/userRoutes"
import loanRoutes from "./routes/loanRoutes"
// Import error handling middleware
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler"
// Import rate limiting middleware
import { apiLimiter } from "./middlewares/rateLimiter"

const app: express.Application = express()

// Apply rate limiting to all requests
app.use(apiLimiter)

// Security middleware
app.use(helmet())

// CORS middleware
app.use(cors())

// Logging middleware
app.use(morgan("combined"))

// Body parsing middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      status: "OK",
      message: "Mini Loan Decision Engine is running",
      database: "Connected",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      message: "Service unavailable",
      database: "Disconnected",
      timestamp: new Date().toISOString(),
    })
  }
})

// Mount routes
app.use("/users", userRoutes)
app.use("/loans", loanRoutes)

// 404 handler for undefined routes
app.use(notFoundHandler)

// Central error handler (must be last)
app.use(errorHandler)

export default app
