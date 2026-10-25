export interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  selecionado: boolean;
}

export interface DestinatariosContabilidade {
  para: string[];
  cc: string[];
  cco: string[];
  /** Uma mensagem separada para cada destinatário de "Para" (em vez de uma única mensagem). */
  individual: boolean;
}

export type TipoDestinatario = "clientes" | "contabilidade";
export type TipoReferencia = "mes" | "periodo";

export interface NotificacoesDraft {
  tipoDestinatario: TipoDestinatario;
  mensagemPersonalizada: string;
  canaisEnvio: { email: boolean; whatsapp: boolean };
  cardValue: number;
  cashValue: number;
  selectedClientIds: number[];
  tipoReferencia: TipoReferencia;
  mesReferencia: number;
  anoReferencia: number;
  dataInicialReferencia: string;
  dataFinalReferencia: string;
  textoEditadoManualmente: boolean;
}
