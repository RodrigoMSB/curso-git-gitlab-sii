#!/bin/sh
# El editor que Git recibe en el taller (SPEC 026, 3.6).
#
# La consola de la pagina no tiene teclado para un editor de terminal como vi:
# se quedaria esperando hasta el limite de tiempo. Aqui se pregunta a Git cual
# es el editor configurado, que es el que usaria sin el taller, y se abre si
# es uno de ventana, como `code --wait`. Si es de terminal, o no esta
# instalado, se termina de inmediato diciendo que configurar.
real=$(unset GIT_EDITOR; git var GIT_EDITOR 2>/dev/null)
case "$real" in
  \"*) programa=${real#\"}; programa=${programa%%\"*} ;;
  \'*) programa=${real#\'}; programa=${programa%%\'*} ;;
  *) programa=${real%% *} ;;
esac
usable=si
case "${programa##*/}" in
  ""|vi|vim|nvim|nano|pico|emacs|ed|joe|micro|mcedit) usable=no ;;
  *) command -v "$programa" >/dev/null 2>&1 || [ -x "$programa" ] || usable=no ;;
esac
if [ "$usable" = no ]; then
  {
    echo "No hay un editor que la consola del taller pueda abrir."
    echo "Para escribir el mensaje en VS Code, configuralo una vez con:"
    echo "    git config --global core.editor \"code --wait\""
    echo "O escribe el mensaje en la misma orden, con -m \"mensaje\"."
  } >&2
  exit 1
fi
# Como lo invoca Git: el editor, con el archivo como argumento.
eval "$real \"\$@\""
