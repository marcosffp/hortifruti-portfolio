package com.hortifruti.sl.hortifruti.dto.purchase.tabelapreco;

/** Competência (mês/ano) de destino da duplicação de uma tabela de preços. */
public record DuplicarTabelaPrecoRequest(int competenciaMes, int competenciaAno) {}
