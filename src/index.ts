import app from "./app"
import { connectDatabase } from "./config/database"

const PORT = process.env.PORT || 3000

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase()

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Mini Loan Decision Engine running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
