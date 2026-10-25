package com.hortifruti.sl.hortifruti.service.notification.email;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Destinatários de uma única mensagem de e-mail: Para, Cc (cópia visível) e Cco (cópia oculta). Os
 * endereços são normalizados (trim, sem vazios, sem duplicados) e um endereço que já está em Para
 * não se repete em Cc/Cco, nem um em Cc se repete em Cco.
 */
public record EmailRecipients(List<String> to, List<String> cc, List<String> bcc) {

  public EmailRecipients {
    Set<String> seen = new LinkedHashSet<>();
    to = normalize(to, seen);
    cc = normalize(cc, seen);
    bcc = normalize(bcc, seen);
  }

  /** Aceita um único endereço ou vários separados por vírgula (ex.: "a@x.com,b@y.com"). */
  public static EmailRecipients of(String to) {
    return new EmailRecipients(split(to), List.of(), List.of());
  }

  public boolean isEmpty() {
    return to.isEmpty() && cc.isEmpty() && bcc.isEmpty();
  }

  public List<String> all() {
    List<String> all = new ArrayList<>(to);
    all.addAll(cc);
    all.addAll(bcc);
    return all;
  }

  private static List<String> split(String raw) {
    List<String> result = new ArrayList<>();
    if (raw == null) {
      return result;
    }
    for (String part : raw.split(",")) {
      result.add(part);
    }
    return result;
  }

  private static List<String> normalize(List<String> addresses, Set<String> seen) {
    List<String> result = new ArrayList<>();
    if (addresses == null) {
      return List.of();
    }
    for (String address : addresses) {
      if (address == null) {
        continue;
      }
      String trimmed = address.trim();
      if (!trimmed.isEmpty() && seen.add(trimmed.toLowerCase())) {
        result.add(trimmed);
      }
    }
    return List.copyOf(result);
  }
}
