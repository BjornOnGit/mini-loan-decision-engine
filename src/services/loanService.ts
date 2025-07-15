import { prisma } from "../config/database"
import { evaluateLoanApplication } from "./decisionEngineService"

export interface CreateLoanData {
  userId: string
  amount: number
  duration: number
}

export const createLoan = async (loanData: CreateLoanData) => {
  try {
    // First create the loan as pending
    const loan = await prisma.loanApplication.create({
      data: {
        userId: loanData.userId,
        amount: loanData.amount,
        duration: loanData.duration,
        status: "pending",
      },
    })

    // Immediately evaluate the loan application
    const decision = await evaluateLoanApplication({
      userId: loanData.userId,
      requestedAmount: loanData.amount,
      duration: loanData.duration,
    })

    // Update the loan with the decision
    const updatedLoan = await prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        status: decision.status,
        reason: decision.reason,
      },
    })

    return updatedLoan
  } catch (error) {
    throw error
  }
}

export const getLoanById = async (id: string) => {
  return await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          kycInfo: true,
        },
      },
    },
  })
}

export const getUserLoans = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit
  const [loans, totalCount] = await prisma.$transaction([
    prisma.loanApplication.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.loanApplication.count({
      where: { userId },
    }),
  ])

  return {
    loans,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  }
}
