import mongoose from 'mongoose';
import Appointment from './booking.js';

function sameBooking(existing, input) {
    return existing.patientPhone === input.patientPhone &&
        existing.doctorId === input.doctorId &&
        existing.slotTime.getTime() === input.slotTime.getTime();
}

function handleRepeatedRequest(existing, input) {
    if (!sameBooking(existing, input)) {
        return {
            status: 'request_conflict',
            message: 'This requestId was used for a different appointment'
        };
    }
    return { status: 'existing', appointment: existing };
}

export default async function bookAppointment(input) {
    const booking = {
        requestId: input.requestId,
        patientPhone: input.patientPhone,
        doctorId: input.doctorId,
        slotTime: new Date(input.slotTime),
        booking_status: 'BOOKED'
    };

    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(async () => {
            const existing = await Appointment.findOne({ requestId: booking.requestId }).session(session);
            if (existing) return handleRepeatedRequest(existing, booking);


            const [created] = await Appointment.create([booking], { session });
            return { status: 'created', appointment: created };
        });
    } catch (err) {
        if (err.code !== 11000) throw err;

        const existing = await Appointment.findOne({ requestId: booking.requestId });
        if (existing) return handleRepeatedRequest(existing, booking);

        const taken = await Appointment.exists({
            doctorId: booking.doctorId,
            slotTime: booking.slotTime,
            booking_status: 'BOOKED'
        });
        if (taken) return { status: 'slot_conflict', message: 'This slot is already booked' };

        throw err;
    } finally {
        await session.endSession();
    }
}
