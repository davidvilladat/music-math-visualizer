import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

/*
 * iOS-style bottom sheet and grouped lists (dark appearance), used for every
 * picker and menu on small screens. Colours and metrics follow the iOS system
 * palette: grouped background #1c1c1e, cells #2c2c2e, tint #0a84ff, 44pt rows.
 */

export const IOS = {
  tint: '#0a84ff',
  label: '#ffffff',
  secondary: 'rgba(235,235,245,0.6)',
  separator: 'rgba(84,84,88,0.65)',
  sheet: '#1c1c1e',
  cell: '#2c2c2e',
  destructive: '#ff453a',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
}

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  /** Shows a back button in place of the left slot, iOS navigation style. */
  onBack?: () => void
  backLabel?: string
  children: ReactNode
  testId?: string
  /** Cap the height so the visuals stay visible above it (live preview). */
  maxHeight?: string
}

export function Sheet({ open, title, onClose, onBack, backLabel = 'Back', children, testId, maxHeight }: SheetProps) {
  // Keep it mounted for the slide-out, then unmount.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const id = window.setTimeout(() => setMounted(false), 320)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div style={layer} data-testid={testId}>
      <div
        style={{ ...backdrop, opacity: shown ? 1 : 0, background: maxHeight ? 'rgba(0,0,0,0.12)' : backdrop.background }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ...sheet, ...(maxHeight ? { maxHeight } : null), transform: shown ? 'translateY(0)' : 'translateY(105%)' }}
      >
        <div style={grabber} aria-hidden="true" />
        <header style={navBar}>
          <div style={navSide}>
            {onBack && (
              <button type="button" onClick={onBack} style={{ ...navButton, paddingLeft: 0 }} data-testid="sheet-back">
                <ChevronLeft /> {backLabel}
              </button>
            )}
          </div>
          <div style={navTitle}>{title}</div>
          <div style={{ ...navSide, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ ...navButton, fontWeight: 600 }}>
              Done
            </button>
          </div>
        </header>
        <div style={body}>{children}</div>
      </div>
    </div>
  )
}

export function Group({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  return (
    <section style={groupWrap}>
      {header && <div style={groupHeader}>{header}</div>}
      <div style={group}>{children}</div>
      {footer && <div style={groupFooter}>{footer}</div>}
    </section>
  )
}

interface RowProps {
  label: string
  value?: string
  /** Small colour dot before the label (visual-mode accents). */
  dot?: string
  chevron?: boolean
  checked?: boolean
  tone?: 'default' | 'tint' | 'destructive'
  disabled?: boolean
  onClick?: () => void
  testId?: string
}

export function Row({ label, value, dot, chevron, checked, tone = 'default', disabled, onClick, testId }: RowProps) {
  const color = tone === 'tint' ? IOS.tint : tone === 'destructive' ? IOS.destructive : IOS.label
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ios-row"
      style={{ ...row, opacity: disabled ? 0.4 : 1 }}
      data-testid={testId}
      role={checked === undefined ? undefined : 'menuitemradio'}
      aria-checked={checked}
    >
      {dot && <span style={{ ...dotStyle, background: dot, boxShadow: `0 0 8px ${dot}` }} aria-hidden="true" />}
      <span style={{ ...rowLabel, color }}>{label}</span>
      {value && <span style={rowValue}>{value}</span>}
      {checked && <Checkmark />}
      {chevron && <ChevronRight />}
    </button>
  )
}

export interface PickerOption<T extends string | number> {
  value: T
  label: string
  dot?: string
}

/** A single-choice list with a checkmark, like an iOS settings picker. */
export function PickerList<T extends string | number>({
  options,
  value,
  onSelect,
  header,
  testIdPrefix,
}: {
  options: PickerOption<T>[]
  value: T
  onSelect: (value: T) => void
  header?: string
  testIdPrefix?: string
}) {
  return (
    <Group header={header}>
      {options.map((option) => (
        <Row
          key={String(option.value)}
          label={option.label}
          dot={option.dot}
          checked={option.value === value}
          onClick={() => onSelect(option.value)}
          testId={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
        />
      ))}
    </Group>
  )
}

/**
 * A form row that opens a picker sheet: the iOS replacement for <select>.
 */
export function PickerField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string
  options: PickerOption<T>[]
  value: T
  onChange: (value: T) => void
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)
  return (
    <>
      <div style={{ ...group, marginBottom: 0 }}>
        <Row label={label} value={current?.label} dot={current?.dot} chevron onClick={() => setOpen(true)} testId={testId} />
      </div>
      <Sheet open={open} title={label} onClose={() => setOpen(false)}>
        <PickerList
          options={options}
          value={value}
          onSelect={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}

function ChevronRight() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true" style={{ marginLeft: 8, flexShrink: 0 }}>
      <path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke="rgba(235,235,245,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden="true">
      <path d="M9.5 1.5 2 9l7.5 7.5" stroke={IOS.tint} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Checkmark() {
  return (
    <svg width="15" height="12" viewBox="0 0 15 12" fill="none" aria-hidden="true" style={{ marginLeft: 8, flexShrink: 0 }}>
      <path d="M1.5 6.5 5.5 10.5 13.5 1.5" stroke={IOS.tint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const layer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Above every HUD and overlay, like a system sheet.
  zIndex: 1000,
  fontFamily: IOS.font,
  WebkitFontSmoothing: 'antialiased',
}

const backdrop: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  transition: 'opacity 0.3s ease',
}

const sheet: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  margin: '0 auto',
  width: 'min(100%, 560px)',
  maxHeight: 'calc(100% - max(24px, env(safe-area-inset-top)))',
  display: 'flex',
  flexDirection: 'column',
  background: IOS.sheet,
  borderRadius: '14px 14px 0 0',
  boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
  transition: 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
  color: IOS.label,
}

const grabber: CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  background: 'rgba(235,235,245,0.3)',
  margin: '6px auto 0',
  flexShrink: 0,
}

const navBar: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 16px',
  flexShrink: 0,
}

const navSide: CSSProperties = { display: 'flex', alignItems: 'center', minWidth: 0 }

const navTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
}

const navButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 44,
  border: 0,
  background: 'transparent',
  color: IOS.tint,
  fontFamily: IOS.font,
  fontSize: 17,
  padding: '0 2px',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const body: CSSProperties = {
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  padding: '4px 16px max(20px, env(safe-area-inset-bottom))',
}

const groupWrap: CSSProperties = { marginBottom: 22 }

const groupHeader: CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  color: IOS.secondary,
  padding: '0 16px 7px',
  letterSpacing: '-0.01em',
}

const groupFooter: CSSProperties = {
  fontSize: 13,
  color: IOS.secondary,
  padding: '7px 16px 0',
  lineHeight: 1.35,
}

const group: CSSProperties = {
  background: IOS.cell,
  borderRadius: 10,
  overflow: 'hidden',
}

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: 44,
  padding: '0 16px',
  border: 0,
  // Background, pressed state and the inset separator live in globals.css
  // (.ios-row): inline styles cannot target the previous sibling.
  color: IOS.label,
  fontFamily: IOS.font,
  fontSize: 17,
  letterSpacing: '-0.02em',
  textAlign: 'left',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  marginRight: 12,
  flexShrink: 0,
}

const rowLabel: CSSProperties = {
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const rowValue: CSSProperties = {
  color: IOS.secondary,
  marginLeft: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '55%',
}
