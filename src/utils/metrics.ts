import client from "prom-client"

// Create a Registry to register metrics
const register = new client.Registry()

// Enable the collection of default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register })

// Define a histogram for HTTP request durations
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Buckets for response time
})

// Define a counter for total loan applications
export const loanApplicationsTotal = new client.Counter({
  name: "loan_applications_total",
  help: "Total number of loan applications submitted",
})

// Define a counter for loan decisions (approved vs. rejected)
export const loanDecisionsTotal = new client.Counter({
  name: "loan_decisions_total",
  help: "Total number of loan decisions by status",
  labelNames: ["status"], // 'approved' or 'rejected'
})

// Register custom metrics
register.registerMetric(httpRequestDurationSeconds)
register.registerMetric(loanApplicationsTotal)
register.registerMetric(loanDecisionsTotal)

export { register }
