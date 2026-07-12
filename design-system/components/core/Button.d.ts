import React from 'react';

export interface ButtonProps {
  /** Visual style. primary = filled brand color; secondary = outline; ghost = text-only; accent = filled accent color. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Optional leading icon element (e.g. Lucide icon component). */
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

/**
 * @startingPoint section="Components" subtitle="Pill button — primary/secondary/ghost/accent" viewport="700x260"
 */
export function Button(props: ButtonProps): JSX.Element;
