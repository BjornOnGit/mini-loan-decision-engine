import type { Request, Response } from "express"
import { createKYC, getKYCByUserId } from "../services/kycServices"
import { userExists } from "../services/userService"
import { asyncHandler } from "../middlewares/errorHandler"
import { NotFoundError, ConflictError } from "../utils/errors"

export const createKYCController = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = req.params
  const { income, employer } = req.body

  // Check if userId is provided
  if (!userId) {
    throw new NotFoundError("User ID is required in request parameters")
  }

  // Check if user exists
  const userExistsCheck = await userExists(userId)
  if (!userExistsCheck) {
    throw new NotFoundError("User with this ID does not exist")
  }

  // Check if KYC already exists for this user
  const existingKYC = await getKYCByUserId(userId)
  if (existingKYC) {
    throw new ConflictError("KYC information already submitted for this user")
  }

  // Create KYC
  const kyc = await createKYC({ userId, income, employer })

  res.status(201).json({
    success: true,
    message: "KYC information submitted successfully",
    data: {
      id: kyc.id,
      userId: kyc.userId,
      income: kyc.income,
      employer: kyc.employer,
      createdAt: kyc.createdAt,
    },
  })
})
