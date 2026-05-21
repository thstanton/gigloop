import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

interface Booking {
  id: string;
  title: string | null;
  date: string;
  status: string;
  eventType: string;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  parkingInfo: string | null;
  accessInfo: string | null;
  equipmentAvailable: string | null;
  website: string | null;
  commissionArrangement: string | null;
  customerBookings: Booking[];
  venueBookings: Booking[];
  referrerBookings: Booking[];
}

type BookingWithRole = Booking & { role: string };

function mergeBookings(contact: Contact): BookingWithRole[] {
  return [
    ...contact.customerBookings.map((b) => ({ ...b, role: 'Customer' })),
    ...contact.venueBookings.map((b) => ({ ...b, role: 'Venue' })),
    ...contact.referrerBookings.map((b) => ({ ...b, role: 'Referrer' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      try {
        const data = await fetch(`/api/contacts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        });
        setContact(data as Contact);
      } catch {
        setError(true);
      }
    });
  }, [id, getToken]);

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    setDeleteStatus('deleting');
    setDeleteError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) {
        const body = await res.json() as { message: string };
        setDeleteError(body.message);
        setDeleteStatus('error');
        return;
      }
      if (!res.ok) throw new Error();
      navigate('/admin/contacts');
    } catch {
      setDeleteError('Delete failed.');
      setDeleteStatus('error');
    }
  }

  if (error) return <p>Contact not found.</p>;
  if (!contact) return <p>Loading…</p>;

  const bookings = mergeBookings(contact);

  return (
    <div>
      <div>
        <Link to="/admin/contacts">← Contacts</Link>
        <Link to={`/admin/contacts/${id}/edit`}>Edit</Link>
        <button onClick={handleDelete} disabled={deleteStatus === 'deleting'}>
          {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {deleteError && <p>{deleteError}</p>}

      <h1>{contact.name}</h1>

      {contact.email && <p>Email: {contact.email}</p>}
      {contact.phone && <p>Phone: {contact.phone}</p>}
      {contact.address && <p>Address: {contact.address}</p>}
      {contact.website && <p>Website: {contact.website}</p>}
      {contact.notes && <p>Notes: {contact.notes}</p>}
      {contact.parkingInfo && <p>Parking: {contact.parkingInfo}</p>}
      {contact.accessInfo && <p>Access: {contact.accessInfo}</p>}
      {contact.equipmentAvailable && <p>Equipment: {contact.equipmentAvailable}</p>}
      {contact.commissionArrangement && <p>Commission: {contact.commissionArrangement}</p>}

      <h2>Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings.</p>
      ) : (
        <ul>
          {bookings.map((b) => (
            <li key={`${b.role}-${b.id}`}>
              <Link to={`/admin/bookings/${b.id}`}>
                {b.title ?? b.eventType} — {new Date(b.date).toLocaleDateString()} — {b.status}
              </Link>
              <span> ({b.role})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
