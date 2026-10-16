package com.hortifruti.sl.hortifruti.service.notification.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class EmailRecipientsTest {

  @Test
  void ofSplitsCommaSeparatedAddresses() {
    EmailRecipients recipients = EmailRecipients.of(" a@x.com, b@y.com ,");

    assertEquals(List.of("a@x.com", "b@y.com"), recipients.to());
    assertTrue(recipients.cc().isEmpty());
    assertTrue(recipients.bcc().isEmpty());
  }

  @Test
  void removesBlankAndDuplicatedAddressesAcrossFields() {
    EmailRecipients recipients =
        new EmailRecipients(
            Arrays.asList("a@x.com", " ", null, "A@x.com"),
            List.of("a@x.com", "c@x.com"),
            List.of("c@x.com", "d@x.com"));

    assertEquals(List.of("a@x.com"), recipients.to());
    assertEquals(List.of("c@x.com"), recipients.cc());
    assertEquals(List.of("d@x.com"), recipients.bcc());
    assertEquals(List.of("a@x.com", "c@x.com", "d@x.com"), recipients.all());
  }

  @Test
  void nullListsAreTreatedAsEmpty() {
    assertTrue(new EmailRecipients(null, null, null).isEmpty());
  }
}
