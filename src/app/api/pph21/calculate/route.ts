import { NextResponse } from "next/server";
import {
    calculatePph21,
    isValidPtkpStatus,
    type PtkpStatus,
} from "@/lib/services/pph21Service";

/**
 * POST /api/pph21/calculate
 * Kalkulasi PPh 21 menggunakan skema TER (PP 58/2023)
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { grossMonthlyIncome, ptkpStatus, month } = body;

        // ── Validasi input ──
        if (typeof grossMonthlyIncome !== "number" || grossMonthlyIncome < 0) {
            return NextResponse.json(
                { error: "Penghasilan bruto bulanan harus berupa angka positif" },
                { status: 400 }
            );
        }

        if (!ptkpStatus || !isValidPtkpStatus(ptkpStatus)) {
            return NextResponse.json(
                { error: "Status PTKP tidak valid. Gunakan: TK/0, TK/1, TK/2, TK/3, K/0, K/1, K/2, K/3" },
                { status: 400 }
            );
        }

        const taxMonth = typeof month === "number" && month >= 1 && month <= 12
            ? month
            : 1;

        // ── Kalkulasi ──
        const result = calculatePph21({
            grossMonthlyIncome,
            ptkpStatus: ptkpStatus as PtkpStatus,
            month: taxMonth,
        });

        return NextResponse.json(result);
    } catch {
        return NextResponse.json(
            { error: "Terjadi kesalahan saat menghitung PPh 21" },
            { status: 500 }
        );
    }
}
