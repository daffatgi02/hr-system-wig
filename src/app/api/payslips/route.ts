import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/middleware/apiGuard";
import { checkApiRateLimit } from "@/lib/middleware/rateLimit";
import { getPayslips, createPayslip } from "@/lib/services/payslipService";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await requireAuth();
    if (!session) return unauthorizedResponse();

    try {
        if (session.role === "hr") {
            const payslips = await getPayslips();
            return NextResponse.json(payslips);
        }

        const payslips = await getPayslips(session.employeeId);
        return NextResponse.json(payslips);
    } catch (err) {
        return serverErrorResponse("PayslipsGET", err);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await requireAuth();
    if (!session) return unauthorizedResponse();
    if (session.role !== "hr") return forbiddenResponse();

    try {
        // Zod validation skipped here as the body format for payslips can be complex (nested components)
        // But we still apply rate limiting and auth guards
        const body = await request.json();
        const payslip = await createPayslip({
            ...body,
            issuedDate: new Date().toISOString(),
        });

        logger.info("Payslip issued", { targetEmployee: payslip.employeeId, issuedBy: session.employeeId });
        return NextResponse.json(payslip, { status: 201 });
    } catch (err) {
        return serverErrorResponse("PayslipsPOST", err);
    }
}
