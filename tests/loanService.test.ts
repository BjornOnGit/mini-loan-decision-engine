import { createLoan } from "../src/services/loanService"
import { prisma } from "../src/config/database"
import { evaluateLoanApplication } from "../src/services/decisionEngineService"

// Mock Prisma and decision engine
jest.mock("../src/config/database", () => ({
  prisma: {
    loanApplication: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock("../src/services/decisionEngineService")

const mockPrisma = (prisma as any);
const mockEvaluateLoanApplication = evaluateLoanApplication as jest.MockedFunction<typeof evaluateLoanApplication>

describe("LoanService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should create loan and apply approval decision", async () => {
    const mockLoan = {
      id: "loan1",
      userId: "user1",
      amount: 10000,
      duration: 12,
      status: "pending",
      reason: null,
      createdAt: new Date(),
    }

    const mockUpdatedLoan = {
      ...mockLoan,
      status: "approved",
      reason: "Loan approved. DTI ratio: 25.0%",
    };

    (mockPrisma.loanApplication.create as jest.Mock).mockResolvedValue(mockLoan);
    (mockPrisma.loanApplication.update as jest.Mock).mockResolvedValue(mockUpdatedLoan);
    mockEvaluateLoanApplication.mockResolvedValue({
      approved: true,
      status: "approved",
      reason: "Loan approved. DTI ratio: 25.0%",
    })

    const result = await createLoan({
      userId: "user1",
      amount: 10000,
      duration: 12,
    })

    expect(mockPrisma.loanApplication.create).toHaveBeenCalledWith({
      data: {
        userId: "user1",
        amount: 10000,
        duration: 12,
        status: "pending",
      },
    })

    expect(mockEvaluateLoanApplication).toHaveBeenCalledWith({
      userId: "user1",
      requestedAmount: 10000,
      duration: 12,
    })

    expect(mockPrisma.loanApplication.update).toHaveBeenCalledWith({
      where: { id: "loan1" },
      data: {
        status: "approved",
        reason: "Loan approved. DTI ratio: 25.0%",
      },
    })

    expect(result.status).toBe("approved")
    expect(result.reason).toBe("Loan approved. DTI ratio: 25.0%")
  })

  it("should create loan and apply rejection decision", async () => {
    const mockLoan = {
      id: "loan1",
      userId: "user1",
      amount: 10000,
      duration: 12,
      status: "pending",
      reason: null,
      createdAt: new Date(),
    }

    const mockUpdatedLoan = {
      ...mockLoan,
      status: "rejected",
      reason: "Income below minimum threshold of $50,000",
    };

    (mockPrisma.loanApplication.create as jest.Mock).mockResolvedValue(mockLoan);
    (mockPrisma.loanApplication.update as jest.Mock).mockResolvedValue(mockUpdatedLoan)
    mockEvaluateLoanApplication.mockResolvedValue({
      approved: false,
      status: "rejected",
      reason: "Income below minimum threshold of $50,000",
    })

    const result = await createLoan({
      userId: "user1",
      amount: 10000,
      duration: 12,
    })

    expect(result.status).toBe("rejected")
    expect(result.reason).toBe("Income below minimum threshold of $50,000")
  })
})
