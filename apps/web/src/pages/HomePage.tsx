import { useEffect, useState } from 'react';

type HealthStatus = 'loading' | 'ok' | 'error';

export default function HomePage() {
  const [status, setStatus] = useState<HealthStatus>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { status: string }) => {
        setStatus(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main>
      <h1>GigMan</h1>
      <p>API: {status}</p>
    </main>
  );
}
