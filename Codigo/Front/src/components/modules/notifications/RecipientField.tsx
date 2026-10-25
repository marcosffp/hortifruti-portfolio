"use client";

import { Mail, X } from "lucide-react";
import { useState } from "react";
import { validarEmail } from "@/utils/validationUtils";

interface RecipientFieldProps {
  id: string;
  label: string;
  hint?: string;
  recipients: string[];
  onChange: (recipients: string[]) => void;
  disabled?: boolean;
}

/**
 * Campo de destinatários no estilo do Gmail: cada endereço vira um "chip" removível, e novos
 * endereços entram com Enter, vírgula, ponto e vírgula ou ao sair do campo. Aceita colar vários
 * endereços de uma vez.
 */
export default function RecipientField({
  id,
  label,
  hint,
  recipients,
  onChange,
  disabled,
}: RecipientFieldProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const commit = (raw: string) => {
    const addresses = raw
      .split(/[,;\s]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (addresses.length === 0) return;

    const invalid = addresses.find((a) => !validarEmail(a));
    if (invalid) {
      setError(`"${invalid}" não é um e-mail válido`);
      setDraft(raw);
      return;
    }

    const known = new Set(recipients.map((r) => r.toLowerCase()));
    const added = addresses.filter((a) => {
      const key = a.toLowerCase();
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (added.length > 0) onChange([...recipients, ...added]);
    setDraft("");
    setError("");
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--neutral-700)] mb-1"
      >
        {label}
      </label>
      <div
        className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 border rounded-lg bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent ${
          error ? "border-[var(--secondary)]" : "border-[var(--neutral-300)]"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {recipients.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-0.5 text-sm rounded-full bg-[var(--primary-bg)] border border-[var(--primary)] text-[var(--neutral-900)]"
          >
            <Mail className="w-3 h-3 text-[var(--primary)] flex-shrink-0" />
            <span className="truncate">{email}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(recipients.filter((r) => r !== email))}
              className="p-0.5 rounded-full hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              title={`Remover ${email}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          value={draft}
          disabled={disabled}
          placeholder={recipients.length === 0 ? "nome@exemplo.com" : ""}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              commit(draft);
            } else if (
              e.key === "Backspace" &&
              draft === "" &&
              recipients.length > 0
            ) {
              onChange(recipients.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\s]/.test(text.trim())) {
              e.preventDefault();
              commit(text);
            }
          }}
          onBlur={() => commit(draft)}
          className="flex-1 min-w-[10rem] px-1 py-1 text-sm bg-transparent focus:outline-none"
        />
      </div>
      {error ? (
        <p className="text-xs text-[var(--secondary)] mt-1">{error}</p>
      ) : (
        hint && <p className="text-xs text-[var(--neutral-500)] mt-1">{hint}</p>
      )}
    </div>
  );
}
