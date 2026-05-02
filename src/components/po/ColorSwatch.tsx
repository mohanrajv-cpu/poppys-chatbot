export default function ColorSwatch({
  hexCode,
  size = 'md',
}: {
  hexCode: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const hex = hexCode.startsWith('#') ? hexCode : `#${hexCode}`;

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border border-gray-200 flex-shrink-0`}
      style={{ backgroundColor: hex }}
      title={hex.toUpperCase()}
    />
  );
}
