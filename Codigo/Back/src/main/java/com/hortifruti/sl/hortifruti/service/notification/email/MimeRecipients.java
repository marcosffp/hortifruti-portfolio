package com.hortifruti.sl.hortifruti.service.notification.email;

import jakarta.mail.MessagingException;
import org.springframework.mail.javamail.MimeMessageHelper;

/** Aplica Para/Cc/Cco de {@link EmailRecipients} a uma mensagem MIME. */
final class MimeRecipients {

  private MimeRecipients() {}

  static void apply(MimeMessageHelper helper, EmailRecipients recipients)
      throws MessagingException {
    if (!recipients.to().isEmpty()) {
      helper.setTo(recipients.to().toArray(String[]::new));
    }
    if (!recipients.cc().isEmpty()) {
      helper.setCc(recipients.cc().toArray(String[]::new));
    }
    if (!recipients.bcc().isEmpty()) {
      helper.setBcc(recipients.bcc().toArray(String[]::new));
    }
  }
}
