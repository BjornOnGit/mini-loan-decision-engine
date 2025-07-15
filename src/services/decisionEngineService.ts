import { prisma } from "../config/database"
import { loanDecisionCache } from "../utils/cache" // Import the cache utility
import type { LoanApplication } from "@prisma/client" // Import LoanApplication type
import { loanDecisionsTotal } from "../utils/metrics" // Import the metric

export interface LoanDecisionInput {
  userId: string
  requestedAmount: number
  duration: number
}

export interface LoanDecision {
  approved: boolean
  status: "approved" | "rejected"
  reason: string
}

export const evaluateLoanApplication = async (input: LoanDecisionInput): Promise<LoanDecision> => {
  const cacheKey = `loan_decision:${input.userId}:${input.requestedAmount}:${input.duration}`

  // 1. Check cache first
  const cachedDecision = loanDecisionCache.get<LoanDecision>(cacheKey)
  if (cachedDecision) {
    console.log(`Cache hit for loan decision: ${cacheKey}`)
    return cachedDecision
  }

  try {
    // Get user with KYC info and existing loans
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: {
        kycInfo: true,
        loans: {
          where: {
            status: "approved", // Only count approved loans for DTI calculation
          },
        },
      },
    })

    if (!user) {
      const decision = {
        approved: false,
        status: "rejected",
        reason: "User not found",
      } as LoanDecision
      loanDecisionCache.set(cacheKey, decision, 60) // Cache rejection for a short period
      loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
      return decision
    }

    // Rule 1: Check if KYC info exists
    if (!user.kycInfo) {
      const decision = {
        approved: false,
        status: "rejected",
        reason: "KYC information required",
      } as LoanDecision
      loanDecisionCache.set(cacheKey, decision, 60)
      loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
      return decision
    }

    // Rule 2: Reject if income < 50,000
    if (user.kycInfo.income < 50000) {
      const decision = {
        approved: false,
        status: "rejected",
        reason: "Income below minimum threshold of $50,000",
      } as LoanDecision
      loanDecisionCache.set(cacheKey, decision, 60)
      loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
      return decision
    }

    // Rule 3: Reject if no employer
    if (!user.kycInfo.employer || user.kycInfo.employer.trim() === "") {
      const decision = {
        approved: false,
        status: "rejected",
        reason: "Employment information required",
      } as LoanDecision
      loanDecisionCache.set(cacheKey, decision, 60)
      loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
      return decision
    }

    // Rule 4: Calculate debt-to-income ratio
    // Sum of all existing approved loan amounts + new requested amount
    const existingLoanTotal = user.loans.reduce((sum: number, loan: LoanApplication) => sum + loan.amount, 0) // Explicitly type 'sum' and 'loan'
    const totalDebt = existingLoanTotal + input.requestedAmount
    const debtToIncomeRatio = totalDebt / user.kycInfo.income

    if (debtToIncomeRatio > 0.4) {
      const decision = {
        approved: false,
        status: "rejected",
        reason: `Debt-to-income ratio (${(debtToIncomeRatio * 100).toFixed(1)}%) exceeds maximum of 40%`,
      } as LoanDecision
      loanDecisionCache.set(cacheKey, decision, 60)
      loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
      return decision
    }

    // All rules passed - approve the loan
    const decision = {
      approved: true,
      status: "approved",
      reason: `Loan approved. DTI ratio: ${(debtToIncomeRatio * 100).toFixed(1)}%`,
    } as LoanDecision
    loanDecisionCache.set(cacheKey, decision, 300) // Cache approval for longer
    loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
    return decision
  } catch (error) {
    console.error("Error evaluating loan application:", error)
    const decision = {
      approved: false,
      status: "rejected",
      reason: "Error processing application",
    } as LoanDecision
    loanDecisionCache.set(cacheKey, decision, 10) // Cache error for a very short period
    loanDecisionsTotal.inc({ status: decision.status }) // Increment metric
    return decision
  }
}
