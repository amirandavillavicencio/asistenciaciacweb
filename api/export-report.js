const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,actividad,tematica,estado';

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeLabel(value, fallback = 'No informado') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function toMinutes(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Math.round(date.getTime() / 60000);
}

function formatAverageDuration(records) {
  const durations = records
    .map((record) => {
      const start = toMinutes(record.hora_entrada);
      const end = toMinutes(record.hora_salida);
      return start === null || end === null || end < start ? null : end - start;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) {
    return '00:00';
  }

  const average = Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
  const hours = String(Math.floor(average / 60)).padStart(2, '0');
  const minutes = String(average % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildCountRows(records, key, labelKey) {
  const totals = records.reduce((accumulator, record) => {
    const label = normalizeLabel(record[key]);
    accumulator.set(label, (accumulator.get(label) || 0) + 1);
    return accumulator;
  }, new Map());

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([label, count]) => ({ [labelKey]: label, cantidad: count }));
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function getColumnWidths(rows, headers) {
  return headers.map((header) => {
    const maxLength = rows.reduce((length, row) => {
      return Math.max(length, String(row[header] ?? '').length);
    }, String(header).length);

    return Math.min(Math.max(maxLength + 2, 14), 40);
  });
}

function buildSheetXml(rows, headers) {
  const normalizedRows = rows.length
    ? rows
    : [headers.reduce((accumulator, header) => ({ ...accumulator, [header]: '' }), {})];
  const widths = getColumnWidths(normalizedRows, headers);
  const sheetRows = [headers, ...normalizedRows.map((row) => headers.map((header) => row[header] ?? ''))];
  const colsXml = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rowsXml = sheetRows.map((row, rowIndex) => {
    const cellsXml = row.map((value, columnIndex) => {
      const cellRef = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? ' s="1"' : '';
      return `<c r="${cellRef}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
    }).join('');

    return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
  }).join('');
  const lastCell = `${columnName(headers.length - 1)}${sheetRows.length}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function createWorkbookBuffer(sheets) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciac-report-'));
  const relsDir = path.join(tempDir, '_rels');
  const docPropsDir = path.join(tempDir, 'docProps');
  const xlDir = path.join(tempDir, 'xl');
  const xlRelsDir = path.join(xlDir, '_rels');
  const worksheetsDir = path.join(xlDir, 'worksheets');

  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(docPropsDir, { recursive: true });
  fs.mkdirSync(xlRelsDir, { recursive: true });
  fs.mkdirSync(worksheetsDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(tempDir, '[Content_Types].xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n  ')}
</Types>`);

    fs.writeFileSync(path.join(relsDir, '.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

    fs.writeFileSync(path.join(docPropsDir, 'core.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>CIAC Registro</dc:creator>
  <cp:lastModifiedBy>CIAC Registro</cp:lastModifiedBy>
</cp:coreProperties>`);

    fs.writeFileSync(path.join(docPropsDir, 'app.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>CIAC Registro</Application>
</Properties>`);

    fs.writeFileSync(path.join(xlDir, 'workbook.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('\n    ')}
  </sheets>
</workbook>`);

    fs.writeFileSync(path.join(xlRelsDir, 'workbook.xml.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('\n  ')}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

    fs.writeFileSync(path.join(xlDir, 'styles.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);

    sheets.forEach((sheet, index) => {
      fs.writeFileSync(path.join(worksheetsDir, `sheet${index + 1}.xml`), buildSheetXml(sheet.rows, sheet.headers));
    });

    const outputPath = path.join(tempDir, 'informe_uso_ciac.xlsx');
    execFileSync('zip', ['-q', '-r', outputPath, '[Content_Types].xml', '_rels', 'docProps', 'xl'], { cwd: tempDir });
    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function slugifyFilename(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDetailRows(records) {
  return records.map((record) => ({
    run: record.run || '',
    dv: record.dv || '',
    carrera: record.carrera || '',
    sede: record.sede || '',
    hora_entrada: record.hora_entrada || '',
    hora_salida: record.hora_salida || '',
    actividad: record.actividad || '',
    tematica: record.tematica || '',
    estado: record.estado || (record.hora_salida ? 'salida' : 'entrada'),
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const campus = String(req.query?.campus || '').trim();
    const query = {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    };

    if (campus) {
      query.sede = `eq.${campus}`;
    }

    const registros = await supabaseGet('attendance_records', query);

    const rows = Array.isArray(registros) ? registros : [];
    const workbookBuffer = createWorkbookBuffer([
      {
        name: 'Registros',
        headers: ['run', 'dv', 'carrera', 'sede', 'hora_entrada', 'hora_salida', 'actividad', 'tematica', 'estado'],
        rows: buildDetailRows(rows),
      },
      {
        name: 'Resumen',
        headers: ['metrica', 'valor'],
        rows: [
          { metrica: 'Fecha del informe', valor: dia },
          { metrica: 'Campus', valor: campus || 'Todos' },
          { metrica: 'Total registros', valor: rows.length },
          { metrica: 'Promedio duración', valor: formatAverageDuration(rows) },
        ],
      },
      {
        name: 'Actividad',
        headers: ['actividad', 'cantidad'],
        rows: buildCountRows(rows, 'actividad', 'actividad'),
      },
      {
        name: 'Temática',
        headers: ['tematica', 'cantidad'],
        rows: buildCountRows(rows, 'tematica', 'tematica'),
      },
      {
        name: 'Campus',
        headers: ['campus', 'cantidad'],
        rows: buildCountRows(rows, 'sede', 'campus'),
      },
    ]);

    const filenameSuffix = campus ? `-${slugifyFilename(campus)}` : '';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="informe-uso-ciac-${dia}${filenameSuffix}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', workbookBuffer.length);

    return res.status(200).send(workbookBuffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo generar el informe de uso.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
