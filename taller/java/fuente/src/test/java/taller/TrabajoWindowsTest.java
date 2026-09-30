package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class TrabajoWindowsTest {

    @Test
    void enWindowsElMotorEntraEnSuTrabajo_yFueraDeWindowsNoHaceNada() {
        boolean creado = TrabajoWindows.crear();
        if (Sistema.actual() == Sistema.WINDOWS) {
            assertTrue(creado, "no se creo el objeto de trabajo con las funciones nativas");
            assertTrue(TrabajoWindows.activo());
            // Una segunda vez no crea otro.
            assertTrue(TrabajoWindows.crear());
        } else {
            assertFalse(creado);
            assertFalse(TrabajoWindows.activo());
        }
    }

    @Test
    void laEstructuraEsLaDeWindowsEn64Bits() {
        // JOBOBJECT_EXTENDED_LIMIT_INFORMATION: 64 de la basica, 48 de los
        // contadores de E/S y 32 de los cuatro SIZE_T; LimitFlags despues de dos
        // LARGE_INTEGER. Y nada que permita salir del trabajo (SPEC 028).
        assertEquals(144, TrabajoWindows.TAMANO_INFORMACION);
        assertEquals(16, TrabajoWindows.DESPLAZAMIENTO_LIMITES);
        assertEquals(0x2000, TrabajoWindows.KILL_ON_JOB_CLOSE);
    }
}
