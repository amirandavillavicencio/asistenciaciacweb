const fetch = require('node-fetch');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;

const { supabaseGet } = require('../lib/supabase');
const { buildAnalytics, getMonthLabel } = require('../lib/reporting');
const { buildPeriod, applyCommonFilters } = require('../lib/period');

const RECORD_SELECT = 'created_at,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado,espacio,observaciones';
const CHILE_TIMEZONE = 'America/Santiago';
const LOGO_URL = 'https://comunicaciones.usm.cl/wp-content/uploads/2024/04/Mesa-de-trabajo-5-copia-4-300x300.png';
const MARGIN = 20;

function toDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDurationMinutes(minutes) {
  if (!minutes) return 'N/D';
  return `${Math.round(minutes)} min`;
}

function currentSemesterLabel(now = new Date()) {
  const month = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIMEZONE,
    month: '2-digit',
  }).format(now));
  const year = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
  }).format(now));
  return `${month <= 6 ? 1 : 2}-${year}`;
}

function periodLabel(period) {
  if (period.month === 'all') return String(period.year);
  return `${getMonthLabel(period.month)} ${period.year}`;
}


function weekdayFromRecord(record) {
  const date = toDate(record?.hora_entrada ?? record?.created_at);
  if (!date) return null;
  const raw = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    timeZone: CHILE_TIMEZONE,
  }).format(date).toLowerCase();

  if (raw.includes('lunes')) return 'Lunes';
  if (raw.includes('martes')) return 'Martes';
  if (raw.includes('miércoles') || raw.includes('miercoles')) return 'Miércoles';
  if (raw.includes('jueves')) return 'Jueves';
  if (raw.includes('viernes')) return 'Viernes';
  return null;
}

function hourRangeFromRecord(record) {
  const date = toDate(record?.hora_entrada ?? record?.created_at);
  if (!date) return 'Sin hora';

  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(date));
  const nextHour = (hour + 1) % 24;
  return `${String(hour).padStart(2, '0')}:00-${String(nextHour).padStart(2, '0')}:00`;
}

function addHeaderFooter(doc, pageNumber, totalPages, logoDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (pageNumber > 1) {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, 8, 10, 10);
    }
    doc.setTextColor(0, 51, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Informe de Uso CIAC', pageWidth - MARGIN, 14, { align: 'right' });
    doc.setDrawColor(0, 51, 102);
    doc.line(MARGIN, 20, pageWidth - MARGIN, 20);
  }

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Pág. ${pageNumber} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  doc.text('Generado por sistema CIAC - UTFSM', pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
}

function drawBarChart(doc, data, opts = {}) {
  const x = opts.x || MARGIN;
  const y = opts.y || 130;
  const width = opts.width || 120;
  const barHeight = opts.barHeight || 7;
  const gap = opts.gap || 4;
  const max = data.reduce((acc, item) => Math.max(acc, item.count), 0) || 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 51, 102);
  doc.text('Gráfico barras - Actividades', x, y - 6);

  data.slice(0, 7).forEach((item, index) => {
    const top = y + (barHeight + gap) * index;
    const valueWidth = (item.count / max) * width;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(item.label.slice(0, 22), x, top + 5);

    doc.setFillColor(220, 228, 236);
    doc.rect(x + 36, top, width, barHeight, 'F');
    doc.setFillColor(0, 51, 102);
    doc.rect(x + 36, top, valueWidth, barHeight, 'F');

    doc.text(String(item.count), x + 36 + width + 3, top + 5);
  });
}

function drawPieChart(doc, data, opts = {}) {
  const centerX = opts.centerX || 158;
  const centerY = opts.centerY || 165;
  const radius = opts.radius || 28;
  const palette = [
    [0, 51, 102],
    [0, 102, 153],
    [102, 153, 204],
    [153, 51, 102],
    [102, 102, 102],
  ];

  const total = data.reduce((acc, item) => acc + item.count, 0) || 1;
  let start = -Math.PI / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 51, 102);
  doc.text('Gráfico torta - Temáticas', centerX - 30, centerY - radius - 10);

  data.slice(0, 5).forEach((item, index) => {
    const angle = (item.count / total) * Math.PI * 2;
    const color = palette[index % palette.length];
    doc.setFillColor(...color);

    const steps = 18;
    const points = [[centerX, centerY]];
    for (let i = 0; i <= steps; i += 1) {
      const t = start + (angle * i) / steps;
      points.push([centerX + radius * Math.cos(t), centerY + radius * Math.sin(t)]);
    }

    doc.lines(points.slice(1).map((point, idx) => [point[0] - points[idx][0], point[1] - points[idx][1]]), points[0][0], points[0][1], [1, 1], 'F', true);
    start += angle;
  });

  data.slice(0, 5).forEach((item, index) => {
    const color = palette[index % palette.length];
    const legendY = centerY + radius + 8 + index * 5;
    doc.setFillColor(...color);
    doc.rect(centerX - 32, legendY - 3, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text(`${item.label.slice(0, 16)} (${item.percentage}%)`, centerX - 27, legendY);
  });
}

function buildExtendedMetrics(records, analytics) {
  const campusWinner = analytics.executive.campusDistribution[0]?.label || 'N/D';

  const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const weekdayMap = weekdays.reduce((acc, day) => ({ ...acc, [day]: 0 }), {});
  const hourMap = {};
  const dayMap = {};

  const runVisits = {};
  const yearMap = {};
  const spaceUsage = {};
  const spaceHourPeak = {};

  records.forEach((record) => {
    const safeRecord = record ?? {};
    const weekday = weekdayFromRecord(safeRecord);
    if (weekday && weekdayMap[weekday] !== undefined) weekdayMap[weekday] += 1;

    const hourRange = hourRangeFromRecord(safeRecord);
    hourMap[hourRange] = (hourMap[hourRange] || 0) + 1;

    const day = safeRecord?.dia ?? (toDate(safeRecord?.created_at) ? new Intl.DateTimeFormat('en-CA', {
      timeZone: CHILE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(toDate(safeRecord?.created_at)) : '');
    if (day) dayMap[day] = (dayMap[day] || 0) + 1;

    const runKey = `${safeRecord?.run ?? ''}-${safeRecord?.dv ?? ''}`;
    runVisits[runKey] = (runVisits[runKey] || 0) + 1;

    const yearKey = String(safeRecord?.anio_ingreso ?? 'Sin año');
    if (!yearMap[yearKey]) yearMap[yearKey] = { unique: new Set(), attentions: 0 };
    yearMap[yearKey].unique.add(runKey);
    yearMap[yearKey].attentions += 1;

    const spaceKey = String(safeRecord?.espacio ?? 'Sin espacio');
    spaceUsage[spaceKey] = (spaceUsage[spaceKey] || 0) + 1;

    if (!spaceHourPeak[spaceKey]) spaceHourPeak[spaceKey] = {};
    spaceHourPeak[spaceKey][hourRange] = (spaceHourPeak[spaceKey][hourRange] || 0) + 1;
  });

  const maxDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0] || ['N/D', 0];
  const recurrentCount = Object.values(runVisits).filter((count) => count > 1).length;

  const topCareers = analytics.students.careers.slice(0, 10).map((row) => [row.label, row.count, `${analytics.executive.total ? ((row.count / analytics.executive.total) * 100).toFixed(1) : '0.0'}%`]);
  const yearsDistribution = Object.entries(yearMap)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, value]) => [year, value.unique.size, value.attentions]);

  const spacesRows = Object.entries(spaceUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([space, count]) => {
      const peak = Object.entries(spaceHourPeak[space] || {}).sort((a, b) => b[1] - a[1])[0];
      const pct = analytics.executive.total ? ((count / analytics.executive.total) * 100).toFixed(1) : '0.0';
      return [space, count, `${pct}%`, peak ? peak[0] : 'N/D'];
    });

  return {
    campusWinner,
    weekdayRows: weekdays.map((day) => [day, weekdayMap[day] || 0]),
    hourRows: Object.entries(hourMap)
      .filter(([range]) => range !== 'Sin hora')
      .sort((a, b) => a[0].localeCompare(b[0], 'es-CL'))
      .map(([range, count]) => [range, count]),
    maxAttendanceDay: maxDayEntry,
    recurrentCount,
    topCareers,
    yearsDistribution,
    spacesRows,
  };
}

async function fetchLogoDataUrl() {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    return null;
  }
}

function generatePdf({ period, filters, analytics, records, generatedAt, logoDataUrl }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const metrics = buildExtendedMetrics(records, analytics);

  // Página 1: Portada
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, width, pageHeight, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', width / 2 - 18, 28, 36, 36);
  }

  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Informe de Uso CIAC', width / 2, 80, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Centro de Innovación, Aprendizaje y Creatividad', width / 2, 89, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Campus: ${filters.campus || 'Todos los campus'}`, width / 2, 108, { align: 'center' });
  doc.text(`Período: ${periodLabel(period)}`, width / 2, 116, { align: 'center' });
  doc.text(`Fecha de generación: ${generatedAt}`, width / 2, 124, { align: 'center' });
  doc.text(`Semestre en curso: ${currentSemesterLabel()}`, width / 2, 132, { align: 'center' });

  // Página 2: Resumen Ejecutivo
  doc.addPage();
  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Resumen Ejecutivo', MARGIN, 30);

  const summaryRows = [
    ['Total de atenciones registradas', analytics.executive.total],
    ['Total de estudiantes únicos (RUN)', analytics.executive.uniqueStudents],
    ['Promedio de atenciones por día hábil', analytics.executive.averagePerBusinessDay],
    ['Tiempo promedio de permanencia', formatDurationMinutes(analytics.executive.averageDurationMinutes)],
    ['Campus con mayor actividad', metrics.campusWinner],
  ];

  autoTable(doc, {
    startY: 38,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Indicador', 'Valor']],
    body: summaryRows,
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  // Página 3: Actividad y temática
  doc.addPage();
  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Análisis por Actividad y Temática', MARGIN, 30);

  autoTable(doc, {
    startY: 36,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Actividad', 'N° atenciones', '% del total']],
    body: analytics.activity.rows.map((row) => [row.label, row.count, `${row.percentage}%`]),
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    tableWidth: 84,
  });

  autoTable(doc, {
    startY: 36,
    margin: { left: 108, right: MARGIN },
    head: [['Temática', 'N° atenciones', '% del total']],
    body: analytics.topic.rows.map((row) => [row.label, row.count, `${row.percentage}%`]),
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    tableWidth: 82,
  });

  drawBarChart(doc, analytics.activity.rows, { x: MARGIN, y: 145, width: 80, barHeight: 6, gap: 3 });
  drawPieChart(doc, analytics.topic.rows, { centerX: 154, centerY: 185, radius: 24 });

  // Página 4: Temporal
  doc.addPage();
  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Análisis Temporal', MARGIN, 30);

  autoTable(doc, {
    startY: 36,
    margin: { left: MARGIN, right: 114 },
    head: [['Día de semana', 'N° atenciones']],
    body: metrics.weekdayRows,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  autoTable(doc, {
    startY: 36,
    margin: { left: 102, right: MARGIN },
    head: [['Rango horario', 'N° atenciones']],
    body: metrics.hourRows,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Día con mayor asistencia: ${metrics.maxAttendanceDay[0]} (${metrics.maxAttendanceDay[1]})`, MARGIN, 170);

  // Página 5: Estudiantes
  doc.addPage();
  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Análisis de Estudiantes', MARGIN, 30);

  autoTable(doc, {
    startY: 36,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Carrera', 'N° atenciones', '% del total']],
    body: metrics.topCareers,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Año ingreso', 'N° estudiantes únicos', 'N° atenciones']],
    body: metrics.yearsDistribution,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Estudiantes recurrentes (>1 visita): ${metrics.recurrentCount}`, MARGIN, Math.min(doc.lastAutoTable.finalY + 10, 275));

  // Página 6: Espacios
  doc.addPage();
  doc.setTextColor(0, 51, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Detalle por Espacio', MARGIN, 30);

  autoTable(doc, {
    startY: 36,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Espacio', 'N° usos', '% del total', 'Horario de mayor uso']],
    body: metrics.spacesRows,
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    addHeaderFooter(doc, page, pages, logoDataUrl);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const period = buildPeriod(req.query?.year, req.query?.month);
    const query = {
      select: RECORD_SELECT,
      order: 'hora_entrada.asc',
      and: `(dia.gte.${period.start},dia.lte.${period.end})`,
      limit: 10000,
    };
    const filters = applyCommonFilters(query, req.query);

    let registros;
    try {
      registros = await supabaseGet('attendance_records', query);
    } catch (error) {
      throw new Error(error?.message || 'Error consultando registros para exportación PDF.');
    }
    const records = Array.isArray(registros) ? registros : [];
    const analytics = buildAnalytics(records);
    const generatedAt = formatDateTime(new Date());
    const logoDataUrl = await fetchLogoDataUrl();

    const pdfBuffer = generatePdf({
      period,
      filters,
      analytics,
      records,
      generatedAt,
      logoDataUrl,
    });

    const filename = `informe_uso_CIAC_${String(period.year)}-${String(period.month === 'all' ? 'all' : period.month).padStart(2, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'No se pudo exportar el informe PDF.' });
  }
};
