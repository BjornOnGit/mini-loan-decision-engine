import type { Request, Response, NextFunction } from "express"
import { z, ZodError } from "zod"
import { CustomError } from "./errorHandler"

// Validation schemas
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    fullName: z.string().min(1, "Full name is required").max(100, "Full name too long"),
  }),
})

export const createKYCSchema = z.object({
  body: z.object({
    income: z.number().positive("Income must be a positive number"),
    employer: z.string().min(1, "Employer is required").max(100, "Employer name too long"),
  }),
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
})

export const createLoanSchema = z.object({
  body: z.object({
    userId: z.string().uuid("Invalid user ID format"),
    amount: z.number().positive("Amount must be a positive number").max(1000000, "Amount too large"),
    duration: z
      .number()
      .int("Duration must be an integer")
      .positive("Duration must be positive")
      .max(360, "Duration too long"),
  }),
})

export const getLoanSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid loan ID format"),
  }),
})

export const getUserLoansSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  query: z.object({
    page: z.preprocess(
      (val) => Number.parseInt(String(val), 10),
      z.number().int().positive("Page must be a positive integer").optional().default(1),
    ),
    limit: z.preprocess(
      (val) => Number.parseInt(String(val), 10),
      z.number().int().positive("Limit must be a positive integer").optional().default(10),
    ),
  }),
})

// Generic validation middleware factory
export const validate = (schema: z.ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }))

        // Throw a CustomError so the central error handler can catch it
        const validationError = new CustomError("Invalid input data", 400)
        ;(validationError as any).details = errorMessages // Attach details for consistent response
        next(validationError)
      } else {
        next(error)
      }
    }
  }
}
