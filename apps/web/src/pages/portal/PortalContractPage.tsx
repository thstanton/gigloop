import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PreviewBanner } from './PreviewBanner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link_ from '@tiptap/extension-link';
import { VariableNode } from '../../features/templates/VariableNode';
import { useRef, useState, useEffect } from 'react';
import { FileText, PenLine, RotateCcw } from 'lucide-react';
import { getPortalData, getContractContent, signContract } from '../../lib/portalApi';
import { PortalLayout, getDisplayFontClass } from '../../layouts/PortalLayout';

// ─── Typed signature ─────────────────────────────────────────────────────────

function TypedSignature({ onSign, brand }: { onSign: (dataUrl: string) => void; brand: string }) {
  const [name, setName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!name.trim()) { onSign(''); return; }
    document.fonts.load('700 64px "Dancing Script"').then(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 64px "Dancing Script", cursive';
      ctx.fillStyle = '#1a1a1a';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.trim(), 20, canvas.height / 2);
      onSign(canvas.toDataURL('image/png'));
    });
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your full name"
        className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2.5 text-sm bg-white text-[#1a1a1a] placeholder-[#9ca3af] focus:outline-none focus:ring-1"
        style={{ '--tw-ring-color': brand } as React.CSSProperties}
      />
      <canvas ref={canvasRef} width={600} height={120} className="hidden" />
      {name.trim() ? (
        <div className="border border-[#e5e5e5] rounded-lg bg-white px-5 py-3 min-h-[88px] flex items-center overflow-hidden">
          <span
            style={{
              fontFamily: '"Dancing Script", cursive',
              fontSize: '52px',
              color: '#1a1a1a',
              lineHeight: 1.2,
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '100%',
            }}
          >
            {name}
          </span>
        </div>
      ) : (
        <div className="border border-dashed border-[#d1d5db] rounded-lg min-h-[88px] flex items-center justify-center">
          <span className="text-[#9ca3af] text-sm">Your signature preview</span>
        </div>
      )}
    </div>
  );
}

// ─── Drawn signature ──────────────────────────────────────────────────────────

function DrawnSignature({ onSign }: { onSign: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function startDraw(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos(e, canvas!);
      ctx!.beginPath();
      ctx!.moveTo(pos.x, pos.y);
    }
    function draw(e: MouseEvent | TouchEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e, canvas!);
      ctx!.lineTo(pos.x, pos.y);
      ctx!.stroke();
      if (!hasDrawnRef.current) { hasDrawnRef.current = true; setHasSignature(true); }
    }
    function stopDraw() {
      if (drawing.current) {
        drawing.current = false;
        if (hasDrawnRef.current) onSign(canvas!.toDataURL('image/png'));
      }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [onSign]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasSignature(false);
    onSign('');
  }

  return (
    <div className="space-y-2">
      <div className="relative border border-[#e5e5e5] rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: '160px' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[#9ca3af] text-sm flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Draw your signature here
            </span>
          </div>
        )}
      </div>
      {hasSignature && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Signature section (tabbed) ───────────────────────────────────────────────

function SignatureSection({
  onSign,
  brand,
  isBold,
}: {
  onSign: (dataUrl: string) => void;
  brand: string;
  isBold: boolean;
}) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');

  function handleModeChange(next: 'type' | 'draw') {
    setMode(next);
    onSign('');
  }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-[#f3f4f6] w-fit">
        {(['type', 'draw'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150"
            style={
              mode === m
                ? { backgroundColor: '#fff', color: brand, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#6b7280' }
            }
          >
            {m === 'type' ? 'Type' : 'Draw'}
          </button>
        ))}
      </div>

      {mode === 'type' ? (
        <TypedSignature onSign={onSign} brand={brand} />
      ) : (
        <DrawnSignature onSign={onSign} />
      )}

      <p className={`text-xs ${isBold ? 'text-white/40' : 'text-[#9ca3af]'}`}>
        By submitting, you confirm this constitutes your electronic signature.
      </p>
    </div>
  );
}

export default function PortalContractPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'admin';
  const previewFrom = searchParams.get('from') ?? '/admin/bookings';
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const portalQuery = useQuery({
    queryKey: ['portal', token],
    queryFn: () => getPortalData(token!),
    retry: false,
  });

  const contractQuery = useQuery({
    queryKey: ['portal', token, 'contract'],
    queryFn: () => getContractContent(token!),
    retry: false,
    enabled: !!portalQuery.data,
  });

  const editor = useEditor({
    // StarterKit v3 includes Underline — do not add it separately
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      Link_.configure({ openOnClick: true }),
      VariableNode,
    ],
    content: contractQuery.data?.content as Record<string, unknown> | undefined,
    editable: false,
    editorProps: {
      attributes: { class: 'tiptap-content focus:outline-none' },
    },
  });

  useEffect(() => {
    if (editor && contractQuery.data) {
      editor.commands.setContent(contractQuery.data.content as Record<string, unknown>);
    }
  }, [editor, contractQuery.data]);

  const signMutation = useMutation({
    mutationFn: () => signContract(token!, signature),
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => navigate(`/booking/${token}`, { replace: true }), 2000);
    },
  });

  const profile = portalQuery.data?.publicProfile;
  const brand = profile?.brandColour ?? '#1a1a1a';
  const isBold = profile?.portalTheme === 'BOLD_MODERN' || profile?.portalTheme === 'BOLD_ROMANTIC';
  const displayFont = getDisplayFontClass(profile?.portalTheme ?? null);

  const contractError = contractQuery.error;
  const alreadySigned = contractError instanceof Response && contractError.status === 400;
  const notFound =
    portalQuery.isError ||
    (contractError instanceof Response && contractError.status === 404);

  // Redirect after already-signed detection — must be in effect, not render body
  useEffect(() => {
    if (alreadySigned) navigate(`/booking/${token}`, { replace: true });
  }, [alreadySigned, navigate, token]);

  if (portalQuery.isLoading || contractQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#9ca3af] text-sm">Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <FileText className="mx-auto mb-4 h-10 w-10 text-[#9ca3af]" />
          <h1 className="text-lg font-semibold text-[#1a1a1a] mb-2">Booking not found</h1>
          <p className="text-sm text-[#6b7280]">
            This link may be incorrect or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned) return null;

  if (!profile || !contractQuery.data) return null;

  if (submitted) {
    return (
      <PortalLayout profile={profile}>
        <div className="text-center py-12 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <h2 className={`${displayFont} text-2xl ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Contract signed
          </h2>
          <p className={`text-sm ${isBold ? 'text-white/60' : 'text-[#6b7280]'}`}>
            Thank you. Redirecting…
          </p>
        </div>
      </PortalLayout>
    );
  }

  const canSubmit = agreed && signature.length > 0 && !signMutation.isPending;

  return (
    <>
      {isPreview && <PreviewBanner customerName="" backHref={previewFrom} />}
      <PortalLayout profile={profile}>
        <div className="space-y-8">
          <div>
            <h1 className={`${displayFont} text-3xl mb-1 ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>
              {contractQuery.data.title}
            </h1>
            <p className={`text-sm ${isBold ? 'text-white/60' : 'text-[#6b7280]'}`}>
              Please read carefully before signing
            </p>
          </div>

          <div className={`rounded-lg p-6 ${isBold ? 'bg-white/10' : 'bg-white border border-[#e5e5e5]'}`}>
            <EditorContent
              editor={editor}
              className={`prose prose-sm max-w-none ${isBold ? 'prose-invert' : ''}`}
            />
          </div>

          {isPreview ? (
            <p className={`text-sm text-center rounded-lg border border-dashed p-4 ${isBold ? 'border-white/20 text-white/40' : 'border-[#e5e5e5] text-[#9ca3af]'}`}>
              Signature form — preview only
            </p>
          ) : (
            <div className="space-y-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#e5e5e5] flex-shrink-0"
                />
                <span className={`text-sm ${isBold ? 'text-white/80' : 'text-[#374151]'}`}>
                  I have read and agree to the terms above
                </span>
              </label>

              {agreed && (
                <div className="space-y-3">
                  <p className={`text-sm font-medium ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>
                    Sign below
                  </p>
                  <SignatureSection onSign={setSignature} brand={brand} isBold={isBold} />
                </div>
              )}

              {signMutation.isError && (
                <p className="text-sm text-red-500">
                  Something went wrong. Please try again.
                </p>
              )}

              <button
                type="button"
                onClick={() => signMutation.mutate()}
                disabled={!canSubmit}
                className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: brand }}
              >
                {signMutation.isPending ? 'Signing…' : 'Sign contract'}
              </button>
            </div>
          )}
        </div>
      </PortalLayout>
    </>
  );
}
