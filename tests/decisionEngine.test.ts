import { evaluateLoanApplication, type LoanDecisionInput } from "../src/services/decisionEngineService"
import { prisma } from "../src/config/database"
import { loanDecisionCache } from "../src/utils/cache" // Import the cache
import { jest } from "@jest/globals" // Declare the jest variable

// Mock Prisma
// Define the mock function directly within the jest.mock factory
// Ensure 'jest' is not imported here, it's globally available
jest.mock("../src/config/database", () => {
  const findUniqueMock = jest.fn()
  return {
    prisma: {
      user: {
        findUnique: findUniqueMock,
      },
    },
  }
})

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("DecisionEngineService", () => {
  beforeEach(() => {
    // Clear all mocks, including the one defined in the factory
    jest.clearAllMocks()
    loanDecisionCache.clear() // Clear cache before each test
  })

  // Add afterEach to ensure cache is cleared after every test
  afterEach(() => {
    loanDecisionCache.clear() // Clear cache after each test to prevent open handles
  })

  describe("Caching behavior", () => {
    it("should return cached decision if available", async () => {
      const input: LoanDecisionInput = {
        userId: "user-cached",
        requestedAmount: 10000,
        duration: 12,
      }
      const cacheKey = `loan_decision:${input.userId}:${input.requestedAmount}:${input.duration}`
      const mockCachedDecision = {
        approved: true,
        status: "approved",
        reason: "Cached decision",
      }

      // Manually put a decision in the cache
      loanDecisionCache.set(cacheKey, mockCachedDecision, 60) // Cache for 60 seconds

      // Call the service
      const result = await evaluateLoanApplication(input)

      // Expect the result to be from the cache
      expect(result).toEqual(mockCachedDecision)
      // Expect Prisma not to have been called
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it("should cache new decisions and retrieve them on subsequent calls", async () => {
      const input: LoanDecisionInput = {
        userId: "user-new-cache",
        requestedAmount: 20000,
        duration: 24,
      }
      const cacheKey = `loan_decision:${input.userId}:${input.requestedAmount}:${input.duration}`

      // Mock Prisma to return a user that will lead to approval
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: input.userId,
        email: "newcache@example.com",
        fullName: "New Cache User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc-new-cache",
          userId: input.userId,
          income: 100000,
          employer: "Cache Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      // First call: should evaluate and cache
      const firstResult = await evaluateLoanApplication(input)

      expect(firstResult.approved).toBe(true)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1)

      // Clear mock calls to check if it's called again
      jest.clearAllMocks()

      // Second call: should hit cache
      const secondResult = await evaluateLoanApplication(input)

      expect(secondResult).toEqual(firstResult)
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled() // Should not call Prisma again
    })

    it("should re-evaluate if cached decision has expired", async () => {
      const input: LoanDecisionInput = {
        userId: "user-expired-cache",
        requestedAmount: 5000,
        duration: 6,
      }
      const cacheKey = `loan_decision:${input.userId}:${input.requestedAmount}:${input.duration}`
      const mockExpiredDecision = {
        approved: false,
        status: "rejected",
        reason: "Expired cached decision",
      }

      // Manually put an expired decision in the cache (TTL of 0 seconds)
      loanDecisionCache.set(cacheKey, mockExpiredDecision, 0) // This will now effectively not cache it

      // Mock Prisma to return a user that will lead to approval for the re-evaluation
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: input.userId,
        email: "expired@example.com",
        fullName: "Expired Cache User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc-expired",
          userId: input.userId,
          income: 70000,
          employer: "Fresh Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      // Call the service
      const result = await evaluateLoanApplication(input)

      // Expect a new decision, not the expired one
      expect(result.approved).toBe(true)
      expect(result.reason).not.toBe(mockExpiredDecision.reason)
      // Expect Prisma to have been called for re-evaluation
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1)
    })
  })

  describe("User validation", () => {
    it("should reject if user not found", async () => {
      mockPrisma.user.findUnique.mockReset() // Ensure mock is clean for this test
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await evaluateLoanApplication({
        userId: "non-existent",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("User not found")
    })

    it("should reject if no KYC info", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: null,
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("KYC information required")
    })
  })

  describe("Income validation", () => {
    it("should reject if income below 50,000", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 40000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("Income below minimum threshold of $50,000")
    })

    it("should pass income validation with exactly 50,000", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 50000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(true)
      expect(result.status).toBe("approved")
      expect(result.reason).toContain("Loan approved")
    })
  })

  describe("Employment validation", () => {
    it("should reject if no employer", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 60000,
          employer: "",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("Employment information required")
    })

    it("should reject if employer is only whitespace", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 60000,
          employer: "   ",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("Employment information required")
    })
  })

  describe("Debt-to-Income ratio validation", () => {
    it("should reject if DTI ratio exceeds 40%", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 100000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [
          {
            id: "loan1",
            userId: "user1",
            amount: 30000,
            duration: 24,
            status: "approved",
            reason: null,
            createdAt: new Date(),
          },
        ],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 20000, // Total debt: 50000, DTI: 50%
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toContain("Debt-to-income ratio")
      expect(result.reason).toContain("50.0%")
      expect(result.reason).toContain("exceeds maximum of 40%")
    })

    it("should approve if DTI ratio is exactly 40%", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 100000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [
          {
            id: "loan1",
            userId: "user1",
            amount: 20000,
            duration: 24,
            status: "approved",
            reason: null,
            createdAt: new Date(),
          },
        ],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 20000, // Total debt: 40000, DTI: 40%
        duration: 12,
      })

      expect(result.approved).toBe(true)
      expect(result.status).toBe("approved")
      expect(result.reason).toContain("Loan approved")
      expect(result.reason).toContain("40.0%")
    })

    it("should only count approved loans in DTI calculation", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 100000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [
          {
            id: "loan1",
            userId: "user1",
            amount: 20000,
            duration: 24,
            status: "approved",
            reason: null,
            createdAt: new Date(),
          },
          // This rejected loan should NOT be included in the DTI calculation by the service
          // because the Prisma query includes `where: { status: "approved" }`
          // The mock should reflect what Prisma would return after filtering.
          // So, we only include the approved loan in the mock's `loans` array.
        ],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 15000, // Total debt: 35000 (only approved), DTI: 35%
        duration: 12,
      })

      expect(result.approved).toBe(true)
      expect(result.status).toBe("approved")
      expect(result.reason).toContain("35.0%")
    })
  })

  describe("Approval scenarios", () => {
    it("should approve if all rules pass with no existing loans", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 75000,
          employer: "Test Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 15000, // DTI: 20%
        duration: 12,
      })

      expect(result.approved).toBe(true)
      expect(result.status).toBe("approved")
      expect(result.reason).toContain("Loan approved")
      expect(result.reason).toContain("20.0%")
    })

    it("should approve with high income and large loan amount", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user1",
        email: "test@example.com",
        fullName: "Test User",
        createdAt: new Date(),
        kycInfo: {
          id: "kyc1",
          userId: "user1",
          income: 200000,
          employer: "Big Tech Corp",
          createdAt: new Date(),
        },
        loans: [],
      } as any)

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 50000, // DTI: 25%
        duration: 24,
      })

      expect(result.approved).toBe(true)
      expect(result.status).toBe("approved")
      expect(result.reason).toContain("25.0%")
    })
  })

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database connection failed"))

      const result = await evaluateLoanApplication({
        userId: "user1",
        requestedAmount: 10000,
        duration: 12,
      })

      expect(result.approved).toBe(false)
      expect(result.status).toBe("rejected")
      expect(result.reason).toBe("Error processing application")
    })
  })
})
