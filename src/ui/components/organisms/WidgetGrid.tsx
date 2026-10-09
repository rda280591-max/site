import React from 'react';
interface Props { children: React.ReactNode; className?: string; style?: React.CSSProperties }

export function WidgetGrid({ children, className = '', style }: Props) {
  return (
    <div className={['grid gap-4','grid-cols-1 md:grid-cols-2 xl:grid-cols-3',className].join(' ')} style={style}>
      {children}
    </div>
  );
}
export default WidgetGrid;