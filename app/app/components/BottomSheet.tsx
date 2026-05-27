'use client'

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '500px',
          background: 'var(--color-surface-raised)',
          borderRadius: '16px 16px 0 0',
          zIndex: 201,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px 14px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontSize: '20px',
              lineHeight: 1,
              padding: '2px 6px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            overflowY: 'auto',
            padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
