import { useAuth } from '@clerk/react';
import { useEffect, useRef, useState } from 'react';

interface UserProfile {
  displayName: string | null;
  businessName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  logoUrl: string | null;
  brandColour: string | null;
}

type FormState = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  bio: string;
  logoUrl: string;
  brandColour: string;
};

function toFormState(profile: UserProfile): FormState {
  return {
    displayName: profile.displayName ?? '',
    businessName: profile.businessName,
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    logoUrl: profile.logoUrl ?? '',
    brandColour: profile.brandColour ?? '#000000',
  };
}

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getToken().then((token) =>
      fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((profile: UserProfile) => setForm(toFormState(profile))),
    );
  }, [getToken]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => prev && { ...prev, [field]: value });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;

    setUploadStatus('uploading');
    try {
      const token = await getToken();
      const { uploadUrl, publicUrl } = await fetch('/api/me/logo-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType: file.type }),
      }).then((r) => r.json());

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      set('logoUrl', publicUrl);
      setUploadStatus('idle');
    } catch {
      setUploadStatus('error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setStatus('saving');
    try {
      const token = await getToken();
      await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: form.displayName || null,
          businessName: form.businessName,
          email: form.email || null,
          phone: form.phone || null,
          bio: form.bio || null,
          logoUrl: form.logoUrl || null,
          brandColour: form.brandColour,
        }),
      });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  if (!form) return <p>Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Display name</label>
          <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </div>

        <div>
          <label>Business name</label>
          <input
            required
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
          />
        </div>

        <div>
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>

        <div>
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>

        <div>
          <label>Bio</label>
          <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} />
        </div>

        <div>
          <label>Brand colour</label>
          <input
            type="color"
            value={form.brandColour}
            onChange={(e) => set('brandColour', e.target.value)}
          />
        </div>

        <div>
          <label>Logo</label>
          {form.logoUrl && <img src={form.logoUrl} alt="Logo" width={80} />}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: 'none' }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            {uploadStatus === 'uploading' ? 'Uploading…' : 'Choose file'}
          </button>
          {uploadStatus === 'error' && <span>Upload failed</span>}
        </div>

        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
        </button>
        {status === 'error' && <span>Save failed</span>}
      </form>
    </div>
  );
}
