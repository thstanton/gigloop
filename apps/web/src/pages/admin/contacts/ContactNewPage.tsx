import { useAuth } from '@clerk/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

const empty: FormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  parkingInfo: '',
  accessInfo: '',
  equipmentAvailable: '',
  website: '',
  commissionArrangement: '',
};

export default function ContactNewPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const token = await getToken();
      const created = await fetch('/api/contacts', {
        method: 'POST',
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
      }).then((r) => r.json());
      navigate(`/admin/contacts/${(created as { id: string }).id}`);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div>
      <h1>New contact</h1>
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
          {status === 'saving' ? 'Saving…' : 'Create contact'}
        </button>
        {status === 'error' && <span>Save failed.</span>}
      </form>
    </div>
  );
}
