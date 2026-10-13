# Cambios de la versión 2.0

Ver README.md para las funciones y ACTIVACION.md para la publicación completa.

La primera mejora visual se mantiene. El máximo del plantel es 50, los dorsales van del 1 al 99 y son únicos, y hay 63 avatares. El club ahora tiene previa, confirmación de asistencia, equipos equilibrados, votos de reconocimientos y diario semanal. Los perfiles admiten apodo, edad, dorsal, avatar, posiciones, pie, frase y color.

El acceso antiguo basado en elegir un nombre y guardar un booleano de administrador fue reemplazado por una API con PIN de jugador y contraseña administrativa verificadas en servidor. Las lecturas públicas están permitidas a través de esa API; los cambios de perfil, votos y asistencia se vinculan a la identidad autenticada. Los cambios de dorsales y votaciones se validan en transacciones. Los nombres, IDs y datos estadísticos previos se conservan.

No se agregó carga de fotos. No se cambió la fórmula deportiva previa salvo excluir los nuevos reconocimientos decorativos del puntaje y el Valor Mercenario.

Validación: 18 pruebas nuevas con base en memoria; las seis suites anteriores; navegación por ocho secciones a 360, 390, 768 y 1280 px; edición de perfil, asistencia, voto de reconocimiento, login administrativo, equilibrio de equipos, guardado/confirmación de previa y precarga de resultados en Chromium; build de producción correcto. Los datos de las capturas son de prueba y no se subieron a Firebase.

No se desplegó la app. El acceso por PIN requiere activar el servidor y publicar las reglas de Firestore, según ACTIVACION.md. El build conserva una advertencia de tamaño del paquete JavaScript.
