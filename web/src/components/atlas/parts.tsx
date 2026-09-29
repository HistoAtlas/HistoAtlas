import { useState } from 'react';
import { Icon } from '../ui/Icon';

/** H&E thumbnail; falls back to a tinted placeholder when the image is missing. */
export function Thumb({ slideId, className }: { slideId: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden="true"
      className={`block flex-none overflow-hidden border border-zinc-200 ${className}`}
      style={{ background: 'var(--he-thumb)' }}
    >
      {!failed && (
        <img
          src={`/bundles/v1/tiles/${slideId}/thumbnail.jpg`}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function CopyButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? 'Copied' : label}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className={`flex-none w-[22px] h-[22px] flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer ${className}`}
    >
      <Icon name={copied ? 'check' : 'clipboard'} size={12} />
    </button>
  );
}
