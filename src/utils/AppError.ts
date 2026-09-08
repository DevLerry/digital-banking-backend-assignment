/**
 * An error WE raise deliberately, because a business rule was broken.
 *
 * The key idea: an AppError is *expected*. "Account already exists",
 * "KYC not verified", "insufficient funds" — these are normal outcomes of a
 * banking system, not crashes. They carry the HTTP status the client should
 * see, so the route doesn't have to decide.
 *
 * Anything that is NOT an AppError is a genuine bug, and gets treated very
 * differently by the error handler (logged loudly, details hidden from users).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = 'BAD_REQUEST',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(msg: string, details?: unknown) {
    return new AppError(msg, 400, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new AppError(msg, 401, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have access to this resource') {
    return new AppError(msg, 403, 'FORBIDDEN');
  }
  static notFound(msg = 'Resource not found') {
    return new AppError(msg, 404, 'NOT_FOUND');
  }
  static conflict(msg: string) {
    return new AppError(msg, 409, 'CONFLICT');
  }
}
