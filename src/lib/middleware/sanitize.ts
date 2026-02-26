/**
 * Strip HTML tags from a string to prevent XSS.
 */
export function sanitizeString(input: string): string {
    return input
        .replace(/<[^>]*>/g, "")
        .trim();
}

/**
 * Recursively sanitize all string values in an object.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj };
    for (const key of Object.keys(result)) {
        const value = result[key];
        if (typeof value === "string") {
            (result as Record<string, unknown>)[key] = sanitizeString(value);
        } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            (result as Record<string, unknown>)[key] = sanitizeObject(
                value as Record<string, unknown>
            );
        }
    }
    return result;
}
