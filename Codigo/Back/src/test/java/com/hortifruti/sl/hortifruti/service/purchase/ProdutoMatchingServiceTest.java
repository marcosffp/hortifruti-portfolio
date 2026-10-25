package com.hortifruti.sl.hortifruti.service.purchase;

import static org.assertj.core.api.Assertions.assertThat;

import com.hortifruti.sl.hortifruti.model.product.FiscalProduct;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProdutoMatchingServiceTest {

  private final ProdutoMatchingService service = new ProdutoMatchingService(null);

  private static final List<FiscalProduct> CATALOGO =
      List.of(
          produto(1L, "13", "CEBOLINHA", "UN"),
          produto(2L, "48", "CEBOLA BRANCA", "KG"),
          produto(3L, "47", "CEBOLA ROXA", "KG"),
          produto(4L, "37", "ABÓBORA MORANGA", "KG"),
          produto(5L, "135", "MORANGO BANDEJA", "UN"),
          produto(6L, "10", "ALFACE AMERIC KG", "KG"),
          produto(7L, "11", "COUVE FLOR", "UN"));

  private static FiscalProduct produto(Long id, String code, String description, String unidade) {
    return FiscalProduct.builder()
        .id(id)
        .code(code)
        .description(description)
        .unidadeComercial(unidade)
        .build();
  }

  private String codigoSugerido(String lido) {
    var resultado = service.buscarMelhorCandidato(lido, null, null, CATALOGO);
    return resultado.produtoSugerido() == null ? null : resultado.produtoSugerido().codigo();
  }

  @Test
  void cebolinhaNaoViraCebola() {
    assertThat(codigoSugerido("cebolinha")).isEqualTo("13");
  }

  @Test
  void morangaNaoViraMorango() {
    assertThat(codigoSugerido("moranga")).isEqualTo("37");
    assertThat(codigoSugerido("abobora moranga")).isEqualTo("37");
  }

  @Test
  void morangoContinuaMorango() {
    assertThat(codigoSugerido("morango")).isEqualTo("135");
  }

  @Test
  void abreviacaoDoCatalogoEErroDeLeituraAindaCasam() {
    assertThat(codigoSugerido("alface americana")).isEqualTo("10");
    assertThat(codigoSugerido("couv flor")).isEqualTo("11");
  }
}
