package com.hortifruti.sl.hortifruti.service.notification.email;

import java.util.List;

/**
 * Contrato comum para qualquer provedor de envio de email (SendGrid, Gmail SMTP, etc). Novos
 * provedores devem implementar esta interface e ser plugados em {@link EmailService} via a
 * propriedade {@code email.provider}, sem exigir mudanças nos demais serviços que hoje dependem
 * apenas de {@link EmailService}.
 */
public interface EmailSender {

  String providerName();

  boolean sendSimpleEmail(String to, String subject, String text);

  boolean sendEmailWithAttachments(
      String to, String subject, String text, List<byte[]> attachments, List<String> fileNames);

  /**
   * Envia uma única mensagem para vários destinatários (Para/Cc/Cco). {@code attachments} e {@code
   * fileNames} podem ser nulos para um e-mail sem anexos.
   */
  boolean sendEmail(
      EmailRecipients recipients,
      String subject,
      String text,
      List<byte[]> attachments,
      List<String> fileNames);
}
