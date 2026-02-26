import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to get random number between min and max
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split('T')[0];

async function main() {
    const employees = await prisma.employee.findMany();
    const shifts = await prisma.workShift.findMany({
        include: { days: true }
    });

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-02-26');

    console.log(`Generating data for ${employees.length} employees from ${formatDate(startDate)} to ${formatDate(endDate)}...`);

    for (const emp of employees) {
        const empShift = shifts.find(s => s.id === emp.shiftId) || shifts.find(s => s.isDefault);

        let current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = formatDate(current);
            const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...

            // Adjust Day of Week to match Prisma (if necessary)
            // Prisma: 0=Sun, 1=Mon, ..., 6=Sat is standard but let's check shift days
            const shiftDay = empShift?.days.find(d => d.dayOfWeek === dayOfWeek);

            // Random status: 85% Present, 5% Leave, 5% Sick, 5% Absent (on work days)
            const rand = Math.random();

            if (shiftDay && !shiftDay.isOff) {
                if (rand < 0.85) {
                    // PRESENT
                    // Base times from shift
                    const [startHour, startMin] = shiftDay.startTime.split(':').map(Number);
                    const [endHour, endMin] = shiftDay.endTime.split(':').map(Number);

                    // Simulate random clock in: -15 min to +45 min (45 min lateness possible)
                    const inOffset = getRandomInt(-15, 45);
                    const clockInTime = new Date(current);
                    clockInTime.setHours(startHour, startMin + inOffset, 0);

                    // Simulate random clock out: -10 min to +120 min (overtime possible)
                    const outOffset = getRandomInt(-10, 120);
                    const clockOutTime = new Date(current);
                    clockOutTime.setHours(endHour, endMin + outOffset, 0);

                    const clockInStr = clockInTime.toTimeString().split(' ')[0].substring(0, 5);
                    const clockOutStr = clockOutTime.toTimeString().split(' ')[0].substring(0, 5);

                    await prisma.attendanceRecord.upsert({
                        where: { employeeId_date: { employeeId: emp.employeeId, date: dateStr } },
                        update: {
                            clockIn: clockInStr,
                            clockOut: clockOutStr,
                            status: inOffset > 0 ? 'late' : 'present',
                            clockInLocation: '{"lat":-6.2088,"lng":106.8456,"address":"Jakarta Office"}',
                            clockOutLocation: '{"lat":-6.2088,"lng":106.8456,"address":"Jakarta Office"}'
                        },
                        create: {
                            employeeId: emp.employeeId,
                            date: dateStr,
                            clockIn: clockInStr,
                            clockOut: clockOutStr,
                            status: inOffset > 0 ? 'late' : 'present',
                            clockInLocation: '{"lat":-6.2088,"lng":106.8456,"address":"Jakarta Office"}',
                            clockOutLocation: '{"lat":-6.2088,"lng":106.8456,"address":"Jakarta Office"}'
                        }
                    });

                    // Simulate Overtime if outOffset > 60
                    if (outOffset > 60) {
                        await prisma.overtimeRequest.create({
                            data: {
                                employeeId: emp.employeeId,
                                date: dateStr,
                                startTime: shiftDay.endTime,
                                endTime: clockOutStr,
                                hours: outOffset / 60,
                                reason: 'Menyelesaikan deadline project',
                                status: 'approved',
                                createdAt: new Date().toISOString()
                            }
                        });
                    }

                } else if (rand < 0.95) {
                    // LEAVE / SICK
                    const type = rand < 0.90 ? 'Cuti Tahunan' : 'Sakit';
                    await prisma.leaveRequest.create({
                        data: {
                            employeeId: emp.employeeId,
                            type,
                            startDate: dateStr,
                            endDate: dateStr,
                            reason: rand < 0.90 ? 'Keperluan Keluarga' : 'Demam/Flu',
                            status: 'approved',
                            createdAt: new Date().toISOString()
                        }
                    });

                    await prisma.attendanceRecord.upsert({
                        where: { employeeId_date: { employeeId: emp.employeeId, date: dateStr } },
                        update: { status: type === 'Sakit' ? 'sick' : 'leave' },
                        create: {
                            employeeId: emp.employeeId,
                            date: dateStr,
                            status: type === 'Sakit' ? 'sick' : 'leave'
                        }
                    });
                } else {
                    // ABSENT
                    await prisma.attendanceRecord.upsert({
                        where: { employeeId_date: { employeeId: emp.employeeId, date: dateStr } },
                        update: { status: 'absent' },
                        create: {
                            employeeId: emp.employeeId,
                            date: dateStr,
                            status: 'absent'
                        }
                    });
                }
            }

            current.setDate(current.getDate() + 1);
        }
    }

    console.log('Dummy data generated successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
