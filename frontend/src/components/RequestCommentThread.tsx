import { useState, useEffect, type FormEvent } from 'react';
import { MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { getRequestComments, addRequestComment, type RequestComment } from '../api';
import { Avatar } from './UserProfileCard';
import { getCachedUser } from './LoginGate';
import { formatBogotaTime } from '../utils/dateUtils';

interface RequestCommentThreadProps {
  requestId: number;
}

const RequestCommentThread = ({ requestId }: RequestCommentThreadProps) => {
  const currentUser = getCachedUser();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await getRequestComments(requestId);
      setComments(data);
      setLoaded(true);
      localStorage.setItem(`read_msg_${requestId}`, new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (expanded) {
      if (!loaded) load();
      const interval = setInterval(load, 5000); // Polling cada 5 segundos
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, loaded]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const created = await addRequestComment(requestId, message.trim());
      setComments([...comments, created]);
      localStorage.setItem(`read_msg_${requestId}`, new Date().toISOString());
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '4px', paddingTop: '10px' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}
      >
        <MessageCircle size={16} />
        Mensajes {comments.length > 0 && `(${comments.length})`}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comments.length === 0 && loaded ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Todavía no hay mensajes en esta solicitud.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Avatar user={c.author} size={28} />
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px 12px', flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {c.author.full_name}
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                      {formatBogotaTime(c.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', marginTop: '2px' }}>{c.message}</div>
                </div>
              </div>
            ))
          )}

          {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem' }}>{error}</p>}

          {currentUser && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                placeholder="Escribí un mensaje..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !message.trim()}>
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestCommentThread;
