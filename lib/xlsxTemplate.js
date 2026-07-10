// lib/xlsxTemplate.js
// Заполнение ячеек в готовом .xlsx БЕЗ пересборки книги.
// Открываем zip (JSZip), точечно патчим XML нужных листов, всё остальное
// остаётся байт-в-байт как в оригинале — стили/рамки/печать не трогаются,
// Excel не «восстанавливает» файл (в отличие от пересохранения через ExcelJS,
// который в браузере портил XML листов — реальный инцидент).
// Чистые функции патча тестируются юнитами; JSZip передаётся снаружи (lazy).

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

const colNum = letters => letters.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)

// Ячейка со строковым значением inline (не трогаем sharedStrings)
function cellXml(ref, sAttr, value) {
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

// Патчит XML одного листа: cells = [{ref:'B5', value:'…'}]
// Существующая ячейка заменяется (стиль s="…" сохраняется), отсутствующая —
// вставляется в правильную позицию строки/списка строк.
export function patchSheetXml(xml, cells) {
  for (const { ref, value } of cells) {
    if (value === null || value === undefined || value === '') continue
    const m = String(ref).match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    const colL = m[1], row = +m[2]

    // 1) ячейка уже есть — заменить, сохранив стиль
    const cellRe = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`)
    const found = xml.match(cellRe)
    if (found) {
      const sM = found[1].match(/ s="\d+"/)
      xml = xml.replace(cellRe, cellXml(ref, sM ? sM[0] : '', value))
      continue
    }

    const newCell = cellXml(ref, '', value)

    // 2) строка есть — вставить ячейку по порядку колонок
    const rowRe = new RegExp(`<row r="${row}"([^>]*?)(/>|>)`)
    const rowM = xml.match(rowRe)
    if (rowM) {
      if (rowM[2] === '/>') {
        xml = xml.replace(rowRe, `<row r="${row}"$1>${newCell}</row>`)
      } else {
        const start = xml.indexOf(rowM[0]) + rowM[0].length
        const end   = xml.indexOf('</row>', start)
        const inner = xml.slice(start, end)
        const target = colNum(colL)
        let insertAt = inner.length
        const cRe = /<c r="([A-Z]+)\d+"/g
        let cm
        while ((cm = cRe.exec(inner))) {
          if (colNum(cm[1]) > target) { insertAt = cm.index; break }
        }
        xml = xml.slice(0, start) + inner.slice(0, insertAt) + newCell + inner.slice(insertAt) + xml.slice(end)
      }
      continue
    }

    // 3) строки нет — вставить перед первой строкой с бОльшим номером / в конец
    const newRow = `<row r="${row}">${newCell}</row>`
    let pos = -1
    const rRe = /<row r="(\d+)"/g
    let rm
    while ((rm = rRe.exec(xml))) {
      if (+rm[1] > row) { pos = rm.index; break }
    }
    if (pos === -1) {
      if (xml.includes('<sheetData/>')) { xml = xml.replace('<sheetData/>', `<sheetData>${newRow}</sheetData>`); continue }
      pos = xml.indexOf('</sheetData>')
      if (pos === -1) continue
    }
    xml = xml.slice(0, pos) + newRow + xml.slice(pos)
  }
  return xml
}

// workbook.xml + workbook.xml.rels → { 'Анкета': 'xl/worksheets/sheet1.xml', … }
export function resolveSheetPaths(workbookXml, relsXml) {
  const rels = {}
  let m
  const relRe = /<Relationship\b[^>]*>/g
  while ((m = relRe.exec(relsXml))) {
    const id     = (m[0].match(/ Id="([^"]+)"/) || [])[1]
    const target = (m[0].match(/ Target="([^"]+)"/) || [])[1]
    if (id && target) rels[id] = target.replace(/^\//, '')
  }
  const out = {}
  const sheetRe = /<sheet\b[^>]*>/g
  while ((m = sheetRe.exec(workbookXml))) {
    const name = (m[0].match(/ name="([^"]+)"/) || [])[1]
    const rid  = (m[0].match(/ r:id="([^"]+)"/) || [])[1]
    if (!name || !rid || !rels[rid]) continue
    const plain = name.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    const t = rels[rid]
    out[plain] = t.startsWith('xl/') ? t : 'xl/' + t
  }
  return out
}

// Главная: buf (ArrayBuffer/Uint8Array шаблона) + cells [{sheet, ref, value}] → Uint8Array готового файла
export async function fillXlsxTemplate(buf, cells, JSZip) {
  const zip = await JSZip.loadAsync(buf)
  const wbFile   = zip.file('xl/workbook.xml')
  const relsFile = zip.file('xl/_rels/workbook.xml.rels')
  if (!wbFile || !relsFile) throw new Error('Не похоже на .xlsx: нет xl/workbook.xml')
  const paths = resolveSheetPaths(await wbFile.async('string'), await relsFile.async('string'))

  const bySheet = {}
  for (const c of cells) (bySheet[c.sheet] = bySheet[c.sheet] || []).push(c)

  for (const [sheet, sheetCells] of Object.entries(bySheet)) {
    const path = paths[sheet]
    if (!path) continue   // листа нет в шаблоне — пропускаем молча
    const f = zip.file(path)
    if (!f) continue
    zip.file(path, patchSheetXml(await f.async('string'), sheetCells))
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
