import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Conversation from './conversation.js';
import { validAgentCredentials } from './agentAuth.js';

function wantsHuman(text) {
    const message = text.toLowerCase();
    return ['emergency', 'talk to an agent', 'talk to a human', 'receptionist']
        .some(term => message.includes(term));
}

function botReply(text) {
    const message = text.toLowerCase();
    if (['hour', 'timing', 'open'].some(word => message.includes(word))) {
        return 'We are open 9am to 6pm, Monday to Saturday.';
    }
    if (['book', 'appointment'].some(word => message.includes(word))) {
        return 'You can book from the appointments page, or ask for reception.';
    }
    return 'Hi, I can help with timings and bookings.';
}

function respond(ack, body) {
    if (typeof ack === 'function') ack(body);
}

async function findOrStartChat({ conversationId, patientId }, socket) {
    if (typeof patientId !== 'string' || !patientId.trim()) {
        throw new Error('patientId is required');
    }

    let chat;
    if (conversationId) {
        if (!mongoose.isValidObjectId(conversationId)) throw new Error('Invalid conversationId');
        chat = await Conversation.findOne({ _id: conversationId, patientId });
        if (!chat) throw new Error('Conversation not found');
    } else {
        chat = await Conversation.create({ patientId });
        socket.emit('chat:started', { conversationId: String(chat._id) });
    }
    socket.join(`patient:${chat._id}`);
    return chat;
}

export default function setupChat(io) {

    io.use((socket, next) => {
        const { role, agentId, token } = socket.handshake.auth || {};
        if (role !== 'agent') return next();
        if (!validAgentCredentials(agentId, token)) {
            return next(new Error('Invalid receptionist credentials'));
        }
        socket.data.agentId = agentId;
        next();
    });

    io.on('connection', socket => {
        socket.on('reception:join', ack => {
            if (!socket.data.agentId) {
                return respond(ack, { ok: false, message: 'Receptionist login required' });
            }
            socket.join('reception');
            respond(ack, { ok: true });
        });

        socket.on('patient:join', async (payload = {}, ack) => {
            try {
                if (!mongoose.isValidObjectId(payload.conversationId)) {
                    return respond(ack, { ok: false, message: 'Invalid conversationId' });
                }
                const chat = await Conversation.findOne({
                    _id: payload.conversationId,
                    patientId: payload.patientId
                });
                if (!chat) return respond(ack, { ok: false, message: 'Conversation not found' });
                socket.join(`patient:${chat._id}`);
                respond(ack, { ok: true });
            } catch {
                respond(ack, { ok: false, message: 'Could not join conversation' });
            }
        });

        socket.on('patient:message', async (payload = {}, ack) => {
            try {
                const message = typeof payload.text === 'string' ? payload.text.trim() : '';
                if (!message) return respond(ack, { ok: false, message: 'Message is empty' });
                let chat = await findOrStartChat(payload, socket);
                const event = {
                    id: randomUUID(),
                    conversationId: String(chat._id),
                    patientId: chat.patientId,
                    text: message
                };

                if (wantsHuman(message) && chat.mode === 'bot') {
                    const changed = await Conversation.findOneAndUpdate(
                        { _id: chat._id, mode: 'bot' },
                        { $set: { mode: 'human', status: 'waiting', agentId: null, claimedAt: null } },
                        { new: true }
                    );
                    if (changed) {
                        io.to('reception').emit('queue:new', event);
                        return respond(ack, { ok: true, conversationId: event.conversationId });
                    }
                    chat = await Conversation.findById(chat._id);
                }

                if (chat.mode === 'human') {
                    if (chat.status === 'claimed' && chat.agentId) {
                        io.to(`chat:${chat._id}`).emit('patient:message', event);
                    } else {
                        io.to('reception').emit('patient:message', event);
                    }
                    return respond(ack, { ok: true, conversationId: event.conversationId });
                }


                if (current?.mode === 'bot') {
                    io.to(`patient:${chat._id}`).emit('bot:message', {
                        ...event, text: botReply(message)
                    });
                }
                respond(ack, { ok: true, conversationId: event.conversationId });
            } catch (err) {
                console.error('Patient message failed:', err);
                respond(ack, { ok: false, message: 'Could not send message' });
            }
        });

        socket.on('agent:accept', async (payload = {}, ack) => {
            const agentId = socket.data.agentId;
            const { conversationId } = payload;
            if (!agentId || !mongoose.isValidObjectId(conversationId)) {
                return respond(ack, { ok: false, message: 'Agent login or conversationId is invalid' });
            }
            try {

                const claimed = await Conversation.findOneAndUpdate(
                    { _id: conversationId, mode: 'human', status: 'waiting', agentId: null },
                    { $set: { status: 'claimed', agentId, claimedAt: new Date() } },
                    { new: true }
                );
                if (!claimed) {
                    const existing = await Conversation.findById(conversationId);
                    if (existing?.mode !== 'human' || existing.agentId !== agentId) {
                        return respond(ack, { ok: false, message: 'Chat is not waiting or was claimed by another agent' });
                    }
                } else {
                    io.to('reception').emit('claim:taken', { conversationId, agentId });
                }
                socket.join(`chat:${conversationId}`);
                respond(ack, { ok: true });
            } catch (err) {
                console.error('Claim failed:', err);
                respond(ack, { ok: false, message: 'Could not claim chat' });
            }
        });

        socket.on('agent:message', async (payload = {}, ack) => {
            const agentId = socket.data.agentId;
            const { conversationId } = payload;
            const message = typeof payload.text === 'string' ? payload.text.trim() : '';
            if (!agentId || !mongoose.isValidObjectId(conversationId) || !message) {
                return respond(ack, { ok: false, message: 'Invalid receptionist or message' });
            }
            try {
                const chat = await Conversation.findOne({
                    _id: conversationId,
                    mode: 'human',
                    status: 'claimed',
                    agentId
                });
                if (!chat) return respond(ack, { ok: false, message: 'Chat is not assigned to you' });

                io.to(`patient:${conversationId}`).emit('agent:message', {
                    id: typeof payload.id === 'string' ? payload.id : randomUUID(),
                    conversationId,
                    agentId,
                    text: message
                });
                respond(ack, { ok: true });
            } catch (err) {
                console.error('Agent message failed:', err);
                respond(ack, { ok: false, message: 'Could not send message' });
            }
        });
    });
}
