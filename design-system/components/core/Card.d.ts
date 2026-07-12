import React from 'react';

export interface CardProps {
  padding?: string;
  /** Raised = surface-raised bg + medium shadow, for floating/emphasized cards (e.g. metric callouts). */
  raised?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * @startingPoint section="Components" subtitle="Surface container — default and raised" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
