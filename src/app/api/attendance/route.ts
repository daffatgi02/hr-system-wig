import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
    getAttendanceRecords,
    getAttendanceByDate,
    createAttendance,
    updateAttendance,
} from "@/lib/services/attendanceService";
import { prisma } from "@/lib/prisma";
import { calculateDistance } from "@/lib/utils";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (session.role === "hr") {
        const records = await getAttendanceRecords(employeeId || undefined);
        return NextResponse.json(records);
    }

    const records = await getAttendanceRecords(session.employeeId);
    return NextResponse.json(records);
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const today = new Date().toISOString().split("T")[0];

        // Fetch employee settings
        const employee = await prisma.employee.findUnique({
            where: { employeeId: session.employeeId },
            include: { locations: true }
        }) as any;

        if (!employee) {
            return NextResponse.json({ error: "Data karyawan tidak ditemukan" }, { status: 404 });
        }

        // Location verification logic
        if (!employee.bypassLocation) {
            if (!body.location || typeof body.location.lat !== "number" || typeof body.location.lng !== "number") {
                return NextResponse.json({ error: "Akses lokasi diperlukan untuk absensi" }, { status: 400 });
            }

            if (employee.locations.length === 0) {
                return NextResponse.json({ error: "Lokasi absensi Anda belum diatur oleh HR" }, { status: 403 });
            }

            const isWithinRange = employee.locations.some((loc: any) => {
                const dist = calculateDistance(
                    body.location.lat,
                    body.location.lng,
                    loc.latitude,
                    loc.longitude
                );
                return dist <= loc.radius;
            });

            if (!isWithinRange) {
                return NextResponse.json(
                    { error: "Anda berada di luar radius lokasi absensi yang diizinkan" },
                    { status: 403 }
                );
            }
        }

        const existing = await getAttendanceByDate(session.employeeId, today);

        if (existing) {
            if (existing.clockOut) {
                return NextResponse.json(
                    { error: "Anda sudah melakukan clock-in dan clock-out hari ini" },
                    { status: 400 }
                );
            }

            const updated = await updateAttendance(existing.id, {
                clockOut: new Date().toISOString(),
                clockOutLocation: body.location,
                clockOutPhoto: body.photo,
            });

            return NextResponse.json(updated);
        }

        const now = new Date();

        // Validate work day
        const workDays = (employee as Record<string, unknown>).workDays as number[] | null;
        if (workDays && workDays.length > 0) {
            const todayDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
            if (!workDays.includes(todayDay)) {
                return NextResponse.json(
                    { error: "Hari ini bukan hari kerja Anda" },
                    { status: 400 }
                );
            }
        }

        // Determine attendance status using shift tolerance
        let status: "present" | "late" = "present";

        // Fetch the employee's shift, or fall back to the default shift
        let shift = null;
        if (employee.shiftId) {
            shift = await prisma.workShift.findUnique({ where: { id: employee.shiftId } });
        }
        if (!shift) {
            shift = await prisma.workShift.findFirst({ where: { isDefault: true } });
        }

        if (shift) {
            const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
            const shiftStartMinutes = shiftHour * 60 + shiftMin;
            const tolerance = shift.lateCheckIn ?? 0;
            const deadlineMinutes = shiftStartMinutes + tolerance;

            const clockInMinutes = now.getHours() * 60 + now.getMinutes();
            if (clockInMinutes > deadlineMinutes) {
                status = "late";
            }
        } else {
            // Fallback: no shift configured, use legacy logic
            if (now.getHours() > 9) {
                status = "late";
            }
        }

        const record = await createAttendance({
            employeeId: session.employeeId,
            date: today,
            clockIn: now.toISOString(),
            clockInLocation: body.location,
            clockInPhoto: body.photo,
            status,
        });

        return NextResponse.json(record);
    } catch (err) {
        console.error("[API POST Attendance Error]:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
