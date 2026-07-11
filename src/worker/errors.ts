export class AppError extends Error {
  readonly code: string;
  readonly title: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly referenceId: string;

  constructor(options: { code: string; title: string; message: string; status?: number; retryable?: boolean; cause?: unknown }) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options.code;
    this.title = options.title;
    this.status = options.status ?? 400;
    this.retryable = options.retryable ?? false;
    this.referenceId = crypto.randomUUID();
  }

  toPublic() {
    return { title: this.title, message: this.message, referenceId: this.referenceId, retryable: this.retryable };
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "INTERNAL_ERROR",
    title: "Interne fout",
    message: "De websitecontrole kon niet volledig worden uitgevoerd. Probeer het later opnieuw.",
    status: 500,
    retryable: true,
    cause: error,
  });
}
