package com.hortifruti.sl.hortifruti.util;

import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.transaction.CannotCreateTransactionException;

/**
 * Repete uma leitura quando o banco derruba a conexão no meio da operação (ex.: restart do MySQL no
 * Railway — "Communications link failure" / "Server shutdown in progress"). Deve envolver a chamada
 * ao service por FORA da transação, pra que cada tentativa abra uma conexão nova do pool (o Hikari
 * já descartou a quebrada). Só pra leituras: repetir uma escrita poderia duplicá-la.
 */
@Slf4j
public final class TransientDbRetry {

  private static final int MAX_ATTEMPTS = 3;
  private static final long BASE_DELAY_MS = 300;

  private TransientDbRetry() {}

  public static <T> T run(Supplier<T> readOperation) {
    for (int attempt = 1; ; attempt++) {
      try {
        return readOperation.get();
      } catch (DataAccessResourceFailureException
          | TransientDataAccessException
          | CannotCreateTransactionException e) {
        if (attempt >= MAX_ATTEMPTS) {
          throw e;
        }
        log.warn(
            "Falha transitória de banco na leitura (tentativa {}/{}): {}",
            attempt,
            MAX_ATTEMPTS,
            e.getMessage());
        try {
          Thread.sleep(BASE_DELAY_MS * attempt);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw e;
        }
      }
    }
  }
}
