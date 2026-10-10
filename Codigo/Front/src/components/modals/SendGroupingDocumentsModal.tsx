"use client";

import { FileText, Mail, RotateCcw, Send, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ScoreWithBilletInfo } from "@/components/modules/combined-scores/types";
import Button from "@/components/ui/Button";
import { billetService } from "@/services/billetService";
import { bulkNotificationService } from "@/services/bulkNotificationService";
import { invoiceService } from "@/services/invoiceService";
import type { ClientResponse } from "@/types/clientType";
import type { TipoReferencia } from "@/types/notificacoesTypes";
import {
  gerarTextoReferencia,
  getMesAnoAnteriorPadrao,
  getPeriodoPadrao,
  MESES_PT_BR,
} from "@/utils/notificationReferenceText";
import { showError, showErrorWithLink, showSuccess } from "@/utils/toastUtils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type DocumentKey = "billet" | "danfe" | "xml";

interface DocumentOption {
  key: DocumentKey;
  label: string;
  fileName: string;
  mimeType: string;
  fetchBlob: () => Promise<Blob>;
}

interface SendGroupingDocumentsModalProps {
  open: boolean;
  onClose: () => void;
  score: ScoreWithBilletInfo;
  client: ClientResponse | null;
}

/**
 * Monta os documentos que o agrupamento realmente possui. Os nomes seguem os mesmos padrões dos
 * downloads manuais (BOL-<seuNumero>.pdf, NF-<número>.pdf/.xml) para o cliente receber os arquivos
 * exatamente como hoje.
 */
function buildDocumentOptions(score: ScoreWithBilletInfo): DocumentOption[] {
  const options: DocumentOption[] = [];

  if (score.hasBillet) {
    const billetNumber =
      score.billetInfo?.seuNumero || score.number || score.id;
    options.push({
      key: "billet",
      label: `Boleto ${billetNumber}`,
      fileName: `BOL-${billetNumber}.pdf`,
      mimeType: "application/pdf",
      fetchBlob: () => billetService.downloadStoredBillet(score.id),
    });
  }

  const invoiceAuthorized = score.invoiceInfo?.status === "autorizado";
  if (score.hasInvoice && score.invoiceRef && invoiceAuthorized) {
    const ref = score.invoiceRef;
    const nfNumber = score.invoiceInfo?.number ?? ref;
    options.push(
      {
        key: "danfe",
        label: `Nota Fiscal ${nfNumber} (DANFE PDF)`,
        fileName: `NF-${nfNumber}.pdf`,
        mimeType: "application/pdf",
        fetchBlob: () => invoiceService.downloadDanfe(ref),
      },
      {
        key: "xml",
        label: `Nota Fiscal ${nfNumber} (XML)`,
        fileName: `NF-${nfNumber}.xml`,
        mimeType: "application/xml",
        fetchBlob: () => invoiceService.downloadXml(ref),
      },
    );
  }

  return options;
}

export default function SendGroupingDocumentsModal({
  open,
  onClose,
  score,
  client,
}: SendGroupingDocumentsModalProps) {
  const documents = useMemo(() => buildDocumentOptions(score), [score]);
  const [selected, setSelected] = useState<Set<DocumentKey>>(
    () => new Set(documents.map((d) => d.key)),
  );
  const [tipoReferencia, setTipoReferencia] =
    useState<TipoReferencia>("periodo");
  const [mes, setMes] = useState(() => getMesAnoAnteriorPadrao().mes);
  const [ano, setAno] = useState(() => getMesAnoAnteriorPadrao().ano);
  const [dataInicial, setDataInicial] = useState(
    () => getPeriodoPadrao().dataInicial,
  );
  const [dataFinal, setDataFinal] = useState(
    () => getPeriodoPadrao().dataFinal,
  );
  const [textoEditado, setTextoEditado] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  // Mesma regra da tela de notificações: o texto acompanha mês/período até o usuário editá-lo.
  const textoPadrao = gerarTextoReferencia(
    tipoReferencia,
    mes,
    ano,
    dataInicial,
    dataFinal,
  );
  const mensagem = textoEditado ? mensagemEditada : textoPadrao;

  if (!open) return null;

  const clientData = client && client.id === score.clientId ? client : null;
  const email = clientData?.email?.trim() ?? "";
  const hasPeriodError =
    tipoReferencia === "periodo" && (!dataInicial || !dataFinal);
  const periodOrder =
    tipoReferencia === "periodo" && dataInicial > dataFinal && !hasPeriodError;
  const canSend =
    !sending &&
    !!clientData &&
    !!email &&
    selected.size > 0 &&
    !hasPeriodError &&
    !periodOrder;

  const toggleDocument = (key: DocumentKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    if (!clientData) {
      showError("Cliente do agrupamento não encontrado");
      return;
    }
    if (!email) {
      showError("O cliente não possui e-mail cadastrado");
      return;
    }
    const chosen = documents.filter((d) => selected.has(d.key));
    if (chosen.length === 0) {
      showError("Selecione pelo menos um documento para enviar");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      const files: File[] = [];
      for (const doc of chosen) {
        let blob: Blob;
        try {
          blob = await doc.fetchBlob();
        } catch (error) {
          console.error(`Erro ao obter ${doc.label}:`, error);
          showError(`Não foi possível obter "${doc.label}". Nada foi enviado.`);
          return;
        }
        if (blob.size === 0) {
          showError(`O documento "${doc.label}" está vazio. Nada foi enviado.`);
          return;
        }
        if (blob.size > MAX_FILE_SIZE) {
          showError(
            `O documento "${doc.label}" excede o tamanho máximo de 10MB. Nada foi enviado.`,
          );
          return;
        }
        files.push(new File([blob], doc.fileName, { type: doc.mimeType }));
      }

      const response = await bulkNotificationService.sendBulkNotifications({
        files,
        clientIds: [clientData.id],
        channels: ["email"],
        destinationType: "clientes",
        customMessage: mensagem || undefined,
      });

      if (response.success) {
        showSuccess(`Documentos enviados para ${clientData.clientName}`);
        onClose();
      } else if (response.authorizationUrl) {
        showErrorWithLink(response.message, response.authorizationUrl);
      } else {
        showError(response.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      showError(`Erro ao enviar notificação: ${message}`);
      console.error("Erro ao enviar documentos do agrupamento:", error);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const segmentButton = (active: boolean) =>
    `flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
      active
        ? "bg-white text-[var(--primary)] shadow-sm"
        : "text-[var(--neutral-600)] hover:text-[var(--neutral-900)]"
    }`;
  const inputClass =
    "w-full px-3 py-2 text-sm border border-[var(--neutral-300)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const sectionLabel =
    "text-xs font-semibold uppercase tracking-wide text-[var(--neutral-500)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--primary-bg)] text-[var(--primary)] flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--neutral-900)] leading-tight">
                Enviar documentos
              </h2>
              <p className="text-sm text-[var(--neutral-500)]">
                Agrupamento {score.number || score.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="p-1.5 -mr-1.5 text-[var(--neutral-500)] hover:bg-gray-100 rounded-full cursor-pointer disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 [scrollbar-width:thin] [scrollbar-color:var(--neutral-300)_transparent]">
          <section className="space-y-2">
            <h3 className={sectionLabel}>Destinatário</h3>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--neutral-50)] border border-[var(--neutral-200)]">
              <div className="w-9 h-9 rounded-full bg-white border border-[var(--neutral-200)] text-[var(--neutral-500)] flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-[var(--neutral-900)] truncate">
                  {clientData?.clientName ?? "Cliente não carregado"}
                </p>
                {email ? (
                  <p className="text-sm text-[var(--neutral-600)] truncate">
                    {email}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--secondary)]">
                    Sem e-mail cadastrado — não é possível enviar
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className={sectionLabel}>Documentos</h3>
              {documents.length > 0 && (
                <span className="text-xs text-[var(--neutral-500)]">
                  {selected.size} de {documents.length} selecionado
                  {documents.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-[var(--neutral-500)]">
                Este agrupamento ainda não possui boleto nem nota fiscal
                autorizada para enviar.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const isSelected = selected.has(doc.key);
                  return (
                    <label
                      key={doc.key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary-bg)]"
                          : "border-[var(--neutral-200)] bg-white hover:border-[var(--neutral-300)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDocument(doc.key)}
                        disabled={sending}
                        className="w-4 h-4 accent-[var(--primary)] flex-shrink-0"
                      />
                      <FileText className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--neutral-900)] truncate">
                          {doc.label}
                        </p>
                        <p className="text-xs text-[var(--neutral-500)] truncate">
                          {doc.fileName}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-[var(--neutral-200)] text-[var(--neutral-600)] flex-shrink-0">
                        {doc.fileName.split(".").pop()?.toUpperCase()}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {score.hasInvoice && !documents.some((d) => d.key === "danfe") && (
              <p className="text-xs text-[var(--neutral-500)]">
                A nota fiscal só pode ser enviada depois de autorizada.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className={sectionLabel}>Referência</h3>
              <div className="flex w-48 p-1 rounded-lg bg-[var(--neutral-100)]">
                <button
                  type="button"
                  onClick={() => setTipoReferencia("mes")}
                  className={segmentButton(tipoReferencia === "mes")}
                >
                  Mês
                </button>
                <button
                  type="button"
                  onClick={() => setTipoReferencia("periodo")}
                  className={segmentButton(tipoReferencia === "periodo")}
                >
                  Período
                </button>
              </div>
            </div>

            {tipoReferencia === "mes" ? (
              <div className="grid grid-cols-2 gap-3">
                <select
                  aria-label="Mês"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className={inputClass}
                >
                  {MESES_PT_BR.map((nome, index) => (
                    <option key={nome} value={index + 1}>
                      {nome.replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Ano"
                  type="number"
                  min={2000}
                  max={2100}
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs text-[var(--neutral-500)] mb-1">
                    De
                  </span>
                  <input
                    type="date"
                    value={dataInicial}
                    onChange={(e) => setDataInicial(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-[var(--neutral-500)] mb-1">
                    Até
                  </span>
                  <input
                    type="date"
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {hasPeriodError && (
              <p className="text-xs text-[var(--secondary)]">
                Informe a data inicial e a data final.
              </p>
            )}
            {periodOrder && (
              <p className="text-xs text-[var(--secondary)]">
                A data inicial não pode ser posterior à data final.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="grouping-send-message" className={sectionLabel}>
                Mensagem (opcional)
              </label>
              {textoEditado && (
                <button
                  type="button"
                  onClick={() => setTextoEditado(false)}
                  className="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar texto padrão
                </button>
              )}
            </div>
            <textarea
              id="grouping-send-message"
              rows={3}
              value={mensagem}
              onChange={(e) => {
                setMensagemEditada(e.target.value);
                setTextoEditado(true);
              }}
              className={`${inputClass} resize-none`}
            />
          </section>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-[var(--neutral-50)]">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2.5 text-sm font-medium text-[var(--neutral-700)] hover:bg-gray-100 rounded-lg cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <div className="flex-1">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={<Send className="w-5 h-5" />}
              onClick={handleSend}
              disabled={!canSend}
            >
              {sending ? "Enviando..." : "Enviar E-mail"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
