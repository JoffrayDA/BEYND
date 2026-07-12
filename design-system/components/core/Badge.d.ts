import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'accent' | 'success';
}

export interface XPPillProps {
  xp?: number;
  level?: number;
}

/**
 * @startingPoint section="Components" subtitle="Status badge + XP/level pill — gamification kept discreet" viewport="700x160"
 */
export function Badge(props: BadgeProps): JSX.Element;
export function XPPill(props: XPPillProps): JSX.Element;
