import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, Ref } from 'react';

export interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | undefined;
  hint?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email';
  placeholder?: string;
  maxLength?: number;
  prefix?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/** Campo de formulario accesible: etiqueta asociada, aria-invalid y mensajes vinculados. */
export function FormField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  prefix,
  disabled = false,
  inputRef,
}: FormFieldProps) {
  const hasError = error !== undefined && error.length > 0;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = hasError ? errorId : hint !== undefined ? hintId : undefined;

  const input = (
    <input
      id={id}
      ref={inputRef}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      autoComplete={autoComplete}
      inputMode={inputMode}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      aria-invalid={hasError}
      aria-describedby={describedBy}
      required
    />
  );

  return (
    <div className={`field${hasError ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {prefix !== undefined ? (
        <div className="input-prefix">
          <span aria-hidden="true">{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {hasError ? (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
