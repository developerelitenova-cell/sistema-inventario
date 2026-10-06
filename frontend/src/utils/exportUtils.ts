/**
 * Utility to export data to CSV compatible with Microsoft Excel (with UTF-8 BOM)
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

export function exportToCsv<T>(filename: string, columns: ExportColumn<T>[], data: T[]): void {
  const headerRow = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(';');

  const rows = data.map(item => {
    return columns.map(col => {
      const val = col.accessor(item);
      if (val === null || val === undefined) return '""';
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(';');
  });

  const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
