import type { Request, Response } from "express"
import { createUser, getUserByEmail, userExists } from "../services/userService"
import { getUserLoans } from "../services/loanService"
import { asyncHandler } from "../middlewares/errorHandler"
import { ConflictError, NotFoundError } from "../utils/errors"
import type { LoanApplication } from "@prisma/client" // Import LoanApplication type

export const createUserController = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullName } = req.body

  // Check if user already exists
  const existingUser = await getUserByEmail(email)
  if (existingUser) {
    throw new ConflictError("A user with this email already exists")
  }

  // Create new user
  const user = await createUser({ email, fullName })

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
    },
  })
})

export const getUserLoansController = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = req.params
  // Safely extract and convert query parameters to numbers with defaults
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 10

  // Check if userId is provided
  if (!userId) {
    throw new NotFoundError("User ID is required in request parameters")
  }

  // Check if user exists
  const userExistsCheck = await userExists(userId)
  if (!userExistsCheck) {
    throw new NotFoundError("User with this ID does not exist")
  }

  // Get user's loan applications with pagination
  const {
    loans,
    totalCount,
    page: currentPage,
    limit: currentLimit,
    totalPages,
  } = await getUserLoans(
    userId,
    page, // Pass directly, no need for Number() cast
    limit, // Pass directly, no need for Number() cast
  )

  res.status(200).json({
    success: true,
    message: "User loan history retrieved successfully",
    data: loans.map((loan: LoanApplication) => ({
      // Explicitly type 'loan'
      id: loan.id,
      amount: loan.amount,
      duration: loan.duration,
      status: loan.status,
      reason: loan.reason,
      createdAt: loan.createdAt,
    })),
    meta: {
      totalCount,
      currentPage,
      limit: currentLimit,
      totalPages,
    },
  })
})
