import React from 'react';

export interface MessageBubbleProps {
  from?: 'user' | 'coach';
  children: React.ReactNode;
  time?: string;
}

/**
 * @startingPoint section="Components" subtitle="Chat bubble — user vs coach, theme-aware" viewport="700x220"
 */
export function MessageBubble(props: MessageBubbleProps): JSX.Element;
