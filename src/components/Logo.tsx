export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-label="Pages logo"
      className={`inline-block align-middle ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: 'url(/motion.svg)',
        maskImage: 'url(/motion.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
