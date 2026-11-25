import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends HttpError {
  constructor(public appointments: unknown[]) {
    super(409, "Nel periodo selezionato sono presenti appuntamenti già confermati.");
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function bookingCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `VC-${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")}`;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "sconosciuto";
  return request.headers.get("x-real-ip") || "sconosciuto";
}
