import request from "supertest"
import app from "../../src/app"
import { prisma } from "../../src/config/database"
import { evaluateLoanApplication } from "../../src/services/decisionEngineService"
import { v4 as uuidv4 } from "uuid"

// Define a type for the expected loan data in the response
interface LoanResponseData {
  id: string
  amount: number
  duration: number
  status: string
  reason: string | null
  createdAt: string // Date will be stringified
}

// Mock Prisma Client
jest.mock("../../src/config/database", () => {
  const mockPrismaUserCreate = jest.fn()
  const mockPrismaUserFindUnique = jest.fn()
  const mockPrismaKYCInfoCreate = jest.fn()
  const mockPrismaKYCInfoFindUnique = jest.fn()
  const mockPrismaLoanApplicationCreate = jest.fn()
  const mockPrismaLoanApplicationUpdate = jest.fn()
  const mockPrismaLoanApplicationFindUnique = jest.fn()
  const mockPrismaLoanApplicationFindMany = jest.fn()
  const mockPrismaLoanApplicationCount = jest.fn() // Add mock for count

  return {
    prisma: {
      user: {
        create: mockPrismaUserCreate,
        findUnique: mockPrismaUserFindUnique,
      },
      kYCInfo: {
        create: mockPrismaKYCInfoCreate,
        findUnique: mockPrismaKYCInfoFindUnique,
      },
      loanApplication: {
        create: mockPrismaLoanApplicationCreate,
        update: mockPrismaLoanApplicationUpdate,
        findUnique: mockPrismaLoanApplicationFindUnique,
        findMany: mockPrismaLoanApplicationFindMany,
        count: mockPrismaLoanApplicationCount, // Add to mock return
      },
      $queryRaw: jest.fn().mockResolvedValue([]), // Mock for health check
      $transaction: jest.fn((queries) => Promise.all(queries)), // Mock $transaction
    },
  }
})

// Mock DecisionEngineService
jest.mock("../../src/services/decisionEngineService")
const mockEvaluateLoanApplication = evaluateLoanApplication as jest.MockedFunction<typeof evaluateLoanApplication>

// Mock express-rate-limit to prevent actual rate limiting during tests
// This is crucial for tests to run without being blocked by the rate limiter.
jest.mock("express-rate-limit", () => ({
  __esModule: true, // This is important for default exports
  default: jest.fn(() => (req: any, res: any, next: any) => next()), // Mock the default export
  apiLimiter: jest.fn(() => (req: any, res: any, next: any) => next()), // Mock named export if used
  strictApiLimiter: jest.fn(() => (req: any, res: any, next: any) => next()), // Mock named export if used
}))

describe("API Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /users", () => {
    it("should create a new user successfully", async () => {
      const newUser = { email: "test@example.com", fullName: "Test User" }
      const createdUser = { id: uuidv4(), ...newUser, createdAt: new Date() }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null) // User does not exist
      ;(prisma.user.create as jest.Mock).mockResolvedValueOnce(createdUser)

      const response = await request(app).post("/users").send(newUser)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("User created successfully")
      expect(response.body.data.email).toBe(newUser.email)
      expect(prisma.user.create).toHaveBeenCalledWith({ data: newUser })
    })

    it("should return 409 if user with email already exists", async () => {
      const existingUser = {
        id: uuidv4(),
        email: "existing@example.com",
        fullName: "Existing User",
        createdAt: new Date(),
      }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser)

      const response = await request(app).post("/users").send(existingUser)

      expect(response.status).toBe(409)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("A user with this email already exists")
    })

    it("should return 400 for invalid user input", async () => {
      const response = await request(app).post("/users").send({ email: "invalid-email", fullName: "" })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.email", message: "Invalid email format" }),
          expect.objectContaining({ field: "body.fullName", message: "Full name is required" }),
        ]),
      )
    })
  })

  describe("POST /users/:id/kyc", () => {
    const userId = uuidv4()
    const kycData = { income: 60000, employer: "Acme Corp" }

    it("should submit KYC information successfully", async () => {
      const createdKYC = { id: uuidv4(), userId, ...kycData, createdAt: new Date() }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.kYCInfo.findUnique as jest.Mock).mockResolvedValueOnce(null) // KYC does not exist
      ;(prisma.kYCInfo.create as jest.Mock).mockResolvedValueOnce(createdKYC)

      const response = await request(app).post(`/users/${userId}/kyc`).send(kycData)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("KYC information submitted successfully")
      expect(response.body.data.userId).toBe(userId)
      expect(response.body.data.income).toBe(kycData.income)
      expect(prisma.kYCInfo.create).toHaveBeenCalledWith({ data: { userId, ...kycData } })
    })

    it("should return 404 if user does not exist", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null) // User does not exist

      const response = await request(app).post(`/users/${userId}/kyc`).send(kycData)

      expect(response.status).toBe(404)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("User with this ID does not exist")
    })

    it("should return 409 if KYC already exists for user", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.kYCInfo.findUnique as jest.Mock).mockResolvedValueOnce({
        id: uuidv4(),
        userId,
        ...kycData,
        createdAt: new Date(),
      }) // KYC exists

      const response = await request(app).post(`/users/${userId}/kyc`).send(kycData)

      expect(response.status).toBe(409)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("KYC information already submitted for this user")
    })

    it("should return 400 for invalid KYC input", async () => {
      const response = await request(app).post(`/users/${userId}/kyc`).send({ income: -100, employer: "" })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.income", message: "Income must be a positive number" }),
          expect.objectContaining({ field: "body.employer", message: "Employer is required" }),
        ]),
      )
    })

    it("should return 400 for invalid user ID format in params", async () => {
      const response = await request(app).post("/users/invalid-uuid/kyc").send(kycData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("params.id")
      expect(response.body.details[0].message).toBe("Invalid user ID format")
    })
  })

  describe("POST /loans", () => {
    const userId = uuidv4()
    const loanData = { userId, amount: 10000, duration: 12 }

    it("should create and approve a loan application", async () => {
      const loanId = uuidv4()
      const createdLoan = { id: loanId, ...loanData, status: "pending", reason: null, createdAt: new Date() }
      const approvedLoan = { ...createdLoan, status: "approved", reason: "Loan approved. DTI ratio: 10.0%" }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.loanApplication.create as jest.Mock).mockResolvedValueOnce(createdLoan)
      mockEvaluateLoanApplication.mockResolvedValueOnce({
        approved: true,
        status: "approved",
        reason: "Loan approved. DTI ratio: 10.0%",
      })
      ;(prisma.loanApplication.update as jest.Mock).mockResolvedValueOnce(approvedLoan)

      const response = await request(app).post("/loans").send(loanData)

      expect(response.status).toBe(201) // 201 for approved loans
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("Loan application approved")
      expect(response.body.data.status).toBe("approved")
      expect(response.body.data.reason).toBe("Loan approved. DTI ratio: 10.0%")
      expect(prisma.loanApplication.create).toHaveBeenCalledWith({
        data: { ...loanData, status: "pending" },
      })
      expect(mockEvaluateLoanApplication).toHaveBeenCalledWith({
        userId: loanData.userId,
        requestedAmount: loanData.amount,
        duration: loanData.duration,
      })
      expect(prisma.loanApplication.update).toHaveBeenCalledWith({
        where: { id: loanId },
        data: { status: "approved", reason: "Loan approved. DTI ratio: 10.0%" },
      })
    })

    it("should create and reject a loan application", async () => {
      const loanId = uuidv4()
      const createdLoan = { id: loanId, ...loanData, status: "pending", reason: null, createdAt: new Date() }
      const rejectedReason = "Income below minimum threshold of $50,000"
      const rejectedLoan = { ...createdLoan, status: "rejected", reason: rejectedReason }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.loanApplication.create as jest.Mock).mockResolvedValueOnce(createdLoan)
      mockEvaluateLoanApplication.mockResolvedValueOnce({
        approved: false,
        status: "rejected",
        reason: rejectedReason,
      })
      ;(prisma.loanApplication.update as jest.Mock).mockResolvedValueOnce(rejectedLoan)

      const response = await request(app).post("/loans").send(loanData)

      expect(response.status).toBe(200) // 200 for rejected loans
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("Loan application rejected")
      expect(response.body.data.status).toBe("rejected")
      expect(response.body.data.reason).toBe(rejectedReason)
    })

    it("should return 404 if user does not exist", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null) // User does not exist

      const response = await request(app).post("/loans").send(loanData)

      expect(response.status).toBe(404)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("User with this ID does not exist")
    })

    it("should return 400 for invalid loan input", async () => {
      const response = await request(app).post("/loans").send({ userId, amount: -100, duration: 0 })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.amount", message: "Amount must be a positive number" }),
          expect.objectContaining({ field: "body.duration", message: "Duration must be positive" }),
        ]),
      )
    })
  })

  describe("GET /loans/:id", () => {
    it("should return loan details when loan exists", async () => {
      const loanId = uuidv4()
      const userId = uuidv4()

      const mockLoan = {
        id: loanId,
        userId: userId,
        amount: 10000,
        duration: 12,
        status: "approved",
        reason: "Loan approved. DTI ratio: 25.0%",
        createdAt: new Date(),
        user: {
          id: userId,
          email: "test@example.com",
          fullName: "John Doe",
          createdAt: new Date(),
          kycInfo: {
            id: uuidv4(),
            userId: userId,
            income: 75000,
            employer: "Tech Corp",
            createdAt: new Date(),
          },
        },
      }
      ;(prisma.loanApplication.findUnique as jest.Mock).mockResolvedValueOnce(mockLoan)

      const response = await request(app).get(`/loans/${loanId}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(loanId)
      expect(response.body.data.status).toBe("approved")
      expect(response.body.data.reason).toBe("Loan approved. DTI ratio: 25.0%")
      expect(response.body.data.user.hasKYC).toBe(true)
    })

    it("should return 404 when loan does not exist", async () => {
      ;(prisma.loanApplication.findUnique as jest.Mock).mockResolvedValueOnce(null)
      const nonExistentLoanId = uuidv4()

      const response = await request(app).get(`/loans/${nonExistentLoanId}`)

      expect(response.status).toBe(404)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Loan with this ID does not exist")
    })

    it("should return 400 when loan ID is invalid format", async () => {
      const response = await request(app).get("/loans/invalid-uuid")

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("params.id")
      expect(response.body.details[0].message).toBe("Invalid loan ID format")
    })
  })

  describe("GET /users/:id/loans", () => {
    const userId = uuidv4()
    const mockLoans = [
      {
        id: uuidv4(),
        userId,
        amount: 10000,
        duration: 12,
        status: "approved",
        reason: "Approved",
        createdAt: new Date("2023-01-01T10:00:00Z"),
      },
      {
        id: uuidv4(),
        userId,
        amount: 5000,
        duration: 6,
        status: "rejected",
        reason: "Income too low",
        createdAt: new Date("2023-01-02T10:00:00Z"),
      },
      {
        id: uuidv4(),
        userId,
        amount: 20000,
        duration: 24,
        status: "approved",
        reason: "Approved",
        createdAt: new Date("2023-01-03T10:00:00Z"),
      },
      {
        id: uuidv4(),
        userId,
        amount: 15000,
        duration: 18,
        status: "pending",
        reason: null,
        createdAt: new Date("2023-01-04T10:00:00Z"),
      },
      {
        id: uuidv4(),
        userId,
        amount: 2500,
        duration: 3,
        status: "approved",
        reason: "Approved",
        createdAt: new Date("2023-01-05T10:00:00Z"),
      },
    ]

    it("should return user's loan history with default pagination (page 1, limit 10)", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.loanApplication.findMany as jest.Mock).mockResolvedValueOnce(mockLoans)
      ;(prisma.loanApplication.count as jest.Mock).mockResolvedValueOnce(mockLoans.length)

      const response = await request(app).get(`/users/${userId}/loans`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("User loan history retrieved successfully")
      expect(response.body.data).toHaveLength(mockLoans.length)
      expect(response.body.meta).toEqual({
        totalCount: mockLoans.length,
        currentPage: 1,
        limit: 10,
        totalPages: 1,
      })
      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      })
    })

    it("should return user's loan history with custom pagination (page 2, limit 2)", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.loanApplication.findMany as jest.Mock).mockResolvedValueOnce([mockLoans[2], mockLoans[1]]) // Loans for page 2
      ;(prisma.loanApplication.count as jest.Mock).mockResolvedValueOnce(mockLoans.length)

      const response = await request(app).get(`/users/${userId}/loans?page=2&limit=2`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      const responseData = response.body.data as LoanResponseData[] // Cast to expected type
      expect(responseData).toHaveLength(2)
      expect(responseData[0]?.id).toBe(mockLoans[2]!.id) // Assuming orderBy desc, so latest first
      expect(responseData[1]?.id).toBe(mockLoans[1]!.id)
      expect(response.body.meta).toEqual({
        totalCount: mockLoans.length,
        currentPage: 2,
        limit: 2,
        totalPages: Math.ceil(mockLoans.length / 2),
      })
      expect(prisma.loanApplication.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: 2, // (2-1) * 2
        take: 2,
      })
    })

    it("should return empty array if user exists but has no loans", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: userId }) // User exists
      ;(prisma.loanApplication.findMany as jest.Mock).mockResolvedValueOnce([]) // No loans
      ;(prisma.loanApplication.count as jest.Mock).mockResolvedValueOnce(0)

      const response = await request(app).get(`/users/${userId}/loans`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("User loan history retrieved successfully")
      expect(response.body.data).toHaveLength(0)
      expect(response.body.meta).toEqual({
        totalCount: 0,
        currentPage: 1,
        limit: 10,
        totalPages: 0,
      })
    })

    it("should return 404 if user does not exist", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null) // User does not exist

      const response = await request(app).get(`/users/${userId}/loans`)

      expect(response.status).toBe(404)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("User with this ID does not exist")
    })

    it("should return 400 for invalid user ID format in params", async () => {
      const response = await request(app).get("/users/invalid-uuid/loans")

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("params.id")
      expect(response.body.details[0].message).toBe("Invalid user ID format")
    })

    it("should return 400 for invalid page query parameter", async () => {
      const response = await request(app).get(`/users/${userId}/loans?page=abc`)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("query.page")
      expect(response.body.details[0].message).toBe("Expected number, received nan") // Zod's message for failed parseInt
    })

    it("should return 400 for non-positive page query parameter", async () => {
      const response = await request(app).get(`/users/${userId}/loans?page=0`)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("query.page")
      expect(response.body.details[0].message).toBe("Page must be a positive integer")
    })

    it("should return 400 for invalid limit query parameter", async () => {
      const response = await request(app).get(`/users/${userId}/loans?limit=xyz`)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.message).toBe("Invalid input data")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("query.limit")
      expect(response.body.details[0].message).toBe("Expected number, received nan")
    })

    it("should return 400 for non-positive limit query parameter", async () => {
      const response = await request(app).get(`/users/${userId}/loans?limit=0`)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("Client Error")
      expect(response.body.details).toBeDefined()
      expect(response.body.details[0].field).toBe("query.limit")
      expect(response.body.details[0].message).toBe("Limit must be a positive integer")
    })
  })

  describe("Health Check", () => {
    it("should return 200 OK when database is connected", async () => {
      // prisma.$queryRaw is mocked at the top of the file to resolve successfully
      const response = await request(app).get("/health")

      expect(response.status).toBe(200)
      expect(response.body.status).toBe("OK")
      expect(response.body.database).toBe("Connected")
    })

    it("should return 503 Service Unavailable when database connection fails", async () => {
      // Temporarily override the mock for this test
      const originalQueryRaw = prisma.$queryRaw
      ;(prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error("DB connection error"))

      const response = await request(app).get("/health")

      expect(response.status).toBe(503)
      expect(response.body.status).toBe("ERROR")
      expect(response.body.database).toBe("Disconnected")

      // Restore original mock
      ;(prisma.$queryRaw as jest.Mock).mockImplementation(originalQueryRaw)
    })
  })
})
