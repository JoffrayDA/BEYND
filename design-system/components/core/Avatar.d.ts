import React from 'react';

export interface AvatarProps {
  /** Image URL — for coach avatars, a 3D stylized portrait (Memoji-adult / Pixar-lite style). */
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
}

/**
 * @startingPoint section="Components" subtitle="Round avatar — coach portrait or user initials" viewport="700x140"
 */
export function Avatar(props: AvatarProps): JSX.Element;
