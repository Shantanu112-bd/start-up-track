export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
