import React from 'react';
interface Props { width?: string | number; height?: string | number; radius?: string | number; className?: string }

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }: Props) {
  return (
    <div
      className={['orbit-skeleton', className].join(' ')}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
      }}
    />
  );
}
export default Skeleton;