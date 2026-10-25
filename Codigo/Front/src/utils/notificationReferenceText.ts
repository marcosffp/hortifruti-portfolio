import type { TipoReferencia } from "@/types/notificacoesTypes";

export const MESES_PT_BR = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString("pt-BR", { month: "long" }),
);

// "Mês" por padrão sugere o mês anterior ao de hoje (o mês do pedido mais recente já fechado).
export function getMesAnoAnteriorPadrao(): { mes: number; ano: number } {
  const hoje = new Date();
  const mesAtual = hoje.getMonth(); // 0-indexado: janeiro = 0
  if (mesAtual === 0) {
    return { mes: 12, ano: hoje.getFullYear() - 1 };
  }
  // mesAtual (0-indexado) coincide numericamente com o mês anterior em 1-indexado.
  return { mes: mesAtual, ano: hoje.getFullYear() };
}

// "Período" por padrão sugere os últimos 7 dias (incluindo hoje).
export function getPeriodoPadrao(): { dataInicial: string; dataFinal: string } {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 6);
  const paraISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { dataInicial: paraISO(inicio), dataFinal: paraISO(hoje) };
}

function formatarDiaMes(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, dia).toLocaleString("pt-BR", {
    month: "long",
  });
  return `${String(dia).padStart(2, "0")} de ${nomeMes}`;
}

export function gerarTextoReferencia(
  tipo: TipoReferencia,
  mes: number,
  ano: number,
  dataInicial: string,
  dataFinal: string,
): string {
  if (tipo === "mes") {
    return `Encaminhamos as informações referentes ao pedido realizado no mês de ${MESES_PT_BR[mes - 1]} de ${ano}.`;
  }
  return `Encaminhamos as informações referentes ao pedido realizado no período de ${formatarDiaMes(dataInicial)} a ${formatarDiaMes(dataFinal)}.`;
}
