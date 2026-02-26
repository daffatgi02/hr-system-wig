import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmployeeByEmployeeId, updateEmployee } from "@/lib/services/employeeService";
import { checkSensitiveRateLimit } from "@/lib/middleware/rateLimit";
import { unauthorizedResponse, validateBody, serverErrorResponse } from "@/lib/middleware/apiGuard";
import { changePasswordSchema } from "@/lib/validations/validationSchemas";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
    const rateLimited = checkSensitiveRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const result = await validateBody(request, changePasswordSchema);
        if ("error" in result) return result.error;

        const { currentPassword, newPassword } = result.data;

        const employee = await getEmployeeByEmployeeId(session.employeeId);
        if (!employee) {
            return NextResponse.json(
                { error: "Data karyawan tidak ditemukan" },
                { status: 404 }
            );
        }

        const isValid = await bcrypt.compare(currentPassword, employee.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "Password saat ini salah" },
                { status: 401 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await updateEmployee(employee.id, { password: hashedPassword });

        return NextResponse.json({
            success: true,
            message: "Password berhasil diubah",
        });
    } catch (err) {
        return serverErrorResponse("ChangePassword", err);
    }
}
