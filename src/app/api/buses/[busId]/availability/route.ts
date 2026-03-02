
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/app/api/lib/db';
import Bus from '@/app/api/models/busModel';

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ busId: string }> },
) {
    try {
        await dbConnect();

        const { busId } = await context.params;
        const bus = await Bus.findById(busId, 'availability');

        if (!bus) {
            return NextResponse.json({ message: 'Bus not found' }, { status: 404 });
        }

        return NextResponse.json(bus.availability);
    } catch (error: unknown) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : 'Failed to fetch availability.' },
            { status: 500 },
        );
    }
}
