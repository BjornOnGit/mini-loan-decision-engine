import request from "supertest"
import app from "../src/app"
import { prisma } from "../src/config/database"

// Mock Prisma
jest.mock("../src/config/database", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("Error Handler", () => {
  it("should handle 404 for undefined routes", async () => {
    const response = await request(app).get("/non-existent-route")

    expect(response.status).toBe(404)
    expect(response.body.error).toBe("Client Error")
    expect(response.body.message).toContain("Route GET /non-existent-route not found")
    expect(response.body.timestamp).toBeDefined()
    expect(response.body.path).toBe("/non-existent-route")
    expect(response.body.method).toBe("GET")
  })

  it("should handle validation errors", async () => {
    const response = await request(app).post("/users").send({
      email: "invalid-email",
      fullName: "",
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Client Error")
    expect(response.body.message).toBe("Invalid input data") // Updated to match the middleware's message
    expect(response.body.details).toBeDefined()
  })

  it("should handle internal server errors", async () => {
    // Mock a database error
    mockPrisma.user.create = jest.fn().mockRejectedValue(new Error("Database connection failed"))

    const response = await request(app).post("/users").send({
      email: "test@example.com",
      fullName: "Test User",
    })

    expect(response.status).toBe(500)
    expect(response.body.error).toBe("Server Error")
    expect(response.body.message).toBe("Internal server error")
  })
})
