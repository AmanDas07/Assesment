import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChatWindow from './ChatWindow.jsx';
import './style.css';

function App() {
    const [conversationId, setConversationId] = useState(
        new URLSearchParams(window.location.search).get('conversationId') || ''
    );
    const [agentId, setAgentId] = useState('rec_1');
    const [token, setToken] = useState('');
    const [selected, setSelected] = useState(null);

    if (selected) {
        return <ChatWindow {...selected} onBack={() => setSelected(null)} />;
    }

    return (
        <form className="join" onSubmit={event => {
            event.preventDefault();
            if (!/^[a-f0-9]{24}$/i.test(conversationId.trim())) return;
            setSelected({ conversationId: conversationId.trim(), agentId: agentId.trim(), token });
        }}>
            <h2>Open a reception chat</h2>
            <label>Conversation ID
                <input value={conversationId} onChange={event => setConversationId(event.target.value)} required />
            </label>
            <label>Receptionist ID
                <input value={agentId} onChange={event => setAgentId(event.target.value)} required />
            </label>
            <label>Receptionist token
                <input type="password" value={token} onChange={event => setToken(event.target.value)} required />
            </label>
            <button type="submit">Open chat</button>
            <p>Use the conversation ID returned by the patient chat. A waiting chat must be claimed before replying.</p>
        </form>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
);
