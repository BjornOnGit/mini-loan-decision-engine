import { Router } from "express"
import { createLoanController, getLoanController } from "../controllers/loanController"
import { validate, createLoanSchema, getLoanSchema } from "../middlewares/validation"

const router: Router = Router()

// POST /loans - Submit loan application
router.post("/", validate(createLoanSchema), createLoanController)

// GET /loans/:id - Get loan status and decision
router.get("/:id", validate(getLoanSchema), getLoanController)

export default router
