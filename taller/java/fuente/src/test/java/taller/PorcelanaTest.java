package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class PorcelanaTest {

    private static final String H = "0123456789012345678901234567890123456789";

    @Test
    void cadaClaseDeEntradaVaASuArea() {
        String texto = String.join("\0",
                "1 M. N... 100644 100644 100644 " + H + " " + H + " preparado.md",
                "1 .M N... 100644 100644 100644 " + H + " " + H + " sin preparar.md",
                "1 MM N... 100644 100644 100644 " + H + " " + H + " los dos.md",
                "1 A. N... 000000 100644 100644 " + H + " " + H + " nuevo.md",
                "1 D. N... 100644 000000 000000 " + H + " " + H + " retirado.md",
                "1 .D N... 100644 100644 000000 " + H + " " + H + " borrado a mano.md",
                "2 R. N... 100644 100644 100644 " + H + " " + H + " R100 recetas/canción.md",
                "canción.md",
                "u UU N... 100644 100644 100644 100644 " + H + " " + H + " " + H + " platos.md",
                "? recetas/ñoquis con salsa.md",
                "! ignorado.tmp",
                "");
        Porcelana.Areas a = Porcelana.leer(texto);
        assertEquals(List.of(
                new Porcelana.Entrada("preparado.md", 'M', null),
                new Porcelana.Entrada("los dos.md", 'M', null),
                new Porcelana.Entrada("nuevo.md", 'A', null),
                new Porcelana.Entrada("retirado.md", 'D', null),
                new Porcelana.Entrada("recetas/canción.md", 'R', "canción.md")), a.preparado());
        assertEquals(List.of(
                new Porcelana.Entrada("sin preparar.md", 'M', null),
                new Porcelana.Entrada("los dos.md", 'M', null),
                new Porcelana.Entrada("borrado a mano.md", 'D', null)), a.modificado());
        assertEquals(List.of("recetas/ñoquis con salsa.md"), a.sinSeguimiento());
        assertEquals(List.of("platos.md"), a.conflicto());
        assertEquals(9, a.cambios());
    }

    @Test
    void vacioNoTieneNada() {
        Porcelana.Areas a = Porcelana.leer("");
        assertEquals(0, a.cambios());
    }
}
