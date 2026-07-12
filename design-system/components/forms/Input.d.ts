import React from 'react';

export interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TextareaProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  disabled?: boolean;
}

/**
 * @startingPoint section="Components" subtitle="Text input + textarea, rounded surface field" viewport="700x220"
 */
export function Input(props: InputProps): JSX.Element;
export function Textarea(props: TextareaProps): JSX.Element;
