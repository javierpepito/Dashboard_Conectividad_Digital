# Dashboard_Conectividad_Digital

Monitor de Conectividad Digital: sistema que recolecta, procesa, almacena y muestra
indicadores de conectividad (brecha digital) para distintos rangos de edad. Construido
con **Flask + Python**, un **DWH en MySQL** (esquema estrella), un **ETL en Pentaho** y
un **dashboard web** que consume una **API REST**. Aplica los marcos **TOGAF** y **DMBOK**
y un **SLA** verificable con semáforos.

## Arquitectura

```
Google Forms (CSV) → Pentaho ETL → MySQL (DWH) → API Flask (JSON) → Dashboard (HTML + Chart.js)
```

El dashboard (`templates/home.html` + `static/`) no tiene datos fijos: pide todo a la API.
Si el DWH/API no responde, cae automáticamente a datos demo para no quedar en blanco.

## Estructura

| Archivo / carpeta            | Rol                                                        |
| ---------------------------- | ---------------------------------------------------------- |
| `index.py`                   | App Flask: dashboard + 5 endpoints REST                    |
| `db.py`                      | Conexión al DWH MySQL (configuración por variables de entorno) |
| `schema.sql`                 | DDL del DWH (esquema estrella + `log_etl`)                 |
| `seed_demo.sql`              | Catálogos + ~64 mediciones de ejemplo para probar en vivo  |
| `templates/base.html`        | Layout (fuentes IBM Plex, Chart.js, CSS)                   |
| `templates/home.html`        | Markup del dashboard                                       |
| `static/css/dashboard.css`   | Estilos                                                    |
| `static/js/dashboard.js`     | Render de KPIs/gráficos y consumo de la API               |
| `.env.example`               | Plantilla de configuración (copiar a `.env`)              |

## Endpoints de la API

| Endpoint          | Devuelve (JSON)                                                |
| ----------------- | ------------------------------------------------------------- |
| `/kpi_principal`  | Índice de brecha digital, velocidad/horas por rango, volumen, % sin acceso |
| `/distribucion`   | Conteo de registros por tipo de conexión                      |
| `/completitud`    | Completitud y % de nulos por campo (calidad DMBOK)            |
| `/historico`      | Completitud de los últimos 10 ciclos del ETL                  |
| `/sla`            | 5 dimensiones del SLA + semáforo global                       |

## Puesta en marcha

1. **Crear y activar un entorno e instalar dependencias**

   ```bash
   python -m venv venv
   venv\Scripts\activate            # Windows
   pip install -r requirements.txt
   ```

2. **Crear el DWH en MySQL**

   ```bash
   mysql -u root -p < schema.sql
   mysql -u root -p dwh_conectividad < seed_demo.sql   # opcional: datos de ejemplo
   ```

   Cuando el ETL de Pentaho cargue datos reales, el dashboard los mostrará sin cambios.

3. **Configurar credenciales**

   ```bash
   copy .env.example .env           # Windows
   ```

   Ajusta `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` en `.env`.

4. **Ejecutar**

   ```bash
   python index.py
   ```

   Abre <http://localhost:5000>. El indicador del encabezado muestra **datos en vivo**
   cuando la API responde, o **datos demo** si el DWH no está disponible.
