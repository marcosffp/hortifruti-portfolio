package com.hortifruti.sl.hortifruti.service.purchase.tabelapreco;

import com.hortifruti.sl.hortifruti.dto.purchase.tabelapreco.TabelaPrecoClienteResponse;
import com.hortifruti.sl.hortifruti.exception.purchase.InvalidTabelaPrecoClienteFileException;
import com.hortifruti.sl.hortifruti.exception.purchase.TabelaPrecoClienteNaoEncontradaException;
import com.hortifruti.sl.hortifruti.model.purchase.StatusMatchItemTabelaPreco;
import com.hortifruti.sl.hortifruti.model.purchase.StatusTabelaPreco;
import com.hortifruti.sl.hortifruti.model.purchase.TabelaPrecoCliente;
import com.hortifruti.sl.hortifruti.model.purchase.TabelaPrecoClienteItem;
import com.hortifruti.sl.hortifruti.repository.purchase.TabelaPrecoClienteItemRepository;
import com.hortifruti.sl.hortifruti.repository.purchase.TabelaPrecoClienteRepository;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Copia uma tabela de preços (com todos os itens, preços e vínculos) pra outra competência do mesmo
 * cliente. A cópia já nasce {@code CONFIRMADA} (confirmada por quem duplicou), exceto se a origem ainda tem itens
 * {@code SUGERIDO} sem decisão humana — aí fica {@code RASCUNHO}. Segue o mesmo
 * versionamento do import: se a competência de destino já tem versões, cria {@code versao+1} sem
 * tocar nas existentes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TabelaPrecoClienteDuplicacaoService {

  private static final ZoneId BRAZIL_ZONE = ZoneId.of("America/Sao_Paulo");

  private final TabelaPrecoClienteRepository tabelaPrecoClienteRepository;
  private final TabelaPrecoClienteItemRepository tabelaPrecoClienteItemRepository;
  private final TabelaPrecoClienteReviewService tabelaPrecoClienteReviewService;

  @Transactional
  public TabelaPrecoClienteResponse duplicar(
      Long tabelaOrigemId, int competenciaMes, int competenciaAno, Long usuarioId) {
    TabelaPrecoCliente origem =
        tabelaPrecoClienteRepository
            .findById(tabelaOrigemId)
            .orElseThrow(
                () ->
                    new TabelaPrecoClienteNaoEncontradaException(
                        "Tabela de preços " + tabelaOrigemId + " não encontrada."));

    YearMonth destino;
    try {
      destino = YearMonth.of(competenciaAno, competenciaMes);
    } catch (DateTimeException e) {
      throw new InvalidTabelaPrecoClienteFileException("Competência de destino inválida.", e);
    }

    List<TabelaPrecoCliente> existentes =
        tabelaPrecoClienteRepository
            .findByClienteIdAndCompetenciaAnoAndCompetenciaMesOrderByVersaoDesc(
                origem.getClienteId(), competenciaAno, competenciaMes);
    int versao = existentes.isEmpty() ? 1 : existentes.get(0).getVersao() + 1;

    // Regra da tabela: item SUGERIDO sem decisão humana impede a confirmação. Se a origem ainda
    // tem sugestões pendentes, a cópia continua RASCUNHO pra revisão.
    boolean confirmar =
        !tabelaPrecoClienteItemRepository.existsByTabelaPrecoClienteIdAndStatusMatch(
            tabelaOrigemId, StatusMatchItemTabelaPreco.SUGERIDO);

    TabelaPrecoCliente copia =
        tabelaPrecoClienteRepository.save(
            TabelaPrecoCliente.builder()
                .clienteId(origem.getClienteId())
                .competenciaMes(competenciaMes)
                .competenciaAno(competenciaAno)
                .vigenciaInicio(destino.atDay(1))
                .vigenciaFim(destino.atEndOfMonth())
                .versao(versao)
                .status(confirmar ? StatusTabelaPreco.CONFIRMADA : StatusTabelaPreco.RASCUNHO)
                .confirmadoEm(confirmar ? LocalDateTime.now(BRAZIL_ZONE) : null)
                .confirmadoPor(confirmar ? usuarioId : null)
                .origemArquivoNome("Duplicada de " + rotulo(origem))
                .importadoPor(usuarioId)
                .build());

    List<TabelaPrecoClienteItem> itens =
        tabelaPrecoClienteItemRepository.findByTabelaPrecoClienteId(tabelaOrigemId).stream()
            .map(
                item ->
                    TabelaPrecoClienteItem.builder()
                        .tabelaPrecoClienteId(copia.getId())
                        .codigoProdutoCliente(item.getCodigoProdutoCliente())
                        .nomeProdutoCliente(item.getNomeProdutoCliente())
                        .preco(item.getPreco())
                        .fiscalProductId(item.getFiscalProductId())
                        .confiancaMatching(item.getConfiancaMatching())
                        .statusMatch(item.getStatusMatch())
                        .build())
            .toList();
    tabelaPrecoClienteItemRepository.saveAll(itens);

    log.info(
        "Tabela de preços duplicada: origemId={}, copiaId={}, clienteId={}, competencia={}/{},"
            + " versao={}, itens={}",
        tabelaOrigemId,
        copia.getId(),
        origem.getClienteId(),
        competenciaMes,
        competenciaAno,
        versao,
        itens.size());

    return tabelaPrecoClienteReviewService.buscarTabela(copia.getId());
  }

  private String rotulo(TabelaPrecoCliente tabela) {
    return String.format(
        "%02d/%d v%d", tabela.getCompetenciaMes(), tabela.getCompetenciaAno(), tabela.getVersao());
  }
}
