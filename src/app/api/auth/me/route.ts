import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmployeeById } from "@/lib/services/employeeService";
import { checkApiRateLimit } from "@/lib/middleware/rateLimit";
import { unauthorizedResponse } from "@/lib/middleware/apiGuard";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const employee = await getEmployeeById(session.id);
    if (!employee) {
        return NextResponse.json(
            { error: "Data pengguna tidak ditemukan" },
            { status: 404 }
        );
    }

    const { password: _pw, faceDescriptor: _fd, ...safeEmployee } = employee;
    return NextResponse.json(safeEmployee);
}
