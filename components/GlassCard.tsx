
import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", padding = "p-6", ...props }) => {
  return (
    <div className={`glass rounded-2xl ${padding} ${className}`} {...props}>
      {children}
    </div>
  );
};
