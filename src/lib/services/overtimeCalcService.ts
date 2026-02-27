/**
 * Overtime Calculation Service — PP No. 35 Tahun 2021
 *
 * Upah Sejam = 1/173 × (Gaji Pokok + Tunjangan Tetap)
 *
 * Hari Kerja:
 *   Jam ke-1  → 1.5× upah sejam
 *   Jam ke-2+ → 2.0× upah sejam
 *
 * Hari Libur / Istirahat (5 hari kerja):
 *   Jam 1–8  → 2× | Jam 9 → 3× | Jam 10–12 → 4×
 *
 * Hari Libur / Istirahat (6 hari kerja):
 *   Jam 1–7  → 2× | Jam 8 → 3× | Jam 9–11  → 4×
 */

/** Work-day system type */
export type WorkDaySystem = 5 | 6;

/** Parameters for overtime calculation */
export interface OvertimeCalcParams {
    /** Monthly salary basis (gaji pokok + tunjangan tetap) */
    monthlySalary: number;
    /** Number of overtime hours (can be fractional, e.g. 2.5) */
    hours: number;
    /** Whether the overtime occurs on a holiday / rest day */
    isHoliday: boolean;
    /** 5-day or 6-day work-week system */
    workDaySystem?: WorkDaySystem;
}

/** Single-hour breakdown row */
export interface HourBreakdown {
    /** 1-indexed hour number */
    hourNumber: number;
    /** Multiplier applied to this hour */
    multiplier: number;
    /** Upah for this hour (multiplier × hourlyRate) */
    amount: number;
}

/** Full calculation result */
export interface OvertimeCalcResult {
    /** Base hourly rate (1/173 × monthlySalary) */
    hourlyRate: number;
    /** Per-hour breakdown */
    breakdown: HourBreakdown[];
    /** Total overtime pay */
    totalPay: number;
}

const DIVISOR = 173;

/** Get the hourly rate */
export function getHourlyRate(monthlySalary: number): number {
    if (monthlySalary <= 0) return 0;
    return monthlySalary / DIVISOR;
}

/**
 * Get multipliers for each full/partial hour.
 * Returns an array where index 0 = 1st hour, index 1 = 2nd hour, etc.
 */
export function getMultipliers(
    hours: number,
    isHoliday: boolean,
    workDaySystem: WorkDaySystem = 5
): number[] {
    const fullHours = Math.ceil(hours);
    const multipliers: number[] = [];

    for (let h = 1; h <= fullHours; h++) {
        if (!isHoliday) {
            // Hari Kerja Biasa
            multipliers.push(h === 1 ? 1.5 : 2);
        } else if (workDaySystem === 5) {
            // Hari Libur — 5 hari kerja
            if (h <= 8) multipliers.push(2);
            else if (h === 9) multipliers.push(3);
            else multipliers.push(4); // jam 10–12
        } else {
            // Hari Libur — 6 hari kerja
            if (h <= 7) multipliers.push(2);
            else if (h === 8) multipliers.push(3);
            else multipliers.push(4); // jam 9–11
        }
    }

    return multipliers;
}

/**
 * Calculate the full overtime pay with breakdown.
 */
export function calculateOvertimePay(params: OvertimeCalcParams): OvertimeCalcResult {
    const { monthlySalary, hours, isHoliday, workDaySystem = 5 } = params;

    if (hours <= 0 || monthlySalary <= 0) {
        return { hourlyRate: 0, breakdown: [], totalPay: 0 };
    }

    const hourlyRate = getHourlyRate(monthlySalary);
    const multipliers = getMultipliers(hours, isHoliday, workDaySystem);

    let totalPay = 0;
    const breakdown: HourBreakdown[] = [];

    for (let i = 0; i < multipliers.length; i++) {
        const isLastHour = i === multipliers.length - 1;
        const fraction = isLastHour ? hours - Math.floor(hours) : 0;
        // If fractional last hour, only pay for that fraction
        const effectiveHour = isLastHour && fraction > 0 ? fraction : 1;
        const amount = Math.round(multipliers[i] * hourlyRate * effectiveHour);

        breakdown.push({
            hourNumber: i + 1,
            multiplier: multipliers[i],
            amount,
        });

        totalPay += amount;
    }

    return {
        hourlyRate: Math.round(hourlyRate),
        breakdown,
        totalPay,
    };
}
