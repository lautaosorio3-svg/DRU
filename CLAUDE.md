# CLAUDE.md — DRU Editorial

## 1. No programar sin contexto
- ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura.
- Si no tienes contexto suficiente, pregunta. No asumas.

## 2. Respuestas cortas
- Responde en 1-3 oraciones. Sin preambulos, sin resumen final.
- No repitas lo que el usuario dijo. No expliques lo obvio.
- Codigo habla por si mismo: no narres cada linea que escribes.

## 3. No reescribir archivos completos
- Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo.
- Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

## 4. No releer archivos ya leidos
- Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado.
- Toma notas mentales de lo importante en tu primera lectura.

## 5. Validar antes de declarar hecho
- Despues de un cambio: compila, corre tests, o verifica que funciona.
- Nunca digas "listo" sin evidencia de que funciona.

## 6. Cero charla aduladora
- No digas "Excelente pregunta", "Gran idea", "Perfecto", etc.
- No halagues al usuario. Ve directo al trabajo.

## 7. Soluciones simples
- Implementa lo minimo que resuelve el problema. Nada mas.
- No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron.
- 3 lineas repetidas > 1 abstraccion prematura.

## 8. No pelear con el usuario
- Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos.
- Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

## 9. Leer solo lo necesario
- No leas archivos completos si solo necesitas una seccion. Usa offset y limit.
- Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

## 10. No narrar el plan antes de ejecutar
- No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo.
- El usuario ve tus tool calls. No necesita un preview en texto.

## 11. Paralelizar tool calls
- Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno.
- Menos roundtrips = menos tokens de contexto acumulado.

## 12. No duplicar codigo en la respuesta
- Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff.
- Si creaste un archivo, no lo muestres entero en texto tambien.

## 13. No usar Agent cuando Grep/Read basta
- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

---

## Criterios editoriales DRU (para prompts de generacion de contenido)

- Tono: formal-periodístico sin sensacionalismo. Nunca INCREÍBLE, NO VAS A CREER.
- Nunca inventar datos ni citas. Las comillas son sagradas.
- Keyword geográfica obligatoria: "Concordia", "Entre Ríos" o "Salto Grande".
- Meta title: keyword geográfica al inicio, máx 60 caracteres.
- Carrusel: máx 12 palabras/slide, slide 1 gancho SIN repetir caption, slide 4 CTA fondo naranja.
- Nota SEO: H1 + entradilla 5W + H2 cada ~200 palabras + citas entre comillas + keyword geo en primer párrafo.
- Facebook: primera línea gancho autónomo + 3 párrafos + CTA + 3-5 hashtags.
- Instagram: hook máx 12 palabras/línea, persuasivo, sin clickbait vacío.

## Criterios de gestión en redes sociales — DRU (basados en investigación académica)

Fuente: Martín-García, Buitrago & Aguaded (2022). "La voz del periodismo en las redes sociales". *Profesional de la información*, v.31, n.3.

### Calidad editorial sobre métricas de corto plazo
- La calidad del contenido publicado en redes debe prevalecer sobre la búsqueda de clics e interacciones.
- Anti-clickbait absoluto: nunca prometer en el titular/copy lo que la nota no cumple. El usuario se siente estafado y daña la credibilidad del medio a largo plazo.
- Evitar notas "espectaculares pero sin trasfondo" que generan visitas pero degradan el periodismo.
- El éxito no se mide solo en likes o compartidos; la reputación online del medio es el activo principal.

### Bidireccionalidad: redes como canal de diálogo, no de difusión
- Las redes sociales basan su éxito en la bidireccionalidad. No tratar a la audiencia como sujetos pasivos que "recepcionan noticias".
- Invitar a la participación cuando sea pertinente: preguntas abiertas, encuestas, debate constructivo.
- Escucha activa (monitorización): entender qué temas interesan a la comunidad y ajustar la cobertura.
- Responder dudas, quejas y sugerencias. La relación con el usuario es el valor añadido que justifica la presencia en redes.

### Comunidad activa, no tráfico
- El objetivo no es usar las redes únicamente como intermediarias hacia la web: deben generar una comunidad de usuarios que se interese por el medio y por la actualidad.
- El copy en redes debe informar con independencia de si el usuario hace clic o no.
- Producir contenido nativo de valor para cada plataforma (no solo links a la web).

### Cortafuegos contra desinformación y odio
- El community manager actúa como cortafuegos ante fake news y bulos: identificar y no amplificar información no verificada.
- Nunca republicar o reaccionar a contenido cuya veracidad no está confirmada.
- Ante mensajes de odio: aplicar la estrategia del medio (observar, argumentar o ignorar según el caso). No todas las crisis se gestionan igual.
- Recordar que los bulos que se hacen eco en medios amplifican su daño exponencialmente.

### Arquetipos de usuarios en redes (para orientar respuestas)
1. **Creadores de debate**: aportan crítica constructiva o contenido complementario. Responder e incentivar.
2. **Afines al medio**: agradecen, recomiendan, muestran conformidad. Reconocer y fidelizar.
3. **Beligerantes**: ataques sin argumentación contra el medio, periodistas o usuarios. Gestionar según protocolo; no alimentar la confrontación.
4. **Difusores de odio/fake news**: publican con intención de desprestigiar o confundir. Alertar internamente; no amplificar.

### Redes como medio periodístico independiente
- Las cuentas del medio son medios de comunicación en sí mismos, no solo extensiones de la web.
- El periodismo transmedia exige conocer los códigos y tendencias de cada plataforma.
- Los jóvenes se informan principalmente en redes: conectar con nuevas generaciones requiere formatos nativos (reels, stories, carruseles informativos).
- La información de contexto y profundidad siempre estará en la web; las redes son la puerta de entrada y el espacio de comunidad.

## Modelo de Enfoques Editoriales — News User Needs (Dmitry Shishkin)

Fuente: Dmitry Shishkin (ex-BBC World Service). Modelo adoptado por BBC, smartocto, FT Strategies y múltiples redacciones.

El modelo organiza 8 necesidades de usuario en 4 ejes. Cada nota puede reescribirse desde cualquiera de estos enfoques según la intención editorial y la necesidad de la audiencia.

### Eje CONOCER (Facts)
- **Update me**: Noticia de última hora. ¿Qué pasó? ¿Cuáles son los datos? Estructura factual, 5W, sin opinión. DATO CLAVE: la BBC descubrió que el 70% de su producción era "Update me" pero solo generaba el 7% de las visitas. Diversificar enfoques es clave.
- **Keep me engaged**: Seguimiento, debate, participación activa. El lector no quiere ser pasivo: quiere seguir el tema, opinar, volver por actualizaciones. Ideal para temas en desarrollo.

### Eje COMPRENDER (Context)
- **Educate me**: Explicación profunda y accesible. Considerada la necesidad MÁS VALIOSA del modelo. El lector quiere aprender sobre un tema complejo. Formatos: explainers, guías, "qué es", "cómo funciona".
- **Give me perspective**: Análisis y opinión experta. ¿Qué significa esto? ¿Cómo me afecta? Voces de analistas, comparaciones, implicancias a futuro. Desmenuzar lo complejo.

### Eje SENTIR (Emotions)
- **Inspire me**: Historia humana, logro contra las dificultades, periodismo de soluciones. El lector termina con sensación positiva o motivadora. También aplica a soluciones a problemas publicados.
- **Divert me**: Respiro del hard news. Curiosidad, dato sorprendente, costado entretenido. Previene la fatiga informativa. Informar divirtiendo, no trivializar.

### Eje ACTUAR (Actions)
- **Help me**: Periodismo de servicio. El lector puede ACTUAR con lo que lee. Guías prácticas, pasos concretos, datos de contacto, plazos, requisitos. "Cómo...", "Qué hacer si...".
- **Connect me**: Comunidad y empatía. El lector se siente conectado con otros. Experiencias compartidas, iniciativas colectivas, testimonios. Genera acción solidaria o comunitaria.

### Aplicación en DRU
- Cada nota puede reescribirse desde cualquiera de los 8 enfoques usando la sección "Enfoques" del panel editorial.
- La sección "Traspaso a redes" también usa los 8 enfoques para adaptar el copy de redes.
- Diversificar enfoques mejora el retorno de inversión editorial: las notas "Update me" tienen el menor engagement comparativo.
