1. Booking Endpoint

The booking API is implemented in `server.js`, with MongoDB transaction logic in `transaction.js`. I used unique indexes to prevent duplicate request IDs and double bookings for the same doctor and time slot. If the same request is repeated, the existing booking is returned. Conflicting requests return 409, while successful new bookings return 201. MongoDB transactions require a replica set.

2. Bot-to-Reception Handoff

The chat handoff logic is implemented in `chat.js` using Socket.IO and MongoDB. When a patient requests human assistance, the conversation switches from bot mode to the waiting queue. A receptionist can claim the conversation through an atomic database update, preventing multiple agents from accepting it. Receptionist identity is verified using server-configured tokens, and further messages are routed to the assigned conversation.

3. Reconnecting Chat Window

The chat interface is implemented in `ChatWindow.jsx` using React and Socket.IO. It handles socket connections, reconnections, and listener cleanup through `useEffect`. Duplicate messages are filtered using message IDs, and messages from other conversations are ignored. Outgoing messages show their sending status based on server acknowledgements. Chat history is stored in React state and is not retained after a page reload.

4. Sending 200,000 Notifications

For large-scale notifications, I proposed using a background worker instead of processing everything inside an API request. The API would create a campaign and return 202 while workers process recipients in batches. Each notification would have a unique record to track its delivery status and retry failures. Rate limiting and provider-supported idempotency keys would help control delivery and prevent duplicates. This part is a proposed design and is not implemented in the code.