package com.hortifruti.sl.hortifruti.dto.purchase;

/**
 * Resultado da duplicação de uma compra. {@code imageNotCopied} é true quando a compra original
 * tinha foto de comprovante vinculada — a cópia é criada sem a foto.
 */
public record DuplicatePurchaseResponse(PurchaseResponse purchase, boolean imageNotCopied) {}
