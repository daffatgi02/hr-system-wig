import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse, validateBody, serverErrorResponse } from "@/lib/middleware/apiGuard";
import { checkApiRateLimit } from "@/lib/middleware/rateLimit";
import { getLeaveRequests, createLeaveRequest, updateLeaveRequest } from "@/lib/services/leaveService";
import { leaveRequestSchema, leaveUpdateSchema } from "@/lib/validations/validationSchemas";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await requireAuth();
    if (!session) return unauthorizedResponse();

    try {
        if (session.role === "hr") {
            const leaves = await getLeaveRequests();
            return NextResponse.json(leaves);
        }

        const leaves = await getLeaveRequests(session.employeeId);
        return NextResponse.json(leaves);
    } catch (err) {
        return serverErrorResponse("LeaveGET", err);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await requireAuth();
    if (!session) return unauthorizedResponse();

    try {
        const result = await validateBody(request, leaveRequestSchema);
        if ("error" in result) return result.error;
        const body = result.data;

        const leave = await createLeaveRequest({
            ...body,
            employeeId: session.employeeId,
            status: "pending",
            createdAt: new Date().toISOString(),
        });

        logger.info("Leave request created", { employeeId: session.employeeId, leaveId: leave.id });
        return NextResponse.json(leave, { status: 201 });
    } catch (err) {
        return serverErrorResponse("LeavePOST", err);
    }
}

export async function PUT(request: NextRequest) {
    const rateLimited = checkApiRateLimit(request.headers);
    if (rateLimited) return rateLimited;

    const session = await requireAuth();
    if (!session) return unauthorizedResponse();
    if (session.role !== "hr") return forbiddenResponse();

    try {
        const result = await validateBody(request, leaveUpdateSchema);
        if ("error" in result) return result.error;

        const { id, ...data } = result.data as { id: string } & Record<string, any>;

        const updated = await updateLeaveRequest(id, data);
        if (!updated) {
            return NextResponse.json({ error: "Permohonan cuti tidak ditemukan." }, { status: 404 });
        }

        logger.info("Leave request updated", { leaveId: id, updatedBy: session.employeeId, status: data.status });
        return NextResponse.json(updated);
    } catch (err) {
        return serverErrorResponse("LeavePUT", err);
    }
}
