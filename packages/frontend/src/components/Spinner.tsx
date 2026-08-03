interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}

/** Accent ring used for any in-flight work. */
export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      className={
        'spinner' +
        (size === 'sm' ? ' spinner--sm' : '') +
        (className ? ` ${className}` : '')
      }
      aria-hidden="true"
    />
  )
}

interface LoadingStatusProps {
  label?: string
  className?: string
}

/** Centered spinner + label for empty panes / overlays. */
export function LoadingStatus({
  label = 'Loading…',
  className = '',
}: LoadingStatusProps) {
  return (
    <div
      className={'loading-status' + (className ? ` ${className}` : '')}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span className="loading-status-text">{label}</span>
    </div>
  )
}

interface LoadingInlineProps {
  label?: string
  className?: string
}

/** Compact spinner + label for toolbars and tight rows. */
export function LoadingInline({
  label = 'Loading…',
  className = '',
}: LoadingInlineProps) {
  return (
    <span
      className={'loading-inline' + (className ? ` ${className}` : '')}
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" />
      <span>{label}</span>
    </span>
  )
}
