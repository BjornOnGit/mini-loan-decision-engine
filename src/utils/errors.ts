import { CustomError } from "../middlewares/errorHandler"

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class NotFoundError extends CustomError {
  constructor(message = "Resource not found") {
    super(message, 404)
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message = "Unauthorized") {
    super(message, 401)
  }
}

export class ForbiddenError extends CustomError {
  constructor(message = "Forbidden") {
    super(message, 403)
  }
}
