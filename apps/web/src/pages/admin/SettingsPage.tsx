import { useAuth } from '@clerk/react';
import { useEffect, useRef, useState } from 'react';

interface PublicProfile {
  displayName: string | null;
  businessName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  logoUrl: string | null;
  brandColour: string | null;
  photo: string | null;
  website: string | null;
  portalTheme: string;
}

interface UserProfile {
  address: string | null;
  bankDetails: string | null;
  vatNumber: string | null;
  defaultPaymentTermsDays: number;
  depositTrackingMode: string;
}

type PublicFormState = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  bio: string;
  logoUrl: string;
  brandColour: string;
  website: string;
};

type PrivateFormState = {
  address: string;
  bankDetails: string;
  vatNumber: string;
  defaultPaymentTermsDays: string;
  depositTrackingMode: string;
};

function toPublicForm(p: PublicProfile): PublicFormState {
  return {
    displayName: p.displayName ?? '',
    businessName: p.businessName,
    email: p.email ?? '',
    phone: p.phone ?? '',
    bio: p.bio ?? '',
    logoUrl: p.logoUrl ?? '',
    brandColour: p.brandColour ?? '#000000',
    website: p.website ?? '',
  };
}

function toPrivateForm(p: UserProfile): PrivateFormState {
  return {
    address: p.address ?? '',
    bankDetails: p.bankDetails ?? '',
    vatNumber: p.vatNumber ?? '',
    defaultPaymentTermsDays: String(p.defaultPaymentTermsDays),
    depositTrackingMode: p.depositTrackingMode,
  };
}

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [publicForm, setPublicForm] = useState<PublicFormState | null>(null);
  const [privateForm, setPrivateForm] = useState<PrivateFormState | null>(null);
  const [publicStatus, setPublicStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [privateStatus, setPrivateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getToken().then(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const [pub, priv] = await Promise.all([
        fetch('/api/me/public', { headers }).then((r) => r.json()),
        fetch('/api/me', { headers }).then((r) => r.json()),
      ]);
      setPublicForm(toPublicForm(pub as PublicProfile));
      setPrivateForm(toPrivateForm(priv as UserProfile));
    });
  }, [getToken]);

  function setPublic(field: keyof PublicFormState, value: string) {
    setPublicForm((prev) => prev && { ...prev, [field]: value });
  }

  function setPrivate(field: keyof PrivateFormState, value: string) {
    setPrivateForm((prev) => prev && { ...prev, [field]: value });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !publicForm) return;

    setUploadStatus('uploading');
    try {
      const token = await getToken();
      const { uploadUrl, publicUrl } = await fetch('/api/me/logo-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType: file.type }),
      }).then((r) => r.json());

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setPublic('logoUrl', publicUrl);
      setUploadStatus('idle');
    } catch {
      setUploadStatus('error');
    }
  }

  async function handlePublicSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicForm) return;
    setPublicStatus('saving');
    try {
      const token = await getToken();
      await fetch('/api/me/public', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: publicForm.displayName || null,
          businessName: publicForm.businessName,
          email: publicForm.email || null,
          phone: publicForm.phone || null,
          bio: publicForm.bio || null,
          logoUrl: publicForm.logoUrl || null,
          brandColour: publicForm.brandColour,
          website: publicForm.website || null,
        }),
      });
      setPublicStatus('saved');
      setTimeout(() => setPublicStatus('idle'), 2000);
    } catch {
      setPublicStatus('error');
    }
  }

  async function handlePrivateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!privateForm) return;
    setPrivateStatus('saving');
    try {
      const token = await getToken();
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          address: privateForm.address || null,
          bankDetails: privateForm.bankDetails || null,
          vatNumber: privateForm.vatNumber || null,
          defaultPaymentTermsDays: Number(privateForm.defaultPaymentTermsDays),
          depositTrackingMode: privateForm.depositTrackingMode,
        }),
      });
      setPrivateStatus('saved');
      setTimeout(() => setPrivateStatus('idle'), 2000);
    } catch {
      setPrivateStatus('error');
    }
  }

  if (!publicForm || !privateForm) return <p>Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>

      <section>
        <h2>Public profile</h2>
        <form onSubmit={handlePublicSubmit}>
          <div>
            <label>Display name</label>
            <input
              value={publicForm.displayName}
              onChange={(e) => setPublic('displayName', e.target.value)}
            />
          </div>

          <div>
            <label>Business name</label>
            <input
              required
              value={publicForm.businessName}
              onChange={(e) => setPublic('businessName', e.target.value)}
            />
          </div>

          <div>
            <label>Email</label>
            <input
              type="email"
              value={publicForm.email}
              onChange={(e) => setPublic('email', e.target.value)}
            />
          </div>

          <div>
            <label>Phone</label>
            <input
              value={publicForm.phone}
              onChange={(e) => setPublic('phone', e.target.value)}
            />
          </div>

          <div>
            <label>Bio</label>
            <textarea
              value={publicForm.bio}
              onChange={(e) => setPublic('bio', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <label>Website</label>
            <input
              type="url"
              value={publicForm.website}
              onChange={(e) => setPublic('website', e.target.value)}
            />
          </div>

          <div>
            <label>Brand colour</label>
            <input
              type="color"
              value={publicForm.brandColour}
              onChange={(e) => setPublic('brandColour', e.target.value)}
            />
          </div>

          <div>
            <label>Logo</label>
            {publicForm.logoUrl && <img src={publicForm.logoUrl} alt="Logo" width={80} />}
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

          <button type="submit" disabled={publicStatus === 'saving'}>
            {publicStatus === 'saving' ? 'Saving…' : publicStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
          {publicStatus === 'error' && <span>Save failed</span>}
        </form>
      </section>

      <section>
        <h2>Business details</h2>
        <form onSubmit={handlePrivateSubmit}>
          <div>
            <label>Address</label>
            <textarea
              value={privateForm.address}
              onChange={(e) => setPrivate('address', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label>Bank details</label>
            <textarea
              value={privateForm.bankDetails}
              onChange={(e) => setPrivate('bankDetails', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label>VAT number</label>
            <input
              value={privateForm.vatNumber}
              onChange={(e) => setPrivate('vatNumber', e.target.value)}
            />
          </div>

          <div>
            <label>Payment terms (days)</label>
            <input
              type="number"
              min={0}
              value={privateForm.defaultPaymentTermsDays}
              onChange={(e) => setPrivate('defaultPaymentTermsDays', e.target.value)}
            />
          </div>

          <div>
            <label>Deposit tracking</label>
            <select
              value={privateForm.depositTrackingMode}
              onChange={(e) => setPrivate('depositTrackingMode', e.target.value)}
            >
              <option value="INVOICE">Auto (when deposit invoice is marked Paid)</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          <button type="submit" disabled={privateStatus === 'saving'}>
            {privateStatus === 'saving' ? 'Saving…' : privateStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
          {privateStatus === 'error' && <span>Save failed</span>}
        </form>
      </section>
    </div>
  );
}
