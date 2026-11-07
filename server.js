import http from 'node:http';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import Appointment from './booking.js';
import bookAppointment from './transaction.js';
import setupChat from './chat.js';

dotenv.config();

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }
});
setupChat(io);

function validBookingBody(body) {
    if (!body || ['requestId', 'patientPhone', 'doctorId', 'slotTime'].some(
        key => typeof body[key] !== 'string' || !body[key].trim()
    )) return false;

    // Require an explicit timezone so both clients refer to the same slot.
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(body.slotTime)) return false;
    return !Number.isNaN(new Date(body.slotTime).getTime());
}

app.post('/api/appointments/book', async (req, res) => {
    if (!validBookingBody(req.body)) {
        return res.status(400).json({
            success: false,
            message: 'requestId, patientPhone, doctorId and a valid timezone-aware slotTime are required'
        });
    }

    const input = {
        requestId: req.body.requestId.trim(),
        patientPhone: req.body.patientPhone.trim(),
        doctorId: req.body.doctorId.trim(),
        slotTime: req.body.slotTime
    };

    try {
        const result = await bookAppointment(input);
        if (result.status === 'created' || result.status === 'existing') {
            return res.status(result.status === 'created' ? 201 : 200).json({
                success: true,
                message: result.status === 'created' ? 'Booking confirmed' : 'Booking already confirmed',
                appointment: result.appointment
            });
        }

        return res.status(409).json({ success: false, message: result.message });
    } catch (err) {
        console.error('Booking failed:', err);
        return res.status(500).json({ success: false, message: 'Could not book the slot' });
    }
});

try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing');
    await mongoose.connect(process.env.MONGO_URI);
    await Appointment.init();
    const port = Number(process.env.PORT || 8080);
    server.listen(port, () => console.log(`Server started on ${port}`));
} catch (err) {
    console.error('Startup failed:', err);
    process.exitCode = 1;
}
