import { NextResponse } from "next/server";

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Cleanup expired entries every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

/**
 * Extract client IP from request headers.
 * Falls back to "unknown" if not available.
 */
function getClientIp(headers: Headers): string {
    return (
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        "unknown"
    );
}

/**
 * Create a rate limiter with specific limits.
 * Returns `null` if allowed, or a NextResponse 429 if rate-limited.
 */
export function checkRateLimit(
    headers: Headers,
    prefix: string,
    maxRequests: number,
    windowMs: number
): NextResponse | null {
    const ip = getClientIp(headers);
    const key = `${prefix}:${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return null;
    }

    entry.count++;

    if (entry.count > maxRequests) {
        const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
        return NextResponse.json(
            {
                error: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
                retryAfter: retryAfterSeconds,
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfterSeconds),
                    "X-RateLimit-Limit": String(maxRequests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": String(entry.resetTime),
                },
            }
        );
    }

    return null;
}

/* ───────────────────── Presets ───────────────────── */

/** Login: 5 requests per 60 seconds */
export function checkLoginRateLimit(headers: Headers): NextResponse | null {
    return checkRateLimit(headers, "login", 5, 60_000);
}

/** General API: 30 requests per 60 seconds */
export function checkApiRateLimit(headers: Headers): NextResponse | null {
    return checkRateLimit(headers, "api", 30, 60_000);
}

/** Sensitive actions (password change, etc.): 10 requests per 60 seconds */
export function checkSensitiveRateLimit(headers: Headers): NextResponse | null {
    return checkRateLimit(headers, "sensitive", 10, 60_000);
}
