import React from 'react';

export interface CoachThemeSwitcherProps {
  active?: 'cool-jeune' | 'pote-cash' | 'data-nerd';
  onChange?: (id: string) => void;
}

/**
 * @startingPoint section="Components" subtitle="Coach picker — switches the active theme" viewport="700x100"
 */
export function CoachThemeSwitcher(props: CoachThemeSwitcherProps): JSX.Element;
