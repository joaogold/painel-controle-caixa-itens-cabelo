// Exportação de dados em CSV, Excel (XLSX) e PDF.
// As bibliotecas pesadas são carregadas sob demanda (dynamic import).

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

// columns: [{ header, accessor: (row) => string|number }]
function buildMatrix(rows, columns) {
  const head = columns.map((c) => c.header)
  const body = rows.map((r) => columns.map((c) => c.accessor(r)))
  return [head, ...body]
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** CSV com separador ; e BOM (acentuação no Excel pt-BR). */
export function exportCSV(filename, rows, columns) {
  const matrix = buildMatrix(rows, columns)
  const csv = matrix
    .map((line) =>
      line
        .map((cell) => {
          const v = String(cell ?? '')
          return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
        })
        .join(';'),
    )
    .join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename}-${timestamp()}.csv`)
}

/** Excel (.xlsx). */
export async function exportXLSX(filename, rows, columns) {
  const XLSX = await import('xlsx')
  const matrix = buildMatrix(rows, columns)
  const ws = XLSX.utils.aoa_to_sheet(matrix)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${filename}-${timestamp()}.xlsx`)
}

/** PDF (tabela). */
export async function exportPDF(filename, title, rows, columns) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22)
  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(c.accessor(r)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [219, 39, 119] },
  })
  doc.save(`${filename}-${timestamp()}.pdf`)
}
