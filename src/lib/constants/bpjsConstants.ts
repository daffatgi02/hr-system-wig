/**
 * BPJS Constants & Types
 *
 * Dasar hukum:
 * - BPJS Kesehatan: Perpres 64/2020 (PPU: 5% → 4% perusahaan + 1% karyawan)
 * - JHT: PP 46/2015 (5,7% → 3,7% perusahaan + 2% karyawan)
 * - JKK: PP 44/2015 (0,24%–1,74% sepenuhnya perusahaan)
 * - JKM: PP 44/2015 (0,3% sepenuhnya perusahaan)
 * - JP:  PP 45/2015 (3% → 2% perusahaan + 1% karyawan, cap upah)
 */

// ─── Types ───────────────────────────────────────────────────────────

/** Tingkat risiko lingkungan kerja untuk JKK */
export type JkkRiskLevel = 1 | 2 | 3 | 4 | 5;

/** Input kalkulasi BPJS */
export interface BpjsInput {
    grossMonthlyIncome: number;
    jkkRiskLevel: JkkRiskLevel;
}

/** Rincian iuran satu program (split perusahaan & karyawan) */
export interface ContributionSplit {
    company: number;
    employee: number;
    total: number;
}

/** Hasil kalkulasi BPJS Kesehatan */
export interface BpjsKesehatanResult {
    baseSalary: number;
    isCapped: boolean;
    rate: { company: number; employee: number; total: number };
    contribution: ContributionSplit;
}

/** Hasil kalkulasi satu program BPJS Ketenagakerjaan */
export interface BpjsTkProgramResult {
    programName: string;
    baseSalary: number;
    isCapped: boolean;
    rate: { company: number; employee: number; total: number };
    contribution: ContributionSplit;
}

/** Hasil kalkulasi seluruh BPJS Ketenagakerjaan */
export interface BpjsKetenagakerjaanResult {
    jht: BpjsTkProgramResult;
    jkk: BpjsTkProgramResult;
    jkm: BpjsTkProgramResult;
    jp: BpjsTkProgramResult;
    totalCompany: number;
    totalEmployee: number;
    totalAll: number;
}

/** Hasil kalkulasi gabungan semua BPJS */
export interface BpjsCalculationResult {
    grossMonthlyIncome: number;
    jkkRiskLevel: JkkRiskLevel;
    kesehatan: BpjsKesehatanResult;
    ketenagakerjaan: BpjsKetenagakerjaanResult;
    grandTotal: {
        company: number;
        employee: number;
        total: number;
    };
    takeHomePay: number;
}

// ─── Rate Constants ─────────────────────────────────────────────────

/** BPJS Kesehatan — Perpres 64/2020 */
export const BPJS_KES_RATE_COMPANY = 0.04;
export const BPJS_KES_RATE_EMPLOYEE = 0.01;
export const BPJS_KES_SALARY_CAP = 12_000_000;

/** JHT — PP 46/2015 */
export const JHT_RATE_COMPANY = 0.037;
export const JHT_RATE_EMPLOYEE = 0.02;

/** JKK — PP 44/2015, berdasarkan tingkat risiko */
export const JKK_RATES: Record<JkkRiskLevel, number> = {
    1: 0.0024,
    2: 0.0054,
    3: 0.0089,
    4: 0.0127,
    5: 0.0174,
};

/** JKM — PP 44/2015 */
export const JKM_RATE = 0.003;

/** JP — PP 45/2015, batas upah tertinggi 2025 */
export const JP_RATE_COMPANY = 0.02;
export const JP_RATE_EMPLOYEE = 0.01;
export const JP_SALARY_CAP = 10_547_400;

/** Label tingkat risiko JKK */
export const JKK_RISK_LABELS: Record<JkkRiskLevel, string> = {
    1: "Sangat Rendah (0,24%)",
    2: "Rendah (0,54%)",
    3: "Sedang (0,89%)",
    4: "Tinggi (1,27%)",
    5: "Sangat Tinggi (1,74%)",
};
