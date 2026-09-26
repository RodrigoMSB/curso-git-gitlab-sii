package taller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSON minimo, para no traer una libreria entera por dos usos.
 *
 * Escribe mapas, listas, textos, numeros, logicos y nulos, y lee lo que la
 * pagina manda, que es un objeto con textos.
 */
public final class Json {

    private Json() {}

    public static String escribir(Object valor) {
        StringBuilder sb = new StringBuilder();
        escribir(valor, sb);
        return sb.toString();
    }

    private static void escribir(Object valor, StringBuilder sb) {
        if (valor == null) {
            sb.append("null");
        } else if (valor instanceof String texto) {
            texto(texto, sb);
        } else if (valor instanceof Boolean || valor instanceof Integer || valor instanceof Long) {
            sb.append(valor);
        } else if (valor instanceof Number numero) {
            sb.append(numero.doubleValue());
        } else if (valor instanceof Map<?, ?> mapa) {
            sb.append('{');
            boolean primero = true;
            for (Map.Entry<?, ?> e : mapa.entrySet()) {
                if (!primero) sb.append(',');
                primero = false;
                texto(String.valueOf(e.getKey()), sb);
                sb.append(':');
                escribir(e.getValue(), sb);
            }
            sb.append('}');
        } else if (valor instanceof Iterable<?> lista) {
            sb.append('[');
            boolean primero = true;
            for (Object elemento : lista) {
                if (!primero) sb.append(',');
                primero = false;
                escribir(elemento, sb);
            }
            sb.append(']');
        } else {
            texto(valor.toString(), sb);
        }
    }

    private static void texto(String texto, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < texto.length(); i++) {
            char c = texto.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20 || c == ' ' || c == ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    /** Lee un documento JSON. Lanza {@link IllegalArgumentException} si no lo es. */
    public static Object leer(String texto) {
        Lector lector = new Lector(texto);
        lector.espacios();
        Object valor = lector.valor();
        lector.espacios();
        if (lector.i != texto.length()) throw new IllegalArgumentException("sobra texto despues del JSON");
        return valor;
    }

    private static final class Lector {
        private final String s;
        private int i;

        Lector(String s) {
            this.s = s;
        }

        void espacios() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }

        char ver() {
            if (i >= s.length()) throw new IllegalArgumentException("JSON incompleto");
            return s.charAt(i);
        }

        void esperar(char c) {
            if (ver() != c) throw new IllegalArgumentException("se esperaba " + c);
            i++;
        }

        Object valor() {
            char c = ver();
            if (c == '{') return objeto();
            if (c == '[') return lista();
            if (c == '"') return texto();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            return numero();
        }

        Map<String, Object> objeto() {
            esperar('{');
            Map<String, Object> mapa = new LinkedHashMap<>();
            espacios();
            if (ver() == '}') { i++; return mapa; }
            while (true) {
                espacios();
                String clave = texto();
                espacios();
                esperar(':');
                espacios();
                mapa.put(clave, valor());
                espacios();
                if (ver() == ',') { i++; continue; }
                esperar('}');
                return mapa;
            }
        }

        List<Object> lista() {
            esperar('[');
            List<Object> lista = new ArrayList<>();
            espacios();
            if (ver() == ']') { i++; return lista; }
            while (true) {
                espacios();
                lista.add(valor());
                espacios();
                if (ver() == ',') { i++; continue; }
                esperar(']');
                return lista;
            }
        }

        String texto() {
            esperar('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = ver();
                i++;
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                char e = ver();
                i++;
                switch (e) {
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'u' -> {
                        if (i + 4 > s.length()) throw new IllegalArgumentException("escape incompleto");
                        sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                    }
                    default -> sb.append(e);
                }
            }
        }

        Number numero() {
            int inicio = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            if (inicio == i) throw new IllegalArgumentException("valor JSON invalido");
            String n = s.substring(inicio, i);
            if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
            return Long.parseLong(n);
        }
    }
}
