interface TalosLogoProps {
  size?: number;
  className?: string;
}

export function TalosLogo({ size = 20, className }: TalosLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt="Talos"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
