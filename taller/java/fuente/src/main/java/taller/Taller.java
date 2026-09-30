package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * La sesion de la consola: en que carpeta esta, que orden corre y que dice Git.
 *
 * Guarda el ultimo estado leido con un numero de version. La pagina pregunta
 * cada medio segundo y se le responde de memoria; a Git solo se le pregunta
 * despues de una orden o cuando la huella cambia, y nunca mas de una vez por
 * segundo por la huella (punto 3.7).
 */
public final class Taller {

    /** Lo que la pagina necesita saber de la sesion, fijo desde el arranque. */
    public record Datos(
            Sistema sistema, Path limite, Path clon, Path trabajo, Path propia, String usuario, String equipo,
            List<String> avisos) {}

    private final Datos datos;
    private final Ejecutor ejecutor;
    private final LectorEstado lector;
    private final AtomicBoolean ocupado = new AtomicBoolean();
    private final Object lectura = new Object();

    private volatile Path carpeta;
    private volatile long version;
    private volatile String documento = "";
    private volatile long ultimaHuella;
    /** Cuando fue la ultima lectura que disparo la huella. Las de una orden no cuentan. */
    private volatile long ultimaPorHuella;
    private volatile boolean pendiente;
    private volatile String ordenEnCurso;
    private volatile boolean leyendo;
    /** Se avisa cada vez que termina una lectura, cambie o no la version. */
    private final Object terminoLectura = new Object();

    public Taller(Datos datos, Ejecutor ejecutor, LectorEstado lector) {
        this.datos = datos;
        this.ejecutor = ejecutor;
        this.lector = lector;
        this.carpeta = carpetaGuardada();
    }

    public Datos datos() {
        return datos;
    }

    public Path carpeta() {
        return carpeta;
    }

    public long version() {
        return version;
    }

    public String documento() {
        return documento;
    }

    /** La carpeta en que quedo la consola la vez anterior, si sigue existiendo y esta dentro del limite. */
    private Path carpetaGuardada() {
        Path archivo = datos.propia().resolve("carpeta");
        try {
            if (Files.isRegularFile(archivo)) {
                Path p = Path.of(Files.readString(archivo, StandardCharsets.UTF_8).trim());
                if (Files.isDirectory(p) && Rutas.dentroDe(datos.limite(), p, datos.sistema())) return Rutas.real(p);
            }
        } catch (IOException | RuntimeException e) {
            // Sin carpeta guardada se parte en la raiz del taller, taller-git.
        }
        return Rutas.real(datos.trabajo());
    }

    private void guardarCarpeta() {
        try {
            Files.writeString(datos.propia().resolve("carpeta"), carpeta.toString(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            Registro.escribir("no se pudo guardar la carpeta de la consola, " + e.getMessage());
        }
    }

    /** Resultado de pedir una orden. {@code null} en {@code resultado} significa que otra estaba corriendo. */
    public record Respuesta(Ejecutor.Resultado resultado, String enCurso) {}

    public Respuesta ejecutar(String orden) {
        if (!ocupado.compareAndSet(false, true)) return new Respuesta(null, ordenEnCurso);
        ordenEnCurso = orden;
        try {
            Registro.escribir("orden en " + Rutas.relativa(datos.limite(), carpeta) + " · " + orden);
            Ejecutor.Resultado r = ejecutor.ejecutar(orden, carpeta);
            if (!r.carpeta().equals(carpeta)) {
                carpeta = r.carpeta();
                guardarCarpeta();
            }
            if (r.agotado()) Registro.escribir("la orden se detuvo por tiempo");
            leer();
            return new Respuesta(r, null);
        } finally {
            ordenEnCurso = null;
            ocupado.set(false);
        }
    }

    boolean leyendo() {
        return leyendo;
    }

    public boolean ocupado() {
        return ocupado.get();
    }

    /** Le pregunta a Git y sube la version si algo de lo que se dibuja cambio. */
    public void leer() {
        synchronized (lectura) {
            leyendo = true;
            try {
                leerSinAvisar();
            } finally {
                leyendo = false;
                synchronized (terminoLectura) {
                    terminoLectura.notifyAll();
                }
            }
        }
    }

    /**
     * Si la pagina pregunta mientras se esta leyendo, o mientras la huella ya
     * cambio y la lectura esta por empezar, espera a que termine en vez de
     * responder que nada cambio. Asi un archivo guardado en el editor aparece
     * en cuanto Git termina de leerlo, y no medio segundo despues, en la
     * pregunta siguiente. Nunca lanza nada: solo espera a la lectura que ya
     * iba a ocurrir.
     */
    public void esperarLectura(long desde, long milisegundos) throws InterruptedException {
        long fin = System.currentTimeMillis() + milisegundos;
        synchronized (terminoLectura) {
            while (version == desde && (leyendo || pendiente)) {
                long resta = fin - System.currentTimeMillis();
                if (resta <= 0) return;
                terminoLectura.wait(resta);
            }
        }
    }

    private void leerSinAvisar() {
        Path donde = carpeta;
        long huella = Huella.de(donde, datos.limite());
        Map<String, Object> estado;
        try {
            estado = lector.leer(donde);
        } catch (IOException e) {
            Registro.escribir("no se pudo leer el estado, " + e.getMessage());
            return;
        }
        ultimaHuella = huella;
        pendiente = false;
        Map<String, Object> todo = new LinkedHashMap<>();
        todo.put("sesion", sesion(donde));
        todo.put("estado", estado);
        String nuevo = Json.escribir(todo);
        if (!nuevo.equals(documento)) {
            documento = nuevo;
            version++;
        }
    }

    /**
     * Una vuelta del vigilante: calcula la huella y, si cambio, lee el estado,
     * salvo que la ultima lectura por la huella haya sido hace menos de un
     * segundo (punto 3.7). La lectura que sigue a una orden no cuenta: si
     * contara, un archivo guardado en el editor justo despues de una orden
     * tardaria segundo y medio en verse.
     */
    public void vigilar() {
        long huella = Huella.de(carpeta, datos.limite());
        if (huella != ultimaHuella) pendiente = true;
        long ahora = System.currentTimeMillis();
        if (pendiente && ahora - ultimaPorHuella >= 1000) {
            ultimaPorHuella = ahora;
            leer();
        }
    }

    private Map<String, Object> sesion(Path donde) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("sistema", switch (datos.sistema()) {
            case WINDOWS -> "windows";
            case MAC -> "mac";
            case OTRO -> "otro";
        });
        s.put("usuario", datos.usuario());
        s.put("equipo", datos.equipo());
        s.put("limite", datos.limite().getFileName() == null ? Rutas.conBarras(datos.limite())
                : datos.limite().getFileName().toString());
        s.put("carpeta", Rutas.conBarras(donde));
        s.put("relativa", Rutas.relativa(datos.limite(), donde));
        s.put("avisos", datos.avisos());
        s.put("tiempoMaximo", ejecutor.tiempoMaximo());
        s.put("motor", "java");
        return s;
    }
}
