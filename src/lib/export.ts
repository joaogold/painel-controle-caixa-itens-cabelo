// Exportação de dados em CSV, Excel (XLSX) e PDF.
// As bibliotecas pesadas (xlsx, jspdf) são carregadas sob demanda (dynamic import)
// para manter o bundle inicial leve.

export type Column<T> = {
  header: string
  accessor: (row: T) => string | number
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function buildMatrix<T>(rows: T[], columns: Column<T>[]): (string | number)[][] {
  const head = columns.map((c) => c.header)
  const body = rows.map((r) => columns.map((c) => c.accessor(r)))
  return [head, ...body]
}

/** Exporta para CSV (separador ; e BOM para acentuação no Excel pt-BR). */
export function exportCSV<T>(filename: string, rows: T[], columns: Column<T>[]): void {
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

/** Exporta para Excel (.xlsx). */
export async function exportXLSX<T>(filename: string, rows: T[], columns: Column<T>[]): Promise<void> {
  const XLSX = await import('xlsx')
  const matrix = buildMatrix(rows, columns)
  const ws = XLSX.utils.aoa_to_sheet(matrix)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${filename}-${timestamp()}.xlsx`)
}

/** Exporta para PDF (tabela). */
export async function exportPDF<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: Column<T>[],
): Promise<void> {
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
