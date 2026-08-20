import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl';
}

export const Container: React.FC<ContainerProps> = ({
  children,
  className = '',
  maxWidth = 'lg',
}) => {
  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '7xl': 'max-w-7xl',
  };

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 overflow-hidden box-border ${maxWidthClasses[maxWidth]} ${className}`}
    >
      {children}
    </div>
  );
};
