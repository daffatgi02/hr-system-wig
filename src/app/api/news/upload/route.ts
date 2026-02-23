import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "news");

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== "hr") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File terlalu besar (maks 10MB)" }, { status: 400 });
        }

        // Ensure upload directory exists
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name);
        const uniqueName = `${randomUUID()}${ext}`;
        const filePath = path.join(UPLOAD_DIR, uniqueName);

        // Write file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        return NextResponse.json({
            url: `/uploads/news/${uniqueName}`,
            name: file.name,
        });
    } catch {
        return NextResponse.json({ error: "Upload gagal" }, { status: 500 });
    }
}
