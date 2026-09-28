#!/usr/bin/env bash
# Genera los dos runtimes de Java que viajan en el clon (punto 6.2 del SPEC 026).
#
#     taller/java/fuente/generar-runtimes.sh
#
# Deja taller/java/jre/windows-x64 y taller/java/jre/macos-aarch64, recortados
# con jlink a partir de los jmods de Eclipse Temurin 25 (SPEC 030). jlink arma
# un runtime para otra plataforma si recibe los jmods de esa plataforma, asi que
# los dos salen de una sola maquina: el jlink es el del JDK de esta maquina, de
# la misma version exacta, y los jmods son los de cada destino.
#
# Desde Java 24 el JDK de Temurin no trae los jmods adentro (JEP 493): vienen en
# un paquete aparte, uno por plataforma.
#
# Las versiones y las sumas SHA-256 van fijas aqui. Si una descarga no coincide
# con su suma, el script se detiene. Los runtimes se confirman una sola vez;
# regenerarlos solo hace falta para cambiar de version de Java.
#
# Corre en macOS con chip de Apple o en Linux x64. Necesita curl, tar, unzip y
# shasum o sha256sum.

set -euo pipefail

# La ultima de Java 25 LTS en Adoptium al hacer el SPEC 030, con las sumas que
# publica su API.
VERSION='25.0.4.1+1'
BASE='https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1'

# Los jmods de cada destino.
MAC_JMODS_ARCHIVO='OpenJDK25U-jmods_aarch64_mac_hotspot_25.0.4.1_1.tar.gz'
MAC_JMODS_SUMA='182f3c09df135883f3800bfd5e1e5b65a2cd44172863be8e7db48bb3d8233bd9'
WIN_JMODS_ARCHIVO='OpenJDK25U-jmods_x64_windows_hotspot_25.0.4.1_1.zip'
WIN_JMODS_SUMA='c6b6b19ba9ab28bb4c15b936a7cef40dedcd99ab69f69109dcb0ffad805f0847'
# El JDK de la maquina que recorta, por su jdeps y su jlink.
MAC_ARCHIVO='OpenJDK25U-jdk_aarch64_mac_hotspot_25.0.4.1_1.tar.gz'
MAC_SUMA='61979887f7506a24a57439ff99adb8b3a7fc89977d9cfe3b8984f58a981b7b9d'
LINUX_ARCHIVO='OpenJDK25U-jdk_x64_linux_hotspot_25.0.4.1_1.tar.gz'
LINUX_SUMA='dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e'

# Los modulos que el programa usa de verdad. Salen de
#     jdeps --print-module-deps --ignore-missing-deps taller/java/taller.jar
# y el script lo vuelve a comprobar antes de recortar.
MODULOS='java.base,jdk.httpserver'

AQUI=$(cd "$(dirname "$0")" && pwd -P)
TALLER=$(cd "$AQUI/.." && pwd -P)
CACHE="${TALLER_CACHE_JDK:-$HOME/.cache/taller-java-jdk}"
mkdir -p "$CACHE"

sha256() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

bajar() {
  local archivo=$1 suma=$2
  if [ ! -f "$CACHE/$archivo" ]; then
    echo "  bajando $archivo"
    curl -fsSL -o "$CACHE/$archivo.parcial" "$BASE/$archivo"
    mv "$CACHE/$archivo.parcial" "$CACHE/$archivo"
  fi
  local obtenida
  obtenida=$(sha256 "$CACHE/$archivo")
  if [ "$obtenida" != "$suma" ]; then
    echo "  la suma de $archivo no coincide: se esperaba $suma y salio $obtenida" >&2
    exit 1
  fi
}

extraer() {
  local archivo=$1 destino=$2
  rm -rf "$destino"
  mkdir -p "$destino"
  case $archivo in
    *.zip) unzip -q "$CACHE/$archivo" -d "$destino" ;;
    *) tar xzf "$CACHE/$archivo" -C "$destino" ;;
  esac
}

TRABAJO=$(mktemp -d)
trap 'rm -rf "$TRABAJO"' EXIT

bajar "$MAC_JMODS_ARCHIVO" "$MAC_JMODS_SUMA"
bajar "$WIN_JMODS_ARCHIVO" "$WIN_JMODS_SUMA"
extraer "$MAC_JMODS_ARCHIVO" "$TRABAJO/mac-jmods"
extraer "$WIN_JMODS_ARCHIVO" "$TRABAJO/win-jmods"
MAC_JMODS="$TRABAJO/mac-jmods/jdk-$VERSION-jmods"
WIN_JMODS="$TRABAJO/win-jmods/jdk-$VERSION-jmods"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    bajar "$MAC_ARCHIVO" "$MAC_SUMA"
    extraer "$MAC_ARCHIVO" "$TRABAJO/mac"
    ANFITRION="$TRABAJO/mac/jdk-$VERSION/Contents/Home"
    ;;
  Linux-x86_64)
    bajar "$LINUX_ARCHIVO" "$LINUX_SUMA"
    extraer "$LINUX_ARCHIVO" "$TRABAJO/linux"
    ANFITRION="$TRABAJO/linux/jdk-$VERSION"
    ;;
  *) echo "  este script corre en macOS con chip de Apple o en Linux x64" >&2; exit 1 ;;
esac

DEPS=$("$ANFITRION/bin/jdeps" --print-module-deps --ignore-missing-deps "$TALLER/taller.jar")
if [ "$DEPS" != "$MODULOS" ]; then
  echo "  jdeps dice que el programa usa $DEPS, y aqui se recortan $MODULOS. Actualiza MODULOS." >&2
  exit 1
fi

recortar() {
  local jmods=$1 destino=$2
  rm -rf "$destino"
  "$ANFITRION/bin/jlink" \
    --module-path "$jmods" \
    --add-modules "$MODULOS" \
    --strip-debug --no-header-files --no-man-pages --compress zip-6 \
    --output "$destino"
  echo "  $(du -sh "$destino" | awk '{print $1}')  $destino"
}

recortar "$WIN_JMODS" "$TALLER/jre/windows-x64"
recortar "$MAC_JMODS" "$TALLER/jre/macos-aarch64"
