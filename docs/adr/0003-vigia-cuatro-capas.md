# ADR 0003 — Vigía: ampliación a 4 capas de datos del Estado

**Estado:** Aceptado  
**Fecha:** 2026-06-26

## Contexto

La versión inicial de Vigía se enfocaba en detección de irregularidades en
contratación pública (obras + sanciones + avance). Durante la hackathon, el
equipo identificó que ese ángulo —aunque técnicamente sólido— limitaba la
plataforma a un perfil de usuario muy específico (auditores, periodistas de
investigación) y reducía el impacto percibido del reto de scraping.

## Decisión

Ampliar Vigía a un **monitor de desempeño integral del Estado peruano** con
cuatro lentes simultáneos, sin eliminar la capa de obras:

| Capa        | Fuente nueva          | Pregunta que responde                              |
|-------------|-----------------------|----------------------------------------------------|
| Presupuesto | MEF Consulta Amigable | ¿Qué entidades no ejecutan su asignación?          |
| Servicios   | MINSA + MINEDU        | ¿Qué distritos carecen de postas y escuelas?       |
| Planilla    | SERVIR                | ¿Dónde se concentra el empleo público?             |
| Obras       | OCDS + INFOBRAS + OECE| ¿Qué obras tienen señales de riesgo?               |

La metáfora del "vigía" se amplía: ya no observa solo las irregularidades,
sino el estado de salud completo del Estado en cada región del país.

## Consecuencias positivas

- El usuario objetivo se amplía: ciudadanos, ONGs, periodistas, planificadores
  regionales, investigadores.
- Tres nuevas fuentes de datos (MEF, MINSA/MINEDU, SERVIR) que no habían sido
  cruzadas en un único dashboard público.
- La arquitectura Medallion absorbe las nuevas fuentes sin cambios
  estructurales: un adapter por fuente, tablas Silver nuevas, la vista Gold
  `performance_regional` agrega las 4 capas por región.
- El scoring de irregularidades en obras queda como una señal más dentro de
  un producto más completo y con mayor alcance cívico.

## Consecuencias a considerar

- 3 adapters ETL adicionales (MEF, MINEDU, MINSA).
- El frontend requiere un toggle de capas en el mapa.
- La vista `performance_regional` depende de que las 4 tablas Silver tengan
  datos; si alguna está vacía, esa capa muestra ceros (falla graceful).
