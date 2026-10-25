package com.hortifruti.sl.hortifruti.dto.notification;

import java.math.BigDecimal;
import java.util.List;

/**
 * {@code to} vazio/nulo usa os destinatários configurados em ACCOUNTING_EMAIL. {@code cc}/{@code
 * bcc} são opcionais. Com {@code individual=true} cada endereço de {@code to} recebe uma mensagem
 * própria (comportamento antigo); caso contrário todos recebem uma única mensagem.
 */
public record GenericFilesAccountingRequest(
    BigDecimal cardValue,
    BigDecimal cashValue,
    String customMessage,
    List<String> to,
    List<String> cc,
    List<String> bcc,
    boolean individual) {

  public GenericFilesAccountingRequest(
      BigDecimal cardValue, BigDecimal cashValue, String customMessage) {
    this(cardValue, cashValue, customMessage, null, null, null, false);
  }
}
