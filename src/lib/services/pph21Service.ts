/**
 * PPh 21 TER Calculator Service
 * Berdasarkan PP 58/2023 & PMK 168/2023
 * Tarif Efektif Rata-rata (TER) untuk perhitungan PPh Pasal 21
 */

// ─── Types ───────────────────────────────────────────────────────────

/** Status PTKP (Penghasilan Tidak Kena Pajak) */
export type PtkpStatus =
    | "TK/0" | "TK/1" | "TK/2" | "TK/3"
    | "K/0" | "K/1" | "K/2" | "K/3";

/** Kategori TER berdasarkan PP 58/2023 */
export type TerCategory = "A" | "B" | "C";

/** Lapisan tarif TER */
interface TerBracket {
    readonly maxIncome: number; // Batas atas penghasilan bruto (Infinity untuk lapisan terakhir)
    readonly rate: number;      // Tarif efektif (dalam desimal, misal 0.02 = 2%)
}

/** Lapisan tarif progresif Pasal 17 */
interface ProgressiveBracket {
    readonly maxPkp: number;    // Batas atas PKP (Infinity untuk lapisan terakhir)
    readonly rate: number;      // Tarif pajak
}

/** Input kalkulasi PPh 21 */
export interface Pph21Input {
    grossMonthlyIncome: number; // Penghasilan bruto bulanan
    ptkpStatus: PtkpStatus;     // Status PTKP
    month: number;               // Masa pajak (1-12)
}

/** Hasil kalkulasi PPh 21 bulanan */
export interface Pph21MonthlyResult {
    grossMonthlyIncome: number;
    ptkpStatus: PtkpStatus;
    terCategory: TerCategory;
    terRate: number;            // Tarif TER (desimal)
    terRatePercent: string;     // Tarif TER tampilan (e.g. "2%")
    pph21Monthly: number;       // PPh 21 bulanan
    month: number;
    isDecember: boolean;
}

/** Hasil kalkulasi PPh 21 Desember */
export interface Pph21DecemberResult {
    grossMonthlyIncome: number;
    ptkpStatus: PtkpStatus;
    grossAnnualIncome: number;     // Penghasilan bruto setahun
    biayaJabatan: number;          // Biaya jabatan (5%, max 6jt/tahun)
    netAnnualIncome: number;       // Penghasilan neto setahun
    ptkpAmount: number;            // PTKP setahun
    pkp: number;                   // Penghasilan Kena Pajak
    pph21Annual: number;           // PPh 21 setahun (tarif progresif)
    pph21JanToNov: number;         // Total PPh 21 Jan–Nov (via TER)
    pph21December: number;         // PPh 21 Desember (selisih)
    progressiveBreakdown: {        // Rincian tarif progresif
        bracket: string;
        rate: string;
        taxable: number;
        tax: number;
    }[];
}

/** Hasil lengkap kalkulasi */
export interface Pph21CalculationResult {
    monthly: Pph21MonthlyResult;
    december: Pph21DecemberResult;
    annualSummary: {
        totalPph21: number;
        effectiveAnnualRate: string;
    };
}

// ─── Constants ───────────────────────────────────────────────────────

/** PTKP per tahun (PMK 101/PMK.010/2016) */
const PTKP_VALUES: Record<PtkpStatus, number> = {
    "TK/0": 54_000_000,
    "TK/1": 58_500_000,
    "TK/2": 63_000_000,
    "TK/3": 67_500_000,
    "K/0": 58_500_000,
    "K/1": 63_000_000,
    "K/2": 67_500_000,
    "K/3": 72_000_000,
};

/** Mapping PTKP → Kategori TER */
const PTKP_TO_TER_CATEGORY: Record<PtkpStatus, TerCategory> = {
    "TK/0": "A", "TK/1": "A", "K/0": "A",
    "TK/2": "B", "TK/3": "B", "K/1": "B", "K/2": "B",
    "K/3": "C",
};

/** Label deskripsi status PTKP */
export const PTKP_LABELS: Record<PtkpStatus, string> = {
    "TK/0": "Tidak Kawin, Tanpa Tanggungan",
    "TK/1": "Tidak Kawin, 1 Tanggungan",
    "TK/2": "Tidak Kawin, 2 Tanggungan",
    "TK/3": "Tidak Kawin, 3 Tanggungan",
    "K/0": "Kawin, Tanpa Tanggungan",
    "K/1": "Kawin, 1 Tanggungan",
    "K/2": "Kawin, 2 Tanggungan",
    "K/3": "Kawin, 3 Tanggungan",
};

// ─── TER Rate Tables (PP 58/2023 Lampiran) ───────────────────────────

/** Tarif TER Bulanan Kategori A — PTKP: TK/0, TK/1, K/0 */
const TER_CATEGORY_A: TerBracket[] = [
    { maxIncome: 5_400_000, rate: 0 },
    { maxIncome: 5_650_000, rate: 0.0025 },
    { maxIncome: 5_950_000, rate: 0.005 },
    { maxIncome: 6_300_000, rate: 0.0075 },
    { maxIncome: 6_750_000, rate: 0.01 },
    { maxIncome: 7_500_000, rate: 0.0125 },
    { maxIncome: 8_550_000, rate: 0.015 },
    { maxIncome: 9_650_000, rate: 0.0175 },
    { maxIncome: 10_050_000, rate: 0.02 },
    { maxIncome: 10_350_000, rate: 0.0225 },
    { maxIncome: 10_700_000, rate: 0.025 },
    { maxIncome: 11_250_000, rate: 0.0275 },
    { maxIncome: 12_000_000, rate: 0.03 },
    { maxIncome: 12_750_000, rate: 0.035 },
    { maxIncome: 13_500_000, rate: 0.04 },
    { maxIncome: 14_550_000, rate: 0.045 },
    { maxIncome: 15_650_000, rate: 0.05 },
    { maxIncome: 16_550_000, rate: 0.055 },
    { maxIncome: 17_500_000, rate: 0.06 },
    { maxIncome: 19_000_000, rate: 0.065 },
    { maxIncome: 20_600_000, rate: 0.07 },
    { maxIncome: 22_050_000, rate: 0.075 },
    { maxIncome: 23_350_000, rate: 0.08 },
    { maxIncome: 24_700_000, rate: 0.085 },
    { maxIncome: 26_200_000, rate: 0.09 },
    { maxIncome: 27_950_000, rate: 0.095 },
    { maxIncome: 29_850_000, rate: 0.10 },
    { maxIncome: 32_700_000, rate: 0.105 },
    { maxIncome: 35_800_000, rate: 0.11 },
    { maxIncome: 39_000_000, rate: 0.115 },
    { maxIncome: 42_400_000, rate: 0.12 },
    { maxIncome: 46_100_000, rate: 0.125 },
    { maxIncome: 50_000_000, rate: 0.13 },
    { maxIncome: 52_600_000, rate: 0.19 },
    { maxIncome: 55_500_000, rate: 0.20 },
    { maxIncome: 58_500_000, rate: 0.21 },
    { maxIncome: 62_000_000, rate: 0.22 },
    { maxIncome: 65_800_000, rate: 0.23 },
    { maxIncome: 70_000_000, rate: 0.24 },
    { maxIncome: 75_000_000, rate: 0.25 },
    { maxIncome: 81_000_000, rate: 0.26 },
    { maxIncome: 88_000_000, rate: 0.27 },
    { maxIncome: 96_000_000, rate: 0.28 },
    { maxIncome: 105_000_000, rate: 0.29 },
    { maxIncome: 116_000_000, rate: 0.30 },
    { maxIncome: 130_000_000, rate: 0.31 },
    { maxIncome: 150_000_000, rate: 0.32 },
    { maxIncome: 170_000_000, rate: 0.33 },
    { maxIncome: Infinity, rate: 0.34 },
];

/** Tarif TER Bulanan Kategori B — PTKP: TK/2, TK/3, K/1, K/2 */
const TER_CATEGORY_B: TerBracket[] = [
    { maxIncome: 6_200_000, rate: 0 },
    { maxIncome: 6_500_000, rate: 0.0025 },
    { maxIncome: 6_850_000, rate: 0.005 },
    { maxIncome: 7_300_000, rate: 0.0075 },
    { maxIncome: 9_200_000, rate: 0.01 },
    { maxIncome: 10_750_000, rate: 0.0125 },
    { maxIncome: 11_250_000, rate: 0.015 },
    { maxIncome: 11_600_000, rate: 0.0175 },
    { maxIncome: 12_600_000, rate: 0.02 },
    { maxIncome: 13_600_000, rate: 0.0225 },
    { maxIncome: 14_700_000, rate: 0.025 },
    { maxIncome: 15_650_000, rate: 0.0275 },
    { maxIncome: 17_000_000, rate: 0.03 },
    { maxIncome: 18_200_000, rate: 0.0325 },
    { maxIncome: 19_950_000, rate: 0.035 },
    { maxIncome: 21_800_000, rate: 0.0375 },
    { maxIncome: 24_300_000, rate: 0.04 },
    { maxIncome: 26_650_000, rate: 0.0425 },
    { maxIncome: 29_500_000, rate: 0.045 },
    { maxIncome: 32_700_000, rate: 0.0475 },
    { maxIncome: 36_500_000, rate: 0.05 },
    { maxIncome: 40_850_000, rate: 0.0525 },
    { maxIncome: 46_100_000, rate: 0.055 },
    { maxIncome: 52_650_000, rate: 0.0575 },
    { maxIncome: 60_900_000, rate: 0.06 },
    { maxIncome: 71_850_000, rate: 0.0625 },
    { maxIncome: 86_600_000, rate: 0.065 },
    { maxIncome: 107_850_000, rate: 0.0675 },
    { maxIncome: 139_750_000, rate: 0.07 },
    { maxIncome: 194_200_000, rate: 0.0725 },
    { maxIncome: 315_650_000, rate: 0.075 },
    { maxIncome: 402_000_000, rate: 0.255 },
    { maxIncome: 489_900_000, rate: 0.26 },
    { maxIncome: 579_800_000, rate: 0.27 },
    { maxIncome: 674_300_000, rate: 0.28 },
    { maxIncome: 776_300_000, rate: 0.29 },
    { maxIncome: 889_300_000, rate: 0.30 },
    { maxIncome: 1_018_000_000, rate: 0.31 },
    { maxIncome: 1_171_000_000, rate: 0.32 },
    { maxIncome: 1_405_000_000, rate: 0.33 },
    { maxIncome: Infinity, rate: 0.34 },
];

/** Tarif TER Bulanan Kategori C — PTKP: K/3 */
const TER_CATEGORY_C: TerBracket[] = [
    { maxIncome: 6_600_000, rate: 0 },
    { maxIncome: 6_950_000, rate: 0.0025 },
    { maxIncome: 7_350_000, rate: 0.005 },
    { maxIncome: 7_800_000, rate: 0.0075 },
    { maxIncome: 9_800_000, rate: 0.01 },
    { maxIncome: 11_500_000, rate: 0.0125 },
    { maxIncome: 12_050_000, rate: 0.015 },
    { maxIncome: 12_400_000, rate: 0.0175 },
    { maxIncome: 13_500_000, rate: 0.02 },
    { maxIncome: 14_500_000, rate: 0.0225 },
    { maxIncome: 15_750_000, rate: 0.025 },
    { maxIncome: 16_750_000, rate: 0.0275 },
    { maxIncome: 18_250_000, rate: 0.03 },
    { maxIncome: 19_500_000, rate: 0.0325 },
    { maxIncome: 21_350_000, rate: 0.035 },
    { maxIncome: 23_350_000, rate: 0.0375 },
    { maxIncome: 26_050_000, rate: 0.04 },
    { maxIncome: 28_550_000, rate: 0.0425 },
    { maxIncome: 31_600_000, rate: 0.045 },
    { maxIncome: 35_050_000, rate: 0.0475 },
    { maxIncome: 39_100_000, rate: 0.05 },
    { maxIncome: 43_800_000, rate: 0.0525 },
    { maxIncome: 49_450_000, rate: 0.055 },
    { maxIncome: 56_600_000, rate: 0.0575 },
    { maxIncome: 65_550_000, rate: 0.06 },
    { maxIncome: 77_300_000, rate: 0.0625 },
    { maxIncome: 93_300_000, rate: 0.065 },
    { maxIncome: 116_400_000, rate: 0.0675 },
    { maxIncome: 150_900_000, rate: 0.07 },
    { maxIncome: 209_450_000, rate: 0.0725 },
    { maxIncome: 340_650_000, rate: 0.075 },
    { maxIncome: 434_700_000, rate: 0.255 },
    { maxIncome: 529_700_000, rate: 0.26 },
    { maxIncome: 626_850_000, rate: 0.27 },
    { maxIncome: 728_950_000, rate: 0.28 },
    { maxIncome: 839_800_000, rate: 0.29 },
    { maxIncome: 962_800_000, rate: 0.30 },
    { maxIncome: 1_104_900_000, rate: 0.31 },
    { maxIncome: 1_272_750_000, rate: 0.32 },
    { maxIncome: 1_419_000_000, rate: 0.33 },
    { maxIncome: Infinity, rate: 0.34 },
];

/** Tabel tarif TER berdasarkan kategori */
const TER_TABLES: Record<TerCategory, TerBracket[]> = {
    A: TER_CATEGORY_A,
    B: TER_CATEGORY_B,
    C: TER_CATEGORY_C,
};

/** Tarif Progresif Pasal 17 ayat (1) huruf a UU PPh (untuk Desember) */
const PROGRESSIVE_BRACKETS: ProgressiveBracket[] = [
    { maxPkp: 60_000_000, rate: 0.05 },
    { maxPkp: 250_000_000, rate: 0.15 },
    { maxPkp: 500_000_000, rate: 0.25 },
    { maxPkp: 5_000_000_000, rate: 0.30 },
    { maxPkp: Infinity, rate: 0.35 },
];

/** Biaya jabatan: 5% dari bruto, max Rp500.000/bulan atau Rp6.000.000/tahun */
const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX_ANNUAL = 6_000_000;

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

    // Biaya jabatan: 5% dari bruto setahun, max 6jt
    const biayaJabatan = Math.min(
        grossAnnualIncome * BIAYA_JABATAN_RATE,
        BIAYA_JABATAN_MAX_ANNUAL
    );

    const netAnnualIncome = grossAnnualIncome - biayaJabatan;
    const ptkpAmount = getPtkpAmount(ptkpStatus);
    const pkp = Math.max(netAnnualIncome - ptkpAmount, 0);

    // Hitung PPh 21 setahun pakai tarif progresif
    const { totalTax: pph21Annual, breakdown } = calculateProgressiveTax(pkp);

    // Hitung total PPh 21 Jan–Nov via TER
    const terCategory = getTerCategory(ptkpStatus);
    const terRate = findTerRate(grossMonthlyIncome, terCategory);
    const pph21JanToNov = Math.round(grossMonthlyIncome * terRate) * 11;

    // PPh 21 Desember = selisih
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

/** Daftar semua status PTKP untuk dropdown */
export const ALL_PTKP_STATUSES: PtkpStatus[] = [
    "TK/0", "TK/1", "TK/2", "TK/3",
    "K/0", "K/1", "K/2", "K/3",
];

/** Nama bulan Indonesia */
export const MONTH_NAMES: string[] = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
