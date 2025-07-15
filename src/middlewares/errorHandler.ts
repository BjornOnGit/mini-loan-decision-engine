import type { Request, Response, NextFunction } from "express"
import { Prisma } from "@prisma/client" // Import Prisma from @prisma/client
import { ZodError } from "zod"

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
  details?: any // Add details property
}

export class CustomError extends Error implements AppError {
  public statusCode: number
  public isOperational: boolean
  public details?: any // Add details property

  constructor(message: string, statusCode = 500, isOperational = true, details?: any) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.details = details // Assign details

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  error: Error | AppError | ZodError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500
  let message = "Internal server error"
  let details: any = undefined

  // Log error for debugging
  console.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
  })

  // Handle different error types
  if (error instanceof CustomError) {
    statusCode = error.statusCode
    message = error.message
    details = error.details // Pass through details from CustomError
  } else if (error instanceof ZodError) {
    statusCode = 400
    message = "Invalid input data" // This is the message set by the validation middleware
    details = error.errors.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        statusCode = 409
        message = "Duplicate entry - resource already exists"
        details = {
          field: error.meta?.target,
          constraint: "unique_constraint",
        }
        break
      case "P2025":
        statusCode = 404
        message = "Resource not found"
        break
      case "P2003":
        statusCode = 400
        message = "Foreign key constraint failed"
        break
      default:
        statusCode = 500
        message = "Database error occurred"
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400
    message = "Invalid data provided"
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503
    message = "Database connection failed"
  } else if ((error as AppError).statusCode) {
    statusCode = (error as AppError).statusCode!
    message = error.message
    details = (error as AppError).details // Pass through details from generic AppError
  }

  // Send error response
  const errorResponse: any = {
    error: getErrorType(statusCode),
    message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  }

  if (details) {
    errorResponse.details = details
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = error.stack
  }

  res.status(statusCode).json(errorResponse)
}

const getErrorType = (statusCode: number): string => {
  switch (Math.floor(statusCode / 100)) {
    case 4:
      return "Client Error"
    case 5:
      return "Server Error"
    default:
      return "Error"
  }
}

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`Route ${req.method} ${req.originalUrl} not found`, 404)
  next(error)
}

// Async error wrapper to catch async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
