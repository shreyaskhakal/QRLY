import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/types";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code: string = "BAD_REQUEST"): AppError {
    return new AppError(code, message, 400);
  }

  static unauthorized(message: string = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message: string = "Access denied"): AppError {
    return new AppError("FORBIDDEN", message, 403);
  }

  static notFound(message: string = "Resource not found"): AppError {
    return new AppError("NOT_FOUND", message, 404);
  }

  static printerOffline(
    message: string = "This printer is not accepting jobs right now. Please tell the shop."
  ): AppError {
    return new AppError("PRINTER_OFFLINE", message, 400);
  }

  static validationError(message: string): AppError {
    return new AppError("VALIDATION_ERROR", message, 422);
  }

  static orderExpired(message: string = "This order has expired. Please start over."): AppError {
    return new AppError("ORDER_EXPIRED", message, 410);
  }

  static amountMismatch(message: string = "Payment amount does not match order total"): AppError {
    return new AppError("AMOUNT_MISMATCH", message, 400);
  }

  static internal(message: string = "An unexpected error occurred"): AppError {
    return new AppError("INTERNAL_ERROR", message, 500);
  }
}

export function errorResponse(error: unknown): NextResponse<{ error: ApiError }> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "UNKNOWN_ERROR",
        message: "An unknown error occurred",
      },
    },
    { status: 500 }
  );
}

