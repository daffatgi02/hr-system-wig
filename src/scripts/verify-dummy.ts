import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const attendanceCount = await prisma.attendanceRecord.count({
        where: {
            date: {
                gte: '2026-02-01',
                lte: '2026-02-26'
            }
        }
    });

    const leaveCount = await prisma.leaveRequest.count({
        where: {
            startDate: {
                gte: '2026-02-01',
                lte: '2026-02-26'
            }
        }
    });

    const overtimeCount = await prisma.overtimeRequest.count({
        where: {
            date: {
                gte: '2026-02-01',
                lte: '2026-02-26'
            }
        }
    });

    console.log(JSON.stringify({ attendanceCount, leaveCount, overtimeCount }, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
