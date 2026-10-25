import { UserRoundSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clientService } from "@/services/clientService";
import type { ClientSelectionInfo } from "@/types/clientType";
import { normalize } from "@/utils/textSearch";

const RECENT_CLIENTS_KEY = "hortifruti:clientSelector:recentIds";
const MAX_RECENT_CLIENTS = 5;

function loadRecentIds(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_CLIENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === "number")
      : [];
  } catch {
    return [];
  }
}

function saveRecentIds(ids: number[]) {
  try {
    localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(ids));
  } catch {
    // localStorage indisponível (modo privado etc.): só perde o atalho dos recentes.
  }
}

type ClientSelectorProps = {
  onClientSelect?: (client: ClientSelectionInfo) => void;
};

export default function ClientSelector({
  onClientSelect,
}: ClientSelectorProps) {
  const [clientes, setClientes] = useState<ClientSelectionInfo[]>([]);
  const [selected, setSelected] = useState<ClientSelectionInfo | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      const data = await clientService.getAllClientsForSelection();
      setClientes(data);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    setRecentIds(loadRecentIds());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = clientes
    .filter((client) => {
      const normQuery = normalize(query);
      return (
        normalize(client.clientName).includes(normQuery) ||
        (client.nickname && normalize(client.nickname).includes(normQuery))
      );
    })
    .sort((a, b) => {
      // Clientes usados recentemente primeiro (mais recente no topo); o resto, alfabético.
      const recentA = recentIds.indexOf(a.clientId);
      const recentB = recentIds.indexOf(b.clientId);
      if (recentA !== -1 || recentB !== -1) {
        if (recentA === -1) return 1;
        if (recentB === -1) return -1;
        return recentA - recentB;
      }
      return a.clientName.localeCompare(b.clientName);
    });

  const selectClient = (client: ClientSelectionInfo) => {
    const nextRecent = [
      client.clientId,
      ...recentIds.filter((id) => id !== client.clientId),
    ].slice(0, MAX_RECENT_CLIENTS);
    setRecentIds(nextRecent);
    saveRecentIds(nextRecent);
    setSelected(client);
    setQuery(client.clientName);
    setOpen(false);
    onClientSelect?.(client);
  };

  const handleChange = (text: string) => {
    setQuery(text);
    setOpen(true);
    setHighlighted(0);
    if (selected) setSelected(null);
  };

  const handleFocus = () => {
    setOpen(true);
    if (selected) setQuery("");
  };

  const handleBlur = () => {
    if (!open) return;
    setQuery(selected ? selected.clientName : "");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const candidate = suggestions[highlighted] ?? suggestions[0];
      if (candidate) selectClient(candidate);
    } else if (e.key === "Escape") {
      setOpen(false);
      handleBlur();
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white">
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-2">
        <UserRoundSearch className="w-6 h-6 text-green-600" />
        Selecionar Cliente
      </h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="client" className="font-medium text-gray-700">
          Cliente
        </label>
        <div className="relative w-full" ref={containerRef}>
          <input
            id="client"
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome do cliente"
            autoComplete="off"
            className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-green-500 transition w-full truncate"
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
              {suggestions.map((client, index) => (
                <li key={client.clientId}>
                  {index === 0 && recentIds.includes(client.clientId) && (
                    <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase text-gray-400">
                      Recentes
                    </div>
                  )}
                  {!recentIds.includes(client.clientId) &&
                    index > 0 &&
                    recentIds.includes(suggestions[index - 1].clientId) && (
                      <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase text-gray-400 border-t border-gray-100">
                        Todos os clientes
                      </div>
                    )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectClient(client)}
                    className={`w-full text-left px-3 py-2 text-sm truncate ${
                      index === highlighted ? "bg-green-50" : "hover:bg-gray-50"
                    }`}
                  >
                    {client.clientName}
                    {client.nickname && (
                      <span className="text-gray-400">
                        {" "}
                        ({client.nickname})
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() !== "" && suggestions.length === 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-500">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
