import { NextResponse } from "next/server";
import {
    calculateAllBpjs,
    isValidJkkRiskLevel,
    type JkkRiskLevel,
} from "@/lib/services/bpjsService";

/**
 * POST /api/bpjs/calculate
 * Kalkulasi iuran BPJS Kesehatan & Ketenagakerjaan
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { grossMonthlyIncome, jkkRiskLevel } = body;

        // ── Validasi input ──
        if (typeof grossMonthlyIncome !== "number" || grossMonthlyIncome < 0) {
            return NextResponse.json(
                { error: "Gaji bruto bulanan harus berupa angka positif" },
                { status: 400 }
            );
        }

        const riskLevel = typeof jkkRiskLevel === "number" ? jkkRiskLevel : 1;
        if (!isValidJkkRiskLevel(riskLevel)) {
            return NextResponse.json(
                { error: "Tingkat risiko JKK harus 1–5" },
                { status: 400 }
            );
        }

        // ── Kalkulasi ──
        const result = calculateAllBpjs({
            grossMonthlyIncome,
            jkkRiskLevel: riskLevel as JkkRiskLevel,
        });

        return NextResponse.json(result);
    } catch {
        return NextResponse.json(
            { error: "Terjadi kesalahan saat menghitung BPJS" },
            { status: 500 }
        );
    }
}
