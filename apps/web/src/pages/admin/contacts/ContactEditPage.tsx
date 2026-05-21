import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  parkingInfo: string;
  accessInfo: string;
  equipmentAvailable: string;
  website: string;
  commissionArrangement: string;
};

export default function ContactEditPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    getToken().then(async (token) => {
      const data = await fetch(`/api/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()) as {
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
      };
      setForm({
        name: data.name,
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        notes: data.notes ?? '',
        parkingInfo: data.parkingInfo ?? '',
        accessInfo: data.accessInfo ?? '',
        equipmentAvailable: data.equipmentAvailable ?? '',
        website: data.website ?? '',
        commissionArrangement: data.commissionArrangement ?? '',
      });
    });
  }, [id, getToken]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => prev && { ...prev, [field]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setStatus('saving');
    try {
      const token = await getToken();
      await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
          parkingInfo: form.parkingInfo || null,
          accessInfo: form.accessInfo || null,
          equipmentAvailable: form.equipmentAvailable || null,
          website: form.website || null,
          commissionArrangement: form.commissionArrangement || null,
        }),
      });
      navigate(`/admin/contacts/${id}`);
    } catch {
      setStatus('error');
    }
  }

  if (!form) return <p>Loading…</p>;

  return (
    <div>
      <Link to={`/admin/contacts/${id}`}>← Back</Link>
      <h1>Edit contact</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>

        <div>
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>

        <div>
          <label>Address</label>
          <textarea
            rows={3}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>

        <div>
          <label>Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <div>
          <label>Parking info</label>
          <textarea
            rows={2}
            value={form.parkingInfo}
            onChange={(e) => set('parkingInfo', e.target.value)}
          />
        </div>

        <div>
          <label>Access info</label>
          <textarea
            rows={2}
            value={form.accessInfo}
            onChange={(e) => set('accessInfo', e.target.value)}
          />
        </div>

        <div>
          <label>Equipment available</label>
          <textarea
            rows={2}
            value={form.equipmentAvailable}
            onChange={(e) => set('equipmentAvailable', e.target.value)}
          />
        </div>

        <div>
          <label>Website</label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </div>

        <div>
          <label>Commission arrangement</label>
          <textarea
            rows={2}
            value={form.commissionArrangement}
            onChange={(e) => set('commissionArrangement', e.target.value)}
          />
        </div>

        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'error' && <span>Save failed.</span>}
      </form>
    </div>
  );
}
