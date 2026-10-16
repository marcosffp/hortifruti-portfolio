import type {
  Cliente,
  DestinatariosContabilidade,
  TipoDestinatario,
} from "@/types/notificacoesTypes";
import { showError } from "@/utils/toastUtils";

export function validarArquivoECanais(
  arquivos: File[],
  canaisEnvio: { email: boolean; whatsapp: boolean },
): boolean {
  if (arquivos.length === 0) {
    showError("Por favor, selecione pelo menos um arquivo para enviar");
    return false;
  }
  if (!canaisEnvio.email && !canaisEnvio.whatsapp) {
    showError("Por favor, selecione pelo menos um canal de envio");
    return false;
  }
  return true;
}

export function validarClientes(
  clientes: Cliente[],
  canaisEnvio: { email: boolean; whatsapp: boolean },
): boolean {
  const clientesSelecionados = clientes.filter((c) => c.selecionado);
  if (clientesSelecionados.length === 0) {
    showError("Por favor, selecione pelo menos um cliente");
    return false;
  }

  if (canaisEnvio.email) {
    const clientesSemEmail = clientes
      .filter((c) => c.selecionado && !c.email)
      .map((c) => c.nome);
    if (clientesSemEmail.length > 0) {
      showError(
        `Os seguintes clientes não possuem e-mail cadastrado: ${clientesSemEmail.join(", ")}`,
      );
      return false;
    }
  }

  if (canaisEnvio.whatsapp) {
    const clientesSemTelefone = clientes
      .filter((c) => c.selecionado && !c.telefone)
      .map((c) => c.nome);
    if (clientesSemTelefone.length > 0) {
      showError(
        `Os seguintes clientes não possuem telefone cadastrado: ${clientesSemTelefone.join(", ")}`,
      );
      return false;
    }
  }

  return true;
}

export function validarDestinatariosContabilidade(
  destinatarios: DestinatariosContabilidade,
): boolean {
  if (destinatarios.para.length === 0) {
    showError("Informe pelo menos um destinatário no campo Para");
    return false;
  }
  if (
    destinatarios.individual &&
    (destinatarios.cc.length > 0 || destinatarios.cco.length > 0)
  ) {
    showError(
      "Cc e Cco não podem ser usados no envio individual. Remova-os ou desative o envio individual",
    );
    return false;
  }
  return true;
}

export function validarFormulario(
  arquivos: File[],
  canaisEnvio: { email: boolean; whatsapp: boolean },
  tipoDestinatario: TipoDestinatario,
  clientes: Cliente[],
  destinatariosContabilidade?: DestinatariosContabilidade,
): boolean {
  if (!validarArquivoECanais(arquivos, canaisEnvio)) return false;
  if (
    tipoDestinatario === "contabilidade" &&
    canaisEnvio.email &&
    destinatariosContabilidade &&
    !validarDestinatariosContabilidade(destinatariosContabilidade)
  )
    return false;
  if (
    tipoDestinatario === "clientes" &&
    !validarClientes(clientes, canaisEnvio)
  )
    return false;
  return true;
}
