/**
 * BPJS Kesehatan & Ketenagakerjaan Calculator Service
 *
 * Logika kalkulasi murni — types & constants di-import dari @/lib/constants/bpjsConstants
 */

import {
    type JkkRiskLevel,
    type BpjsInput,
    type BpjsKesehatanResult,
    type BpjsTkProgramResult,
    type BpjsKetenagakerjaanResult,
    type BpjsCalculationResult,
    BPJS_KES_RATE_COMPANY,
    BPJS_KES_RATE_EMPLOYEE,
    BPJS_KES_SALARY_CAP,
    JHT_RATE_COMPANY,
    JHT_RATE_EMPLOYEE,
    JKK_RATES,
    JKM_RATE,
    JP_RATE_COMPANY,
    JP_RATE_EMPLOYEE,
    JP_SALARY_CAP,
} from "@/lib/constants/bpjsConstants";

// Re-export types & helpers agar consumer lama tidak perlu diubah
export type { JkkRiskLevel, BpjsInput, BpjsKesehatanResult, BpjsTkProgramResult, BpjsKetenagakerjaanResult, BpjsCalculationResult };
export { JKK_RISK_LABELS } from "@/lib/constants/bpjsConstants";

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
