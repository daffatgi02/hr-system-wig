/**
 * PPh 21 TER Calculator Service
 * Berdasarkan PP 58/2023 & PMK 168/2023
 *
 * Logika kalkulasi murni — types & constants di-import dari @/lib/constants/pph21Constants
 */

import {
    type PtkpStatus,
    type TerCategory,
    type Pph21Input,
    type Pph21MonthlyResult,
    type Pph21DecemberResult,
    type Pph21CalculationResult,
    PTKP_VALUES,
    PTKP_TO_TER_CATEGORY,
    TER_TABLES,
    PROGRESSIVE_BRACKETS,
    BIAYA_JABATAN_RATE,
    BIAYA_JABATAN_MAX_ANNUAL,
} from "@/lib/constants/pph21Constants";

// Re-export types & helpers agar consumer lama tidak perlu diubah
export type { PtkpStatus, TerCategory, Pph21Input, Pph21MonthlyResult, Pph21DecemberResult, Pph21CalculationResult };
export { PTKP_LABELS, ALL_PTKP_STATUSES, MONTH_NAMES } from "@/lib/constants/pph21Constants";

// ─── Core Functions ──────────────────────────────────────────────────

/** Validasi status PTKP */
export function isValidPtkpStatus(status: string): status is PtkpStatus {
    return status in PTKP_VALUES;
}

/** Ambil kategori TER berdasarkan status PTKP */
export function getTerCategory(ptkpStatus: PtkpStatus): TerCategory {
    return PTKP_TO_TER_CATEGORY[ptkpStatus];
}

/** Ambil nilai PTKP setahun */
export function getPtkpAmount(ptkpStatus: PtkpStatus): number {
    return PTKP_VALUES[ptkpStatus];
}

/** Cari tarif TER berdasarkan penghasilan bruto bulanan */
export function findTerRate(grossMonthly: number, category: TerCategory): number {
    const table = TER_TABLES[category];
    const bracket = table.find((b) => grossMonthly <= b.maxIncome);
    return bracket?.rate ?? table[table.length - 1].rate;
}

/** Hitung PPh 21 bulanan (Jan–Nov) menggunakan TER */
export function calculateMonthlyPph21(input: Pph21Input): Pph21MonthlyResult {
    const { grossMonthlyIncome, ptkpStatus, month } = input;
    const terCategory = getTerCategory(ptkpStatus);
    const terRate = findTerRate(grossMonthlyIncome, terCategory);
    const pph21Monthly = Math.round(grossMonthlyIncome * terRate);

    return {
        grossMonthlyIncome,
        ptkpStatus,
        terCategory,
        terRate,
        terRatePercent: `${(terRate * 100).toFixed(2).replace(/\.?0+$/, "")}%`,
        pph21Monthly,
        month,
        isDecember: month === 12,
    };
}

/** Hitung PPh 21 menggunakan tarif progresif Pasal 17 */
function calculateProgressiveTax(pkp: number): {
    totalTax: number;
    breakdown: { bracket: string; rate: string; taxable: number; tax: number }[];
} {
    if (pkp <= 0) {
        return { totalTax: 0, breakdown: [] };
    }

    let remaining = pkp;
    let totalTax = 0;
    let prevMax = 0;
    const breakdown: { bracket: string; rate: string; taxable: number; tax: number }[] = [];

    for (const bracket of PROGRESSIVE_BRACKETS) {
        if (remaining <= 0) break;

        const bracketSize = bracket.maxPkp === Infinity
            ? remaining
            : bracket.maxPkp - prevMax;

        const taxable = Math.min(remaining, bracketSize);
        const tax = Math.round(taxable * bracket.rate);

        if (taxable > 0) {
            const lowerLabel = formatCurrency(prevMax + 1);
            const upperLabel = bracket.maxPkp === Infinity
                ? "∞"
                : formatCurrency(bracket.maxPkp);

            breakdown.push({
                bracket: `${lowerLabel} – ${upperLabel}`,
                rate: `${(bracket.rate * 100)}%`,
                taxable,
                tax,
            });
        }

        totalTax += tax;
        remaining -= taxable;
        prevMax = bracket.maxPkp;
    }

    return { totalTax, breakdown };
}

/** Hitung PPh 21 Desember (tarif progresif) */
export function calculateDecemberPph21(
    grossMonthlyIncome: number,
    ptkpStatus: PtkpStatus
): Pph21DecemberResult {
    const grossAnnualIncome = grossMonthlyIncome * 12;

    const biayaJabatan = Math.min(
        grossAnnualIncome * BIAYA_JABATAN_RATE,
        BIAYA_JABATAN_MAX_ANNUAL
    );

    const netAnnualIncome = grossAnnualIncome - biayaJabatan;
    const ptkpAmount = getPtkpAmount(ptkpStatus);
    const pkp = Math.max(netAnnualIncome - ptkpAmount, 0);

    const { totalTax: pph21Annual, breakdown } = calculateProgressiveTax(pkp);

    const terCategory = getTerCategory(ptkpStatus);
    const terRate = findTerRate(grossMonthlyIncome, terCategory);
    const pph21JanToNov = Math.round(grossMonthlyIncome * terRate) * 11;

    const pph21December = Math.max(pph21Annual - pph21JanToNov, 0);

    return {
        grossMonthlyIncome,
        ptkpStatus,
        grossAnnualIncome,
        biayaJabatan,
        netAnnualIncome,
        ptkpAmount,
        pkp,
        pph21Annual,
        pph21JanToNov,
        pph21December,
        progressiveBreakdown: breakdown,
    };
}

/** Hitung PPh 21 lengkap (bulanan + Desember + ringkasan setahun) */
export function calculatePph21(input: Pph21Input): Pph21CalculationResult {
    const monthly = calculateMonthlyPph21(input);
    const december = calculateDecemberPph21(input.grossMonthlyIncome, input.ptkpStatus);

    const totalPph21 = december.pph21Annual;
    const effectiveRate = december.grossAnnualIncome > 0
        ? ((totalPph21 / december.grossAnnualIncome) * 100).toFixed(2)
        : "0";

    return {
        monthly,
        december,
        annualSummary: {
            totalPph21,
            effectiveAnnualRate: `${effectiveRate}%`,
        },
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Format angka ke Rupiah */
function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
