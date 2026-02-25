/**
 * BPJS Kesehatan & Ketenagakerjaan Calculator Service
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
    baseSalary: number;         // Upah dasar perhitungan (setelah capping)
    isCapped: boolean;          // Apakah terkena capping
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
        company: number;     // Total beban perusahaan
        employee: number;    // Total potongan karyawan
        total: number;       // Grand total
    };
    takeHomePay: number;   // Gaji bruto - total potongan karyawan
}

// ─── Constants ───────────────────────────────────────────────────────

/** BPJS Kesehatan — Perpres 64/2020 */
const BPJS_KES_RATE_COMPANY = 0.04;
const BPJS_KES_RATE_EMPLOYEE = 0.01;
const BPJS_KES_SALARY_CAP = 12_000_000;

/** JHT — PP 46/2015 */
const JHT_RATE_COMPANY = 0.037;
const JHT_RATE_EMPLOYEE = 0.02;

/** JKK — PP 44/2015, berdasarkan tingkat risiko */
const JKK_RATES: Record<JkkRiskLevel, number> = {
    1: 0.0024,  // Sangat Rendah
    2: 0.0054,  // Rendah
    3: 0.0089,  // Sedang
    4: 0.0127,  // Tinggi
    5: 0.0174,  // Sangat Tinggi
};

/** JKM — PP 44/2015 */
const JKM_RATE = 0.003;

/** JP — PP 45/2015, batas upah tertinggi 2025 */
const JP_RATE_COMPANY = 0.02;
const JP_RATE_EMPLOYEE = 0.01;
const JP_SALARY_CAP = 10_547_400;

/** Label tingkat risiko JKK */
export const JKK_RISK_LABELS: Record<JkkRiskLevel, string> = {
    1: "Sangat Rendah (0,24%)",
    2: "Rendah (0,54%)",
    3: "Sedang (0,89%)",
    4: "Tinggi (1,27%)",
    5: "Sangat Tinggi (1,74%)",
};

// ─── Core Functions ──────────────────────────────────────────────────

/** Validasi tingkat risiko JKK */
export function isValidJkkRiskLevel(level: number): level is JkkRiskLevel {
    return [1, 2, 3, 4, 5].includes(level);
}

/** Hitung BPJS Kesehatan */
export function calculateBpjsKesehatan(grossMonthly: number): BpjsKesehatanResult {
    const isCapped = grossMonthly > BPJS_KES_SALARY_CAP;
    const baseSalary = Math.min(grossMonthly, BPJS_KES_SALARY_CAP);

    const company = Math.round(baseSalary * BPJS_KES_RATE_COMPANY);
    const employee = Math.round(baseSalary * BPJS_KES_RATE_EMPLOYEE);

    return {
        baseSalary,
        isCapped,
        rate: {
            company: BPJS_KES_RATE_COMPANY,
            employee: BPJS_KES_RATE_EMPLOYEE,
            total: BPJS_KES_RATE_COMPANY + BPJS_KES_RATE_EMPLOYEE,
        },
        contribution: { company, employee, total: company + employee },
    };
}

/** Hitung satu program BPJS Ketenagakerjaan */
function calculateProgram(
    programName: string,
    grossMonthly: number,
    rateCompany: number,
    rateEmployee: number,
    salaryCap?: number
): BpjsTkProgramResult {
    const isCapped = salaryCap ? grossMonthly > salaryCap : false;
    const baseSalary = salaryCap ? Math.min(grossMonthly, salaryCap) : grossMonthly;

    const company = Math.round(baseSalary * rateCompany);
    const employee = Math.round(baseSalary * rateEmployee);

    return {
        programName,
        baseSalary,
        isCapped,
        rate: {
            company: rateCompany,
            employee: rateEmployee,
            total: rateCompany + rateEmployee,
        },
        contribution: { company, employee, total: company + employee },
    };
}

/** Hitung seluruh BPJS Ketenagakerjaan */
export function calculateBpjsKetenagakerjaan(
    grossMonthly: number,
    jkkRiskLevel: JkkRiskLevel
): BpjsKetenagakerjaanResult {
    const jht = calculateProgram("Jaminan Hari Tua (JHT)", grossMonthly, JHT_RATE_COMPANY, JHT_RATE_EMPLOYEE);
    const jkk = calculateProgram("Jaminan Kecelakaan Kerja (JKK)", grossMonthly, JKK_RATES[jkkRiskLevel], 0);
    const jkm = calculateProgram("Jaminan Kematian (JKM)", grossMonthly, JKM_RATE, 0);
    const jp = calculateProgram("Jaminan Pensiun (JP)", grossMonthly, JP_RATE_COMPANY, JP_RATE_EMPLOYEE, JP_SALARY_CAP);

    const totalCompany = jht.contribution.company + jkk.contribution.company + jkm.contribution.company + jp.contribution.company;
    const totalEmployee = jht.contribution.employee + jp.contribution.employee;

    return {
        jht, jkk, jkm, jp,
        totalCompany,
        totalEmployee,
        totalAll: totalCompany + totalEmployee,
    };
}

/** Hitung semua BPJS (Kesehatan + Ketenagakerjaan) */
export function calculateAllBpjs(input: BpjsInput): BpjsCalculationResult {
    const { grossMonthlyIncome, jkkRiskLevel } = input;

    const kesehatan = calculateBpjsKesehatan(grossMonthlyIncome);
    const ketenagakerjaan = calculateBpjsKetenagakerjaan(grossMonthlyIncome, jkkRiskLevel);

    const grandCompany = kesehatan.contribution.company + ketenagakerjaan.totalCompany;
    const grandEmployee = kesehatan.contribution.employee + ketenagakerjaan.totalEmployee;
    const grandTotal = grandCompany + grandEmployee;

    return {
        grossMonthlyIncome,
        jkkRiskLevel,
        kesehatan,
        ketenagakerjaan,
        grandTotal: {
            company: grandCompany,
            employee: grandEmployee,
            total: grandTotal,
        },
        takeHomePay: grossMonthlyIncome - grandEmployee,
    };
}
