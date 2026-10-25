package com.hortifruti.sl.hortifruti.dto.purchase;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record UpdatePurchaseDateRequest(@NotNull LocalDate purchaseDate) {}
