import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },
    patientPhone: { type: String, required: true },
    doctorId: { type: String, required: true },
    slotTime: { type: Date, required: true },
    booking_status: {
        type: String,
        enum: ['BOOKED', 'CANCELLED'],
        default: 'BOOKED'
    }
}, { timestamps: true });

bookingSchema.index(
    { doctorId: 1, slotTime: 1 },
    { unique: true, partialFilterExpression: { booking_status: 'BOOKED' } }
);

export default mongoose.model('Appointment', bookingSchema);
