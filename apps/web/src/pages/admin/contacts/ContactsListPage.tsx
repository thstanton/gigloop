import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function ContactsListPage() {
  const { getToken } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      try {
        const data = await fetch('/api/contacts', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
        setContacts(data as Contact[]);
      } catch {
        setError(true);
      }
    });
  }, [getToken]);

  if (error) return <p>Failed to load contacts.</p>;
  if (!contacts) return <p>Loading…</p>;

  return (
    <div>
      <div>
        <h1>Contacts</h1>
        <Link to="/admin/contacts/new">New contact</Link>
      </div>

      {contacts.length === 0 ? (
        <p>No contacts yet.</p>
      ) : (
        <ul>
          {contacts.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/contacts/${c.id}`}>
                <strong>{c.name}</strong>
                {c.email && <span> — {c.email}</span>}
                {c.phone && <span> — {c.phone}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
