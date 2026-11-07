import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function ChatWindow({ conversationId, agentId, token, onBack }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [connection, setConnection] = useState('Connecting...');
    const [canReply, setCanReply] = useState(false);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080', {
            auth: { role: 'agent', agentId, token }
        });
        socketRef.current = socket;

        function onConnect() {
            setConnection('Connected. Claiming chat...');
            setCanReply(false);
            socket.emit('reception:join', response => {
                if (!response?.ok) setConnection(response?.message || 'Could not join reception');
            });
            // On reconnect, rejoin the claimed chat room on the new socket.
            socket.emit('agent:accept', { conversationId }, response => {
                setCanReply(Boolean(response?.ok));
                setConnection(response?.ok ? 'Chat assigned to you' : (response?.message || 'Cannot claim chat'));
            });
        }
        function onDisconnect() {
            setConnection('Disconnected. Reconnecting...');
            setCanReply(false);
        }
        function onConnectError(err) {
            setConnection(err.message || 'Connection failed');
            setCanReply(false);
        }
        function onPatientMessage(message) {
            if (String(message.conversationId) !== conversationId) return;
            setMessages(previous => {
                if (message.id && previous.some(item => item.id === message.id)) return previous;
                return previous.concat({
                    id: message.id || crypto.randomUUID(),
                    from: 'patient',
                    text: message.text
                });
            });
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('patient:message', onPatientMessage);
        socket.on('queue:new', onPatientMessage);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('patient:message', onPatientMessage);
            socket.off('queue:new', onPatientMessage);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [conversationId, agentId, token]);

    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [messages]);

    function send(event) {
        event.preventDefault();
        const value = text.trim();
        if (!value || !canReply || !socketRef.current?.connected) return;

        const id = crypto.randomUUID();
        setText('');
        setMessages(previous => previous.concat({ id, from: 'me', text: value, status: 'Sending...' }));

        socketRef.current.timeout(10000).emit(
            'agent:message', { conversationId, text: value, id },
            (err, response) => {
                setMessages(previous => previous.map(item => item.id === id ? {
                    ...item,
                    status: !err && response?.ok ? 'Sent' : 'Not sent'
                } : item));
            }
        );
    }

    return (
        <div className="chat">
            <div className="bar">
                <button type="button" onClick={onBack}>Back</button>
                <span>Front desk · {agentId}</span>
            </div>
            <p className="connection" role="status">{connection}</p>
            <div className="feed">
                {messages.map(message => (
                    <div key={message.id} className={message.from === 'me' ? 'bubble mine' : 'bubble'}>
                        <p>{message.text}</p>
                        {message.from === 'me' && <small>{message.status}</small>}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={send}>
                <input value={text} disabled={!canReply} placeholder="Reply to the patient"
                    onChange={event => setText(event.target.value)} />
                <button type="submit" disabled={!canReply || !text.trim()}>Send</button>
            </form>
        </div>
    );
}
