import type { Request, Response } from "express"
import { createLoan, getLoanById } from "../services/loanService"
import { userExists } from "../services/userService"
import { asyncHandler } from "../middlewares/errorHandler"
import { NotFoundError } from "../utils/errors"
import { loanApplicationsTotal } from "../utils/metrics" // Import the metric

export const createLoanController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, amount, duration } = req.body

  // Check if user exists
  const userExistsCheck = await userExists(userId)
  if (!userExistsCheck) {
    throw new NotFoundError("User with this ID does not exist")
  }

  // Increment total loan applications counter
  loanApplicationsTotal.inc()

  // Create loan application (decision will be applied automatically)
  const loan = await createLoan({ userId, amount, duration })

  // Return appropriate status code based on decision
  const statusCode = loan.status === "approved" ? 201 : 200

  res.status(statusCode).json({
    success: true,
    message: `Loan application ${loan.status}`,
    data: {
      id: loan.id,
      userId: loan.userId,
      amount: loan.amount,
      duration: loan.duration,
      status: loan.status,
      reason: loan.reason,
      createdAt: loan.createdAt,
    },
  })
})

export const getLoanController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  // Check if id is provided
  if (!id) {
    throw new NotFoundError("Loan ID is required in request parameters")
  }

  // Get loan by ID
  const loan = await getLoanById(id)

  if (!loan) {
    throw new NotFoundError("Loan with this ID does not exist")
  }

  res.status(200).json({
    success: true,
    message: "Loan retrieved successfully",
    data: {
      id: loan.id,
      userId: loan.userId,
      amount: loan.amount,
      duration: loan.duration,
      status: loan.status,
      reason: loan.reason,
      createdAt: loan.createdAt,
      user: {
        id: loan.user.id,
        email: loan.user.email,
        fullName: loan.user.fullName,
        hasKYC: !!loan.user.kycInfo,
      },
    },
  })
})
