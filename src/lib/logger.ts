/**
 * Logger Terpusat — Winston
 *
 * Transport:
 * - Console: selalu aktif (development & production)
 * - File: hanya production (logs/error.log + logs/combined.log)
 */

import winston from "winston";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
    level: IS_PRODUCTION ? "info" : "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: "absensi-hris" },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                    return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
                })
            ),
        }),
    ],
});

// File transports hanya di production
if (IS_PRODUCTION) {
    logger.add(
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5_242_880, // 5MB
            maxFiles: 5,
        })
    );
    logger.add(
        new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 10_485_760, // 10MB
            maxFiles: 5,
        })
    );
}

export default logger;
