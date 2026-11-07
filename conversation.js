import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    patientId: {
        type: String
    },

    mode: {
        type: String,
        enum: ["bot", "human"],
        default: "bot"
    },

    status: {
        type: String,
        enum: ["open", "waiting", "claimed"],
        default: "open"
    },

    agentId: {
        type: String,
        default: null
    },

    claimedAt: {
        type: Date
    }
});

export default mongoose.model(
    "Conversation",
    conversationSchema
);
