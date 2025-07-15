import { Router } from "express"
import { createUserController, getUserLoansController } from "../controllers/userController"
import { createKYCController } from "../controllers/kycController"
import { validate, createUserSchema, createKYCSchema, getUserLoansSchema } from "../middlewares/validation"

const router: Router = Router()

// POST /users - Create a new user
router.post("/", validate(createUserSchema), createUserController)

// POST /users/:id/kyc - Submit KYC info
router.post("/:id/kyc", validate(createKYCSchema), createKYCController)

// GET /users/:id/loans - Get user's loan history
router.get("/:id/loans", validate(getUserLoansSchema), getUserLoansController)

export default router
