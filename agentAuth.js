import { timingSafeEqual } from 'node:crypto';

export function validAgentCredentials(agentId, token) {
    if (typeof agentId !== 'string' || typeof token !== 'string') return false;

    let configured;
    try {
        configured = JSON.parse(process.env.RECEPTION_AGENT_TOKENS || '{}');
    } catch {
        return false;
    }

    const expected = configured[agentId];
    if (typeof expected !== 'string' || expected.length === 0 || !token) return false;

    const actualBytes = Buffer.from(token);
    const expectedBytes = Buffer.from(expected);
    return actualBytes.length === expectedBytes.length &&
        timingSafeEqual(actualBytes, expectedBytes);
}
